import { commands, debug, ExtensionContext, Selection, TextEditorRevealType, Uri, ViewColumn, Webview, WebviewPanel, window, workspace } from 'vscode';
import { getStacktraceInfo } from './callstack-extractor';
import path from "path";
import { getUri, getNonce } from './webview/helper';
import { VscodeMessage } from './types';
import { getMonacoTheme } from './webview/themes';
import { createWebview, getVueFrontendPanelContent } from './webview/content';



async function showFile(path: string, line: number) {
  const uri = Uri.from({ scheme: 'file', path });
  try {
    const doc = await workspace.openTextDocument(uri);
    const editor = await window.showTextDocument(doc);
    const range = editor.document.lineAt(line ?? 1).range;
    editor.selection = new Selection(range.start, range.end);
    editor.revealRange(range, TextEditorRevealType.InCenter);
  } catch (e) {
    window.showErrorMessage('Error opening file: ' + e);
  }
}

async function updateViewWithStackTrace(panel: Webview) {
  const result = await getStacktraceInfo();
  const vscodeMessage: VscodeMessage = { type: 'stackTrace', data: result };
  await panel.postMessage(vscodeMessage);
}


export async function activate(context: ExtensionContext) {
  let currentPanel: WebviewPanel | undefined = undefined;

  // started debug session
  context.subscriptions.push(debug.onDidStartDebugSession(async (e) => {
    if (currentPanel?.webview) {
      await updateViewWithStackTrace(currentPanel.webview);
    }
  }));

  // step into, step out, step over, change active stack item, change active debug session, receive custom event
  context.subscriptions.push(debug.onDidChangeActiveStackItem(async (e) => {
    if (currentPanel?.webview) {
      await updateViewWithStackTrace(currentPanel.webview);
    }
  }));

  context.subscriptions.push(debug.onDidChangeActiveDebugSession(async (e) => {
    if (currentPanel?.webview) {
      await updateViewWithStackTrace(currentPanel.webview);
    }
  }));

  // todo add stacktrace infos in debug as hover provider
  //context.subscriptions.push(languages.registerHoverProvider({ scheme: 'file' }, {
  //  async provideHover(document, position, token) {
  //    return undefined;
  //    // return new Hover('I am a hover!');
  //  },
  //}));

  workspace.onDidChangeConfiguration(async event => {
    if (event.affectsConfiguration('workbench.colorTheme') && currentPanel?.webview) {
      const themeJson = await getMonacoTheme().catch(() => undefined);
      await currentPanel?.webview?.postMessage({ type: 'theme', data: themeJson } as VscodeMessage);
    }
  });

  commands.registerCommand('call-graph.helloWorld', async () => {
    if (!currentPanel?.webview) {
      currentPanel = createWebview(context);
    } else {
      currentPanel.reveal();
    }

    currentPanel.webview.html = getVueFrontendPanelContent(context, currentPanel);

    const themeJson = await getMonacoTheme().catch(() => undefined);
    await currentPanel.webview.postMessage({ type: 'theme', data: themeJson } as VscodeMessage);

    currentPanel.onDidDispose(() => {
      currentPanel = undefined;
    });

    currentPanel.webview.onDidReceiveMessage(
      async (message: VscodeMessage) => {
        if (message.type === 'openFile') {
          await showFile(message.data.file, message.data.line);
        }
      },
      undefined,
      context.subscriptions
    );

    if (debug.activeDebugSession) {
      await updateViewWithStackTrace(currentPanel.webview);
    } else {
      window.showWarningMessage('No active debug session, the view will automatically update when a debug session is started');
    }
  });
}
