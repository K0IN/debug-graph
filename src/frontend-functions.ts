import { ComlinkBackendApi } from "shared/src";
import { commands, debug, DebugStackFrame, Selection, TextEditorRevealType, Uri, window, workspace } from "vscode";
import { getCurrentValueForPosition } from "./inspector";

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

async function setDebugFrame(frameId: number) {
  let maxTries = 10;
  while (maxTries-- > 0) {
    const current = (debug.activeStackItem as DebugStackFrame)?.frameId;
    if (!current) {
      return;
    }
    if (current === frameId) {
      break;
    }
    commands.executeCommand('workbench.action.debug.callStackUp');
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}


export const FrontendApi = {
  showFile: (path: string, line: number) => showFile(path, line),
  hover: (path: string, line: number, column: number, frameId: number) => getCurrentValueForPosition(Uri.from({ scheme: 'file', path }), line, column, frameId),
  setFrameId: async (frameId: number) => setDebugFrame(frameId),
} as ComlinkBackendApi;