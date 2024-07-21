import { commands, debug, DebugStackFrame, ExtensionContext, Selection, TextEditorRevealType, Uri, Webview, WebviewPanel, window, workspace } from 'vscode';
import { ComlinkBackendApi, ComlinkFrontendApi } from 'shared/src/index';
import { getMonacoTheme } from './webview/themes';
import { createWebview, getVueFrontendPanelContent } from './webview/content';
import * as Comlink from "comlink/dist/esm/comlink";
import { getComlinkChannel } from './webview/messaging';
import { getCurrentValueForPosition } from './inspector';
import { getStacktraceInfo } from './callstack-extractor';
import { FrontendApi } from './frontend-functions';

let currentFrontendRpcChannel: Comlink.Remote<ComlinkFrontendApi> | undefined = undefined;

async function updateViewWithStackTrace(webview: Webview, context: ExtensionContext) {
  const result = await getStacktraceInfo();
  try {
    await currentFrontendRpcChannel?.setStackTrace(result);
  } catch (e: any) {
    window.showErrorMessage("failed to send stacktrace to ui, try agin");
  }
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
    if (event.affectsConfiguration('workbench.colorTheme') && currentFrontendRpcChannel) {
      const { setTheme } = currentFrontendRpcChannel;
      try {
        const theme = await getMonacoTheme();
        await setTheme(theme);
      } catch (e) {
        console.error(e);
      }
    }
  });

  commands.registerCommand('call-graph.show-call-graph', async () => {
    if (!currentPanel?.webview) {
      currentPanel = createWebview(context);
      currentFrontendRpcChannel = undefined;
    } else {
      currentPanel.reveal();
    }

    currentPanel.webview.html = getVueFrontendPanelContent(context, currentPanel);
    Comlink.expose(FrontendApi, getComlinkChannel(currentPanel.webview, context));

    currentPanel.onDidDispose(() => {
      currentPanel = undefined;
      if (currentFrontendRpcChannel) {
        currentFrontendRpcChannel[Comlink.releaseProxy]();
      }
      currentFrontendRpcChannel = undefined;
    });

    // release current channel if needed
    if (currentFrontendRpcChannel) {
      currentFrontendRpcChannel[Comlink.releaseProxy]();
      currentFrontendRpcChannel = undefined;
    }

    currentFrontendRpcChannel = Comlink.wrap<ComlinkFrontendApi>(getComlinkChannel(currentPanel.webview, context));

    const { setTheme } = currentFrontendRpcChannel;
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
