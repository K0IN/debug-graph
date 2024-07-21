import { ExtensionContext, Webview, window } from "vscode";

import type { Endpoint } from "comlink/dist/esm/comlink";
export function getComlinkChannel(webview: Webview, context: ExtensionContext): Endpoint {
  return {
    addEventListener: (_type: string, listener: any) => webview.onDidReceiveMessage((msg) => listener({ data: msg, type: 'message' }), undefined, context.subscriptions),
    removeEventListener: (_type: string, _listener: any) => { /* nop */ },
    postMessage: (message) => {
      try {
        webview.postMessage(message);
      } catch (e: unknown) {
        window.showErrorMessage(`Failed to post message: ${(e as Error).message}`);
      }
    }
  };
}