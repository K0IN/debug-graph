import { commands, debug, ExtensionContext, Selection, TextEditorRevealType, Uri, Webview, WebviewPanel, window, workspace } from 'vscode';
import { getStacktraceInfo } from './callstack-extractor';
import { ComlinkBackendApi, ComlinkFrontendApi } from 'shared/src/index';
import { getMonacoTheme } from './webview/themes';
import { createWebview, getVueFrontendPanelContent } from './webview/content';
// https://github.com/GoogleChromeLabs/comlink
import * as Comlink from "comlink/dist/esm/comlink";
import { getComlinkChannel } from './webview/messaging';

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

async function updateViewWithStackTrace(webview: Webview, context: ExtensionContext) {
  const result = await getStacktraceInfo();
  const remoteFunction = Comlink.wrap<ComlinkFrontendApi>(getComlinkChannel(webview, context));
  await remoteFunction.setStackTrace(result);
}

export async function activate(context: ExtensionContext) {
  let currentPanel: WebviewPanel | undefined = undefined;
  // started debug session
  context.subscriptions.push(debug.onDidStartDebugSession(async (e) => {
    if (currentPanel?.webview) {
      await updateViewWithStackTrace(currentPanel.webview, context);
    }
  }));

  // step into, step out, step over, change active stack item, change active debug session, receive custom event
  context.subscriptions.push(debug.onDidChangeActiveStackItem(async (e) => {
    if (currentPanel?.webview) {
      await updateViewWithStackTrace(currentPanel.webview, context);
    }
  }));

  context.subscriptions.push(debug.onDidChangeActiveDebugSession(async (e) => {
    if (currentPanel?.webview) {
      await updateViewWithStackTrace(currentPanel.webview, context);
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
      const { setTheme } = Comlink.wrap<ComlinkFrontendApi>(getComlinkChannel(currentPanel.webview, context));
      try {
        const theme = await getMonacoTheme();
        await setTheme(theme);
      } catch (e) {
        console.error(e);
      }
    }
  });

  commands.registerCommand('call-graph.helloWorld', async () => {
    if (!currentPanel?.webview) {
      currentPanel = createWebview(context);
    } else {
      currentPanel.reveal();
    }

    currentPanel.webview.html = getVueFrontendPanelContent(context, currentPanel);

    currentPanel.onDidDispose(() => {
      currentPanel = undefined;
    });

    Comlink.expose({
      async showFile(path: string, line: number) {
        await showFile(path, line);
      }
    } as ComlinkBackendApi, getComlinkChannel(currentPanel.webview, context));

    const { setTheme } = Comlink.wrap<ComlinkFrontendApi>(getComlinkChannel(currentPanel.webview, context));
    try {
      const theme = await getMonacoTheme();
      await setTheme(theme);
    } catch (e) {
      console.error(e);
    }

    if (debug.activeDebugSession) {
      await updateViewWithStackTrace(currentPanel.webview, context);
    } else {
      window.showWarningMessage('No active debug session, the view will automatically update when a debug session is started');
    }
  });
}
