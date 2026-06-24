import * as net from 'net';
import { debug, commands, workspace, SourceBreakpoint, Location, Range, Uri } from 'vscode';
import { expose } from 'comlink';
import { callDebugFunction, getVariablesRecursive } from '../inspect/typed-debug';
import { logDebug, logError, logInfo } from '../log';
import type { DebugProtocol } from '@vscode/debugprotocol';
import type { VariableInfo } from 'shared/src/index';

// ── Public API interface exposed via Comlink ──────────────────────────

export interface StackFrameInfo {
    id: number;
    name: string;
    source?: { name?: string; path?: string };
    line: number;
    column: number;
}

export interface StackTraceResult {
    stackFrames: StackFrameInfo[];
    totalFrames?: number;
}

export interface BreakpointInfo {
    id: string;
    enabled: boolean;
    condition?: string;
    hitCondition?: string;
    logMessage?: string;
}

export interface DebugApi {
    getActiveSession(): { id: string; name: string; type: string } | null;
    getStackTraces(): Promise<StackTraceResult>;
    getVariables(params: { frameId?: number }): Promise<VariableInfo[]>;
    evaluate(params: { expression: string; frameId?: number }): Promise<string>;
    getBreakpoints(): BreakpointInfo[];
    startDebug(params: { configName?: string; type?: string; name?: string; request?: string; program?: string }): Promise<string>;
    setBreakpoint(params: { file: string; line: number; condition?: string; hitCondition?: string; logMessage?: string }): Promise<string>;
    stepOver(): Promise<void>;
    stepInto(): Promise<void>;
    stepOut(): Promise<void>;
    resume(): Promise<void>;
    pause(): Promise<void>;
}

// ── Comlink transport helpers ─────────────────────────────────────────

/**
 * Translates a Comlink `Endpoint` (MessagePort-like) into a Comlink-compatible
 * transport over a raw TCP socket. Messages are framed as JSON + newline.
 *
 * Mirrors the logic of `node-adapter` from Comlink but adapted for net.Socket.
 */
function comlinkEndpointFromSocket(socket: net.Socket) {
    const listeners = new Set<(event: { data: unknown }) => void>();
    let buffer = '';

    socket.on('data', (chunk: Buffer) => {
        buffer += chunk.toString('utf-8');
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) {continue;}
            try {
                const msg = JSON.parse(trimmed);
                for (const listener of listeners) {
                    listener({ data: msg });
                }
            } catch {
                // Non-JSON — skip
            }
        }
    });

    socket.on('close', () => listeners.clear());
    socket.on('error', () => listeners.clear());

    return {
        postMessage(msg: unknown) {
            socket.write(JSON.stringify(msg) + '\n');
        },
        addEventListener(_type: string, eh: (event: { data: unknown }) => void) {
            listeners.add(eh);
        },
        removeEventListener(_type: string, eh: (event: { data: unknown }) => void) {
            listeners.delete(eh);
        },
        start() {
            // socket is already open
        },
    };
}

// ── Bridge Server (runs inside extension host) ────────────────────────

export class DebugBridge {
    private server: net.Server | undefined;
    private _port = 0;

    get port(): number {
        return this._port;
    }

    async start(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.server = net.createServer({ allowHalfOpen: false }, (socket) => {
                this.handleSocket(socket);
            });

            this.server.on('error', (err) => {
                logError('DebugBridge server error:', err);
                reject(err);
            });

            // Bind to a random port on localhost
            this.server.listen(0, '127.0.0.1', () => {
                const addr = this.server?.address();
                if (addr && typeof addr === 'object') {
                    this._port = addr.port;
                    logInfo(`DebugBridge listening on 127.0.0.1:${this._port}`);
                }
                resolve();
            });
        });
    }

    dispose(): void {
        this.server?.close();
        this.server = undefined;
    }

    // ── Socket handling ───────────────────────────────────────────────

    private handleSocket(socket: net.Socket): void {
        logDebug('DebugBridge: client connected');
        const endpoint = comlinkEndpointFromSocket(socket);
        expose(this.api, endpoint);
        logDebug('DebugBridge: Comlink API exposed on socket');
    }

    // ── Debug API implementation ──────────────────────────────────────

    private api: DebugApi = {
        getActiveSession: () => {
            const session = debug.activeDebugSession;
            if (!session) { return null; }
            return { id: session.id, name: session.name, type: session.type };
        },

        getStackTraces: async () => {
            const session = debug.activeDebugSession;
            if (!session) { throw new Error('No active debug session'); }

            const stackItem = debug.activeStackItem;
            const threadId = stackItem?.threadId;
            if (!threadId) { throw new Error('No active stack frame thread'); }

            return callDebugFunction('stackTrace', {
                threadId,
                startFrame: 0,
                levels: 50,
            });
        },

        getVariables: async (params) => {
            const { frameId } = params ?? {};

            if (frameId === undefined) {
                const stackItem = debug.activeStackItem;
                if (!stackItem) { throw new Error('No active stack item'); }

                const stackFrame = stackItem as { frameId?: number };
                if (stackFrame.frameId === undefined) { throw new Error('No frame ID available'); }

                const scopesResponse = await callDebugFunction('scopes', {
                    frameId: stackFrame.frameId,
                });

                if (scopesResponse.scopes.length === 0) { return []; }

                const variablesResponse = await callDebugFunction('variables', {
                    variablesReference: scopesResponse.scopes[0].variablesReference,
                });

                return variablesResponse.variables.map((v) => ({
                    name: v.name,
                    value: v.value,
                    type: v.type,
                }));
            }

            return getVariablesRecursive(frameId, 2);
        },

        evaluate: async (params) => {
            const session = debug.activeDebugSession;
            if (!session) { throw new Error('No active debug session'); }

            const evaluateArgs: DebugProtocol.EvaluateArguments = {
                expression: params.expression,
                frameId: params.frameId,
                context: 'repl',
            };

            const response = await callDebugFunction('evaluate', evaluateArgs);
            return response.result;
        },

        getBreakpoints: () => {
            return debug.breakpoints.map((bp) => ({
                id: bp.id,
                enabled: bp.enabled,
                condition: ('condition' in bp ? (bp as { condition?: string }).condition : undefined),
                hitCondition: ('hitCondition' in bp ? (bp as { hitCondition?: string }).hitCondition : undefined),
                logMessage: ('logMessage' in bp ? (bp as { logMessage?: string }).logMessage : undefined),
            }));
        },

        startDebug: async (params) => {
            let config: string | { type: string; name: string; request: string; [key: string]: unknown };

            if (params.configName) {
                config = params.configName;
            } else if (params.type && params.name && params.request) {
                config = { type: params.type, name: params.name, request: params.request };
            if (params.program) { config.program = params.program; }
            } else {
                throw new Error('Provide configName, or type+name+request');
            }

            const folder = workspace.workspaceFolders?.[0];
            const ok = await debug.startDebugging(folder ?? undefined, config);
            return ok ? 'Debug session started' : 'Failed to start debug session';
        },

        setBreakpoint: async (params) => {
            const uri = Uri.file(params.file);
            const bp = new SourceBreakpoint(
                new Location(uri, new Range(params.line - 1, 0, params.line - 1, 0)),
                true,
                params.condition,
                params.hitCondition,
                params.logMessage,
            );
            debug.addBreakpoints([bp]);
            return `Breakpoint set at ${params.file}:${params.line}`;
        },

        stepOver: async () => { await commands.executeCommand('workbench.action.debug.stepOver'); },
        stepInto: async () => { await commands.executeCommand('workbench.action.debug.stepInto'); },
        stepOut: async () => { await commands.executeCommand('workbench.action.debug.stepOut'); },
        resume: async () => { await commands.executeCommand('workbench.action.debug.continue'); },
        pause: async () => { await commands.executeCommand('workbench.action.debug.pause'); },
    };
}
