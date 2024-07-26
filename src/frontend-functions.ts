import { ComlinkBackendApi } from "shared/src";
import { commands, debug, DebugStackFrame, Selection, TextEditorRevealType, Uri, window, workspace } from "vscode";
import { getCurrentValueForPosition } from "./inspect";

async function showFile(path: string, line: number) {
  try {
    const uri = Uri.from({ scheme: 'file', path });
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
  // in some languages -> as i can see golang -> this function does not work, i think it has todo with the thread id, which i cant set over commands.
  // todo: try to fix this or remove the button in the ui (for golang at least).
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
    await new Promise(resolve => setTimeout(resolve, 1_000));
  }
}


export const FrontendApi = {
  showFile: (path: string, line: number) => showFile(path, line),
  getValueForPosition: (path: string, line: number, column: number, frameId: number) => getCurrentValueForPosition(Uri.from({ scheme: 'file', path }), line, column, frameId),
  setFrameId: (frameId: number) => setDebugFrame(frameId),
} as ComlinkBackendApi;