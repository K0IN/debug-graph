import * as assert from 'assert';
import * as vscode from 'vscode';

export async function executeWithBreakpoints(debugConfig: vscode.DebugConfiguration, breakpoints: vscode.SourceBreakpoint[], timeoutMs = 60_000) {
  vscode.debug.removeBreakpoints(vscode.debug.breakpoints);
  vscode.debug.addBreakpoints(breakpoints);

  const onStackItemChanged = new Promise<void>((resolve, reject) => {
    vscode.debug.onDidChangeActiveStackItem(() => resolve());
    setTimeout(() => reject(), timeoutMs);
  });

  const started = await vscode.debug.startDebugging(undefined, debugConfig);
  assert.ok(started, 'Failed to start debugging');
  await onStackItemChanged; // wait for the first stack frame to be available
}