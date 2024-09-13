import { commands, debug, ExtensionContext, WebviewPanel, window, workspace } from 'vscode';
import { ComlinkFrontendApi } from 'shared/src/index';
import { getMonacoTheme } from './webview/themes';
import { createWebview, getVueFrontendPanelContent } from './webview/content';
import * as Comlink from "comlink/dist/esm/comlink";
import { getComlinkChannel } from './webview/messaging';
import { getStacktraceInfo } from './debug/callstack-extractor';
import { FrontendApi } from './frontend-functions';

let currentFrontendRpcChannel: Comlink.Remote<ComlinkFrontendApi> | undefined = undefined;

async function updateViewWithStackTrace() {
  try {
    if (!currentFrontendRpcChannel) {
      throw new Error("No rpc channel found");
    }
    const result = await getStacktraceInfo();
    await currentFrontendRpcChannel.setStackTrace(result);
  } catch (e: unknown) {
    window.showErrorMessage("failed to load stacktrace, due to error, please try to open view again. Error: " + e);
  }
}


export async function activate(context: ExtensionContext) {
  let currentPanel: WebviewPanel | undefined = undefined;
  // started debug session
  const updateView = () => {
    if (!currentPanel || !currentPanel.visible) {
      return;
    }
    updateViewWithStackTrace();
  };

  context.subscriptions.push(debug.onDidStartDebugSession(updateView));
  // step into, step out, step over, change active stack item, change active debug session, receive custom event
  context.subscriptions.push(debug.onDidChangeActiveStackItem(updateView));
  // stopped/started/changed debug session
  context.subscriptions.push(debug.onDidChangeActiveDebugSession(updateView));

  context.subscriptions.push(workspace.onDidChangeConfiguration(async event => {
    if (event.affectsConfiguration('workbench.colorTheme')) {
      const theme = await getMonacoTheme();
      await currentFrontendRpcChannel?.setTheme(theme);
    }
  }));

  context.subscriptions.push(commands.registerCommand('call-graph.show-call-graph', async () => {
    try {
      if (!currentPanel?.webview) {
        currentPanel = createWebview(context);
        currentFrontendRpcChannel = undefined;
      } else {
        currentPanel.reveal();
      }

      currentPanel.webview.html = getVueFrontendPanelContent(context, currentPanel);

      // wait for loading
      await new Promise(resolve => setTimeout(resolve, 1000));

      Comlink.expose(FrontendApi, getComlinkChannel(currentPanel.webview, context));

      currentPanel.onDidDispose(() => {
        currentPanel = undefined;
        currentFrontendRpcChannel = undefined;
      });

      currentFrontendRpcChannel = Comlink.wrap<ComlinkFrontendApi>(getComlinkChannel(currentPanel.webview, context));

      // fire and for get - try to set the theme but don't mind if we cant.
      getMonacoTheme().then(theme => currentFrontendRpcChannel?.setTheme(theme).catch(e => window.showErrorMessage("failed to set style in stack trace view due to error:" + e)));

      if (debug.activeDebugSession) {
        await updateViewWithStackTrace();
      }
      // else {
      //   window.showWarningMessage('No active debug session, the view will automatically update when a debug session is started');
      // }
    } catch (e: unknown) {
      window.showErrorMessage("failed, to create panel" + e);
    }
  }));


  context.subscriptions.push(window.registerWebviewPanelSerializer('graph-visualization', {
    deserializeWebviewPanel: async (webviewPanel: WebviewPanel, _state: unknown) => {
      currentPanel = webviewPanel;
      await commands.executeCommand('call-graph.show-call-graph');
    }
  }));
}
