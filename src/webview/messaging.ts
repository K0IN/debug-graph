import { ExtensionContext, Webview, WebviewPanel } from "vscode";

import type { Endpoint } from "comlink/dist/esm/comlink";
export function getComlinkChannel(webview: Webview, context: ExtensionContext): Endpoint {
  return {
    addEventListener: (_type: string, listener: any) => webview.onDidReceiveMessage((msg) => listener({ data: msg, type: 'message' }), undefined, context.subscriptions),
    removeEventListener: (_type: string, _listener: any) => { },
    postMessage: (message) => webview.postMessage(message)
  };
}