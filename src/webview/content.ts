import path from 'path';
import { ExtensionContext, WebviewPanel, window, ViewColumn, Uri } from 'vscode';
import { getUri, getNonce } from './helper';

export function getVueFrontendPanelContent(context: ExtensionContext, panel: WebviewPanel) {
    const stylesUri = getUri(panel.webview, context.extensionUri, ['frontend', 'dist', 'assets', 'index.css']);
    const scriptUri = getUri(panel.webview, context.extensionUri, ['frontend', 'dist', 'assets', 'index.js']);
    const nonce = getNonce();

    // Webview URIs for Monaco editor workers (bundled locally in monacoeditorwork/)
    const editorWorkerUri = getUri(panel.webview, context.extensionUri, [
        'frontend',
        'dist',
        'monacoeditorwork',
        'editor.worker.bundle.js',
    ]);
    const tsWorkerUri = getUri(panel.webview, context.extensionUri, [
        'frontend',
        'dist',
        'monacoeditorwork',
        'ts.worker.bundle.js',
    ]);
    const jsonWorkerUri = getUri(panel.webview, context.extensionUri, [
        'frontend',
        'dist',
        'monacoeditorwork',
        'json.worker.bundle.js',
    ]);
    const htmlWorkerUri = getUri(panel.webview, context.extensionUri, [
        'frontend',
        'dist',
        'monacoeditorwork',
        'html.worker.bundle.js',
    ]);
    const cssWorkerUri = getUri(panel.webview, context.extensionUri, [
        'frontend',
        'dist',
        'monacoeditorwork',
        'css.worker.bundle.js',
    ]);

    const csp = [
        `default-src 'none'`,
        `style-src ${panel.webview.cspSource} 'unsafe-inline'`,
        `script-src 'nonce-${nonce}'`,
        `font-src ${panel.webview.cspSource}`,
        `img-src ${panel.webview.cspSource} data:`,
        `connect-src ${panel.webview.cspSource}`,
        `worker-src blob: ${panel.webview.cspSource}`,
    ].join('; ');

    return /*html*/ `<!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <meta http-equiv="Content-Security-Policy" content="${csp}">
          <script nonce="${nonce}">
            self['MonacoEnvironment'] = {
              globalAPI: false,
              getWorkerUrl: function (_moduleId, label) {
                var workerMap = {
                  'editorWorkerService': '${editorWorkerUri}',
                  'typescript': '${tsWorkerUri}',
                  'json': '${jsonWorkerUri}',
                  'html': '${htmlWorkerUri}',
                  'css': '${cssWorkerUri}',
                  'javascript': '${tsWorkerUri}',
                  'less': '${cssWorkerUri}',
                  'scss': '${cssWorkerUri}',
                  'handlebars': '${htmlWorkerUri}',
                  'razor': '${htmlWorkerUri}'
                };
                var result = workerMap[label] || workerMap['editorWorkerService'];
                var currentUrl = String(window.location);
                var currentOrigin = currentUrl.substring(0, currentUrl.length - window.location.hash.length - window.location.search.length - window.location.pathname.length);
                if (result.substring(0, currentOrigin.length) !== currentOrigin) {
                  var js = '/*' + label + '*/importScripts("' + result + '");';
                  var blob = new Blob([js], { type: 'application/javascript' });
                  return URL.createObjectURL(blob);
                }
                return result;
              }
            };
          </script>
          <link rel="stylesheet" type="text/css" href="${stylesUri}">
          <title>Debug-graph</title>
        </head>
        <body>
          <div id="app"></div>
          <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
        </body>
      </html>`;
}

export function createWebview(context: ExtensionContext) {
    return window.createWebviewPanel('graph-visualization', 'Stacktrace Visualization', ViewColumn.Beside, {
        enableScripts: true,
        enableCommandUris: true,
        enableFindWidget: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
            Uri.file(path.join(context.extensionPath, 'frontend', 'dist')),
            Uri.file(path.join(context.extensionPath, 'frontend', 'dist', 'assets')),
            Uri.file(path.join(context.extensionPath, 'frontend', 'dist', 'monacoeditorwork')),
        ],
    });
}
