// https://github.com/Microsoft/monaco-editor
// https://github.com/lukejacksonn/monacode
// https://github.com/microsoft/vscode-webview-ui-toolkit
// https://github.com/microsoft/vscode-webview-ui-toolkit-samples/blob/main/default/hello-world/src/webview/main.ts
import monacode from 'https://unpkg.com/browse/monaco-editor@0.50.0/';

const appContainer = document.getElementById('app');

const editor = monacode({
  container: appContainer,
  value: 'const add = (x, y) => x + y;',
});

// Listen for changes within the editor
editor.getModel().onDidChangeContent((change) => {
  const newValue = editor.getValue();
  console.log(newValue);
});
