import { ValueLookupResult } from "shared/src";
import { Uri, Position, debug, workspace, DebugSession, window } from "vscode";
import { callDebugFunction } from "./typed-debug";

export async function getValueWithLookupMethod(uri: Uri, line: number, column: number, frameId: number): Promise<ValueLookupResult> {
  const debugSession = debug.activeDebugSession;
  if (!debugSession) {
    throw new Error('No active debug session');
  }
  const document = await workspace.openTextDocument(uri);
  const range = document.getWordRangeAtPosition(new Position(line, column));
  const word = document.getText(range);

  if (!word) {
    throw new Error('No variable at the specified position');
  }

  const variableInfo = await inspectVariableAtPosition(debugSession, uri, new Position(line, column), word, frameId);
  return variableInfo;
}

async function inspectVariableAtPosition(
  session: DebugSession,
  _uri: Uri,
  _position: Position,
  variableName: string, frameId: number
): Promise<ValueLookupResult> {
  const stackTraceResponse = await callDebugFunction('stackTrace', { threadId: debug.activeStackItem?.threadId ?? 1 });
  if (!stackTraceResponse.stackFrames || stackTraceResponse.stackFrames.length === 0) {
    throw new Error('No stack frames');
  }

  const frame = stackTraceResponse.stackFrames[0];
  const scopesResponse = await callDebugFunction('scopes', { frameId: frameId || frame.id });

  for (const scope of scopesResponse.scopes) {
    const variablesResponse = await callDebugFunction('variables', { variablesReference: scope.variablesReference });
    const variable = variablesResponse.variables.find((v: any) => v.name === variableName);

    if (variable) {
      return variable;
    }
  }

  throw new Error('Variable not found');
}

