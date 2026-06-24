import {
    CancellationToken,
    CancellationTokenSource,
    commands,
    debug,
    EventEmitter,
    ExtensionContext,
    lm,
    McpHttpServerDefinition,
    Uri,
    WebviewPanel,
    window,
    workspace,
} from 'vscode';
import { ComlinkFrontendApi } from 'shared/src/index';
import { createWebview, getVueFrontendPanelContent } from './webview/content';
import * as Comlink from 'comlink/dist/esm/comlink';
import { getComlinkChannel } from './webview/messaging';
import { getStacktraceInfo } from './debug/callstack-extractor';
import { FrontendApi } from './frontend-functions';
import { logInfo, logError, logDebug, showOutputChannel } from './log';
import * as http from 'http';
import * as path from 'path';

// Provided by webpack at runtime to bypass bundling for dynamic requires
declare const __non_webpack_require__: typeof require;

let currentFrontendRpcChannel: Comlink.Remote<ComlinkFrontendApi> | undefined = undefined;
let currentCancellationSource: CancellationTokenSource | undefined = undefined;

async function updateViewWithStackTrace() {
    logDebug('updateViewWithStackTrace started');
    const updateStart = Date.now();
    try {
        if (!currentFrontendRpcChannel) {
            logError('No rpc channel found, cannot update view');
            throw new Error('No rpc channel found');
        }
        currentCancellationSource?.cancel();
        currentCancellationSource = new CancellationTokenSource();

        logDebug('Fetching stacktrace info');
        const result = await getStacktraceInfo(currentCancellationSource.token);
        logDebug(`Stacktrace info fetched, frames: ${result.length}`);
        logDebug('RPC call: setStackTrace to webview');
        const setStackStart = Date.now();
        await currentFrontendRpcChannel.setStackTrace(result);
        logDebug(`RPC call: setStackTrace completed in ${Date.now() - setStackStart}ms`);
        logDebug(`updateViewWithStackTrace completed in ${Date.now() - updateStart}ms`);
    } catch (e: unknown) {
        if ((e as Error).message?.includes('cancell')) {
            logDebug('updateViewWithStackTrace was cancelled');
            return;
        }
        if ((e as Error).message?.includes('debuggee is running')) {
            logDebug('updateViewWithStackTrace: debuggee is running, stack trace not available yet');
            return;
        }
        logError('updateViewWithStackTrace failed:', e);
        window.showErrorMessage('failed to load stacktrace, due to error, please try to open view again. Error: ' + e);
    } finally {
        currentCancellationSource?.dispose();
        currentCancellationSource = undefined;
    }
}

let _mcpCleanup: (() => Promise<void>) | undefined;

export async function activate(context: ExtensionContext) {
    let currentPanel: WebviewPanel | undefined = undefined;
    let isUpdating = false;
    let isInitializing = false;
    let pendingUpdate = false;

    const MCP_CONFIG_KEY = 'debug-graph.mcp.enabled';
    const MCP_PROVIDER_ID = 'debugGraph.mcpProvider';
    const mcpChangeEmitter = new EventEmitter<void>();
    let mcpHttpServer: http.Server | undefined = undefined;
    let mcpActive = false;
    let mcpStartGeneration = 0;

    function mcpEnabled(): boolean {
        return workspace.getConfiguration().get<boolean>(MCP_CONFIG_KEY, true);
    }

    async function startMcp(): Promise<void> {
        if (!mcpEnabled()) {
            logInfo('MCP disabled by setting, skipping start');
            return;
        }
        if (mcpActive) {
            logDebug('MCP already active, skipping start');
            return;
        }
        const gen = ++mcpStartGeneration;
        try {
            // Load the esbuild-bundled MCP module (inlines @modelcontextprotocol/*)
            const modulePath = path.join(context.extensionUri.fsPath, 'dist', 'mcp-server.js');
            const mcpModule = (__non_webpack_require__ || require)(modulePath) as {
                handleStreamableHttp: (server: http.Server) => void;
            };

            const server = http.createServer();
            mcpModule.handleStreamableHttp(server);

            await new Promise<void>((resolve, reject) => {
                server.on('error', reject);
                server.listen(0, '127.0.0.1', () => {
                    const addr = server.address();
                    if (addr && typeof addr === 'object') {
                        logInfo(`MCP HTTP server listening on ${addr.address}:${addr.port}`);
                    }
                    resolve();
                });
            });

            // Check if stopMcp() was called while we were starting
            if (gen !== mcpStartGeneration) {
                server.close();
                logDebug('MCP start cancelled (generation mismatch)');
                return;
            }

            mcpHttpServer = server;
            mcpActive = true;
            mcpChangeEmitter.fire();
            logInfo('MCP server started');
        } catch (e) {
            if (gen !== mcpStartGeneration) {
                logDebug('MCP start error ignored (generation mismatch)');
                return;
            }
            logError('Failed to start MCP:', e);
        }
    }

    async function stopMcp(): Promise<void> {
        logInfo('Stopping MCP server');
        mcpActive = false;
        mcpStartGeneration++; // Invalidate any in-flight startMcp()
        const server = mcpHttpServer;
        mcpHttpServer = undefined;
        if (server) {
            await new Promise<void>((resolve) => {
                server.close(() => resolve());
                // Force cleanup after 5s to avoid hanging
                setTimeout(() => {
                    server.closeAllConnections?.();
                    resolve();
                }, 5000);
            });
        }
        mcpChangeEmitter.fire();
    }

    _mcpCleanup = stopMcp;

    // Start MCP on activation if enabled
    await startMcp();

    // Watch for config changes
    context.subscriptions.push(
        workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration(MCP_CONFIG_KEY)) {
                logInfo('MCP configuration changed');
                if (mcpEnabled()) {
                    startMcp();
                } else {
                    stopMcp();
                }
            }
        }),
    );

    context.subscriptions.push(
        lm.registerMcpServerDefinitionProvider(MCP_PROVIDER_ID, {
            onDidChangeMcpServerDefinitions: mcpChangeEmitter.event,

            provideMcpServerDefinitions: async (_token: CancellationToken) => {
                if (!mcpActive || !mcpHttpServer) {
                    return [];
                }

                const addr = mcpHttpServer.address();
                if (!addr || typeof addr !== 'object') {
                    return [];
                }

                const uri = Uri.parse(`http://127.0.0.1:${addr.port}/mcp`);

                return [new McpHttpServerDefinition('Debug Graph MCP', uri, {}, context.extension.packageJSON.version)];
            },

            resolveMcpServerDefinition: async (server: McpHttpServerDefinition, _token: CancellationToken) => {
                return server;
            },
        }),
    );
    logInfo('MCP server definition provider registered');

    context.subscriptions.push(
        commands.registerCommand('call-graph.restart-mcp', async () => {
            if (!mcpEnabled()) {
                window.showWarningMessage(
                    'Debug Graph MCP is disabled. Enable it with the "debug-graph.mcp.enabled" setting.',
                );
                return;
            }
            try {
                logInfo('Restarting MCP server...');
                await stopMcp();
                await startMcp();
                logInfo('MCP server restarted successfully');
                window.showInformationMessage('Debug Graph MCP server restarted');
            } catch (e) {
                logError('Failed to restart MCP server:', e);
                window.showErrorMessage(`Failed to restart MCP server: ${e}`);
            }
        }),
    );

    const updateView = () => {
        if (!currentPanel || !currentPanel.visible) {
            logDebug('updateView skipped: no panel or not visible');
            return;
        }
        if (isInitializing) {
            logDebug('updateView deferred: panel still initializing');
            pendingUpdate = true;
            return;
        }
        if (isUpdating) {
            logDebug('updateView skipped: already updating');
            return;
        }
        isUpdating = true;
        logDebug('updateView triggered by debug event');
        updateViewWithStackTrace().finally(() => {
            isUpdating = false;
        });
    };

    context.subscriptions.push(debug.onDidStartDebugSession(updateView));
    context.subscriptions.push(debug.onDidChangeActiveStackItem(updateView));
    context.subscriptions.push(debug.onDidChangeActiveDebugSession(updateView));

    context.subscriptions.push(
        commands.registerCommand('call-graph.show-call-graph', async () => {
            try {
                logInfo('Opening call graph panel');
                if (!currentPanel?.webview) {
                    currentPanel = createWebview(context);
                    currentFrontendRpcChannel = undefined;
                    logDebug('Created new webview panel');
                } else {
                    currentPanel.reveal();
                    logDebug('Revealed existing panel');
                }

                isInitializing = true;

                const comlinkChannel = getComlinkChannel(currentPanel.webview, context);
                Comlink.expose(FrontendApi, comlinkChannel);
                logDebug('FrontendApi exposed via Comlink');

                currentFrontendRpcChannel = Comlink.wrap<ComlinkFrontendApi>(comlinkChannel);
                logDebug('Frontend RPC channel created');

                currentPanel.onDidDispose(() => {
                    logDebug('Webview panel disposed');
                    currentCancellationSource?.cancel();
                    currentCancellationSource?.dispose();
                    currentCancellationSource = undefined;
                    currentPanel = undefined;
                    currentFrontendRpcChannel = undefined;
                });

                currentPanel.webview.html = getVueFrontendPanelContent(context, currentPanel);
                logDebug('Waiting 1s for webview to load');
                await new Promise((resolve) => setTimeout(resolve, 1000));

                isInitializing = false;
                if (pendingUpdate) {
                    logDebug('Triggering deferred update from initialization period');
                    pendingUpdate = false;
                    updateView();
                } else if (debug.activeDebugSession) {
                    logInfo('Active debug session found, loading stacktrace');
                    isUpdating = true;
                    try {
                        await updateViewWithStackTrace();
                    } finally {
                        isUpdating = false;
                    }
                } else {
                    logDebug('No active debug session, skipping stacktrace load');
                }
            } catch (e: unknown) {
                logError('Failed to create panel:', e);
                window.showErrorMessage('failed to create panel: ' + e);
            }
        }),
    );

    context.subscriptions.push(
        commands.registerCommand('call-graph.show-output', () => {
            showOutputChannel();
        }),
    );

    context.subscriptions.push(
        window.registerWebviewPanelSerializer('graph-visualization', {
            deserializeWebviewPanel: async (webviewPanel: WebviewPanel, _state: unknown) => {
                logInfo('Deserializing webview panel');
                currentPanel = webviewPanel;
                await commands.executeCommand('call-graph.show-call-graph');
            },
        }),
    );
}

export async function deactivate(): Promise<void> {
    if (_mcpCleanup) {
        await _mcpCleanup();
    }
}
