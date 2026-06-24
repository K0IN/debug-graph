import {
    CancellationToken,
    CancellationTokenSource,
    commands,
    debug,
    ExtensionContext,
    lm,
    McpStdioServerDefinition,
    Uri,
    WebviewPanel,
    window,
} from 'vscode';
import { ComlinkFrontendApi } from 'shared/src/index';
import { createWebview, getVueFrontendPanelContent } from './webview/content';
import * as Comlink from 'comlink/dist/esm/comlink';
import { getComlinkChannel } from './webview/messaging';
import { getStacktraceInfo } from './debug/callstack-extractor';
import { FrontendApi } from './frontend-functions';
import { logInfo, logError, logDebug, showOutputChannel } from './log';
import { DebugBridge } from './mcp/debug-bridge';

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
        // Cancel any previous pending update
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
        // Don't show error if it's a cancellation
        if ((e as Error).message?.includes('cancell')) {
            logDebug('updateViewWithStackTrace was cancelled');
            return;
        }
        logError('updateViewWithStackTrace failed:', e);
        window.showErrorMessage('failed to load stacktrace, due to error, please try to open view again. Error: ' + e);
    } finally {
        currentCancellationSource?.dispose();
        currentCancellationSource = undefined;
    }
}

export async function activate(context: ExtensionContext) {
    let currentPanel: WebviewPanel | undefined = undefined;
    let isUpdating = false;
    let isInitializing = false;
    let pendingUpdate = false;

    // ── MCP Debug Bridge ──────────────────────────────────────────────
    const debugBridge = new DebugBridge();
    try {
        await debugBridge.start();
        context.subscriptions.push({ dispose: () => debugBridge.dispose() });
        logInfo(`DebugBridge started on port ${debugBridge.port}`);
    } catch (e) {
        logError('Failed to start DebugBridge, MCP tools will be unavailable:', e);
    }

    // ── MCP Server Definition Provider ────────────────────────────────
    const MCP_PROVIDER_ID = 'debugGraph.mcpProvider';

    context.subscriptions.push(
        lm.registerMcpServerDefinitionProvider(MCP_PROVIDER_ID, {
            provideMcpServerDefinitions: async (_token: CancellationToken) => {
                const serverPath = process.env['VSCODE_MCP_SERVER_PATH']
                    ? Uri.file(process.env['VSCODE_MCP_SERVER_PATH'])
                    : Uri.joinPath(context.extensionUri, 'dist', 'mcp-server.mjs');

                return [
                    new McpStdioServerDefinition(
                        'Debug Graph MCP',
                        process.execPath,
                        [serverPath.fsPath],
                        {
                            DEBUG_BRIDGE_PORT: String(debugBridge.port),
                            DEBUG_GRAPH_VERSION: context.extension.packageJSON.version,
                            ELECTRON_RUN_AS_NODE: '1',
                        },
                        context.extension.packageJSON.version,
                    ),
                ];
            },

            resolveMcpServerDefinition: async (server: McpStdioServerDefinition, _token: CancellationToken) => {
                // The server is already fully configured — just return it.
                // If you needed to prompt for credentials or config, do it here.
                return server;
            },
        }),
    );
    logInfo('MCP server definition provider registered');

    // started debug session
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
    // step into, step out, step over, change active stack item, change active debug session, receive custom event
    context.subscriptions.push(debug.onDidChangeActiveStackItem(updateView));
    // stopped/started/changed debug session
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

                // Set up Comlink channel FIRST, before any wait or debug events
                const comlinkChannel = getComlinkChannel(currentPanel.webview, context);
                Comlink.expose(FrontendApi, comlinkChannel);
                logDebug('FrontendApi exposed via Comlink');

                currentFrontendRpcChannel = Comlink.wrap<ComlinkFrontendApi>(comlinkChannel);
                logDebug('Frontend RPC channel created');

                // Clean up previous panel references
                currentPanel.onDidDispose(() => {
                    logDebug('Webview panel disposed');
                    currentCancellationSource?.cancel();
                    currentCancellationSource?.dispose();
                    currentCancellationSource = undefined;
                    currentPanel = undefined;
                    currentFrontendRpcChannel = undefined;
                });

                // Set HTML and wait for webview to load
                currentPanel.webview.html = getVueFrontendPanelContent(context, currentPanel);
                logDebug('Waiting 1s for webview to load');
                await new Promise((resolve) => setTimeout(resolve, 1000));

                // Handle any debug events that fired during initialization
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

    // Command to show the debug output channel
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
