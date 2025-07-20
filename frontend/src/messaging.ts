import type { Endpoint } from "comlink/dist/esm/comlink";
import type { WebviewApi } from "vscode-webview";

export function getComlinkChannel(vscode: WebviewApi<unknown>): Endpoint {
    return {
        addEventListener: (type: string, listener: EventListenerOrEventListenerObject) => window.addEventListener(type, listener),
        removeEventListener: (type: string, listener: EventListenerOrEventListenerObject, _options?: {}) => window.removeEventListener(type, listener, _options),
        postMessage: (object: unknown) => vscode.postMessage(object),
    };
}
