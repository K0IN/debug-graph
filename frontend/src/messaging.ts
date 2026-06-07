import type { Endpoint } from "comlink/dist/esm/comlink";
import type { WebviewApi } from "vscode-webview";

// Track frontend-side RPC timing
const pendingCalls = new Map<string, { method: string; startTime: number }>();
let msgCounter = 0;

function extractMethodName(message: unknown): string {
    if (message && typeof message === 'object') {
        const msg = message as Record<string, unknown>;
        if (typeof msg['method'] === 'string') return msg['method'] as string;
        if (typeof msg['type'] === 'string') return msg['type'] as string;
    }
    return 'unknown';
}

export function getComlinkChannel(vscode: WebviewApi<unknown>): Endpoint {
    return {
        addEventListener: (type: string, listener: EventListenerOrEventListenerObject) =>
            window.addEventListener(type, (event: Event) => {
                const msg = (event as MessageEvent).data;
                // Track response arrival for timing
                if (msg && typeof msg === 'object') {
                    const m = msg as Record<string, unknown>;
                    const callId = m['_debugId'];
                    if (typeof callId === 'string') {
                        const pending = pendingCalls.get(callId);
                        if (pending) {
                            const elapsed = Date.now() - pending.startTime;
                            pendingCalls.delete(callId);
                            console.log(`[Debug Graph RPC FE] ${pending.method} response in ${elapsed}ms`);
                        }
                    }
                }
                (listener as EventListener)(event);
            }),
        removeEventListener: (type: string, listener: EventListenerOrEventListenerObject, _options?: {}) =>
            window.removeEventListener(type, listener, _options),
        postMessage: (object: unknown) => {
            const method = extractMethodName(object);
            const callId = `fe_${++msgCounter}`;
            if (object && typeof object === 'object') {
                (object as Record<string, unknown>)['_debugId'] = callId;
            }
            pendingCalls.set(callId, { method, startTime: Date.now() });
            vscode.postMessage(object);
        },
    };
}
