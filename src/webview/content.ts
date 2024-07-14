import path from "path";
import { ExtensionContext, WebviewPanel, window, ViewColumn, Uri } from "vscode";
import { getUri, getNonce } from "./helper";

export function getVueFrontendPanelContent(context: ExtensionContext, panel: WebviewPanel) {
  const stylesUri = getUri(panel.webview, context.extensionUri, ["frontend", "dist", "assets", "index.css"]);
  const scriptUri = getUri(panel.webview, context.extensionUri, ["frontend", "dist", "assets", "index.js"]);
  const nonce = getNonce();
  return /*html*/ `<!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <!-- <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${panel.webview.cspSource}; script-src 'nonce-${nonce}';"> -->
          <link rel="stylesheet" type="text/css" href="${stylesUri}">
          <title>Hello World</title>
        </head>
        <body>
          <div id="app"></div>
          <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
        </body>
      </html>`;
}

export function createWebview(context: ExtensionContext) {
  return window.createWebviewPanel('stacktrace', 'Stacktrace Visualization', ViewColumn.Beside, {
    enableScripts: true,
    enableCommandUris: true,
    enableFindWidget: true,
    retainContextWhenHidden: true,
    localResourceRoots: [
      Uri.file(path.join(context.extensionPath, 'frontend', 'dist')),
      Uri.file(path.join(context.extensionPath, 'frontend', 'dist', 'assets')),
    ]
  });
}