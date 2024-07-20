import { commands, debug, ExtensionContext, Position, Selection, TextEditorRevealType, Uri, Webview, WebviewPanel, window, workspace } from 'vscode';
import { ComlinkBackendApi, ComlinkFrontendApi } from 'shared/src/index';
import { getMonacoTheme } from './webview/themes';
import { createWebview, getVueFrontendPanelContent } from './webview/content';
import * as Comlink from "comlink/dist/esm/comlink";
import { getComlinkChannel } from './webview/messaging';
import { getCurrentValueForPosition } from './inspector';
import { getStacktraceInfo } from './callstack-extractor';

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
      showFile: (path: string, line: number) => showFile(path, line),
      hover: async (path: string, line: number, column: number, frameId: number) => {
        console.log("getting hover info for", path, line, column);
        try {
          const test = await getCurrentValueForPosition(Uri.from({ scheme: 'file', path }), line, column, frameId);
          if (!test) { return []; }
          return test;
        } catch (e) {
          console.error(e);
          // 
        }
        return [];
        // if (!test || test.length === 0) {
        //   return {};
        // }
        // // const a = await getCurrentValueForPosition(Uri.from({ scheme: 'file', path }), new Position(line, column)).catch(e => console.error(e));

        // return (test[0].contents as MarkdownString[]).map(c => c.value).join('\n');
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
