import { ExtensionContext, Webview, window } from "vscode";

import type { Endpoint } from "comlink/dist/esm/comlink";

// Track message timing to detect slow round trips
const pendingCalls = new Map<string, { method: string; startTime: number }>();
let msgCounter = 0;

function extractMethodName(message: unknown): string {
    if (message && typeof message === 'object') {
        const msg = message as Record<string, unknown>;
        // Comlink wraps calls with {id, type, method, args} or similar
        if (typeof msg['method'] === 'string') { return msg['method'] as string; }
        if (typeof msg['type'] === 'string') { return msg['type'] as string; }
        if (Array.isArray(msg['args'])) { return `args[${msg['args'].length}]`; }
    }
    return 'unknown';
}

export function getComlinkChannel(webview: Webview, context: ExtensionContext): Endpoint {
    return {
        addEventListener: (_type: string, listener: any) =>
            webview.onDidReceiveMessage((msg) => {
                // Track response arrival for timing
                if (msg && typeof msg === 'object') {
                    const m = msg as Record<string, unknown>;
                    const callId = m['id'];
                    if (typeof callId === 'string' || typeof callId === 'number') {
                        const pending = pendingCalls.get(String(callId));
                        if (pending) {
                            const elapsed = Date.now() - pending.startTime;
                            pendingCalls.delete(String(callId));
                            console.log(`[Debug Graph RPC] ${pending.method} response received in ${elapsed}ms`);
                        }
                    }
                }
                listener({ data: msg, type: 'message' });
            }, undefined, context.subscriptions),
        removeEventListener: (_type: string, _listener: any) => { /* nop */ },
        postMessage: (message) => {
            const method = extractMethodName(message);
            const callId = `${++msgCounter}`;
            if (message && typeof message === 'object') {
                (message as Record<string, unknown>)['_debugId'] = callId;
            }
            pendingCalls.set(callId, { method, startTime: Date.now() });
            try {
                webview.postMessage(message);
            } catch (e: unknown) {
                pendingCalls.delete(callId);
                window.showErrorMessage(`Failed to post message: ${(e as Error).message}`);
            }
        }
    };
}