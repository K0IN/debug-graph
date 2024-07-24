import { Uri, Position, debug, workspace, DebugSession, window } from "vscode";
import { EvaluateArguments } from "./types";
import { ValueLookupResult } from "shared/src";


export async function getValueWithEvalMethod(uri: Uri, line: number, column: number, frameId: number): Promise<ValueLookupResult> {
  const activeDebugSession = debug.activeDebugSession;

  if (!activeDebugSession) {
    throw new Error('No active debug session');
  }

  const document = await workspace.openTextDocument(uri);
  const position = new Position(line, column);
  let range = document.getWordRangeAtPosition(position);

  if (!range) {
    throw new Error('No variable at the specified position');
  }

  let variableName = document.getText(range);
  let text = document.lineAt(line).text;
  let start = range.start.character;
  let end = range.end.character;

  // Expand to the left
  while (start > 0 && (/\w|\.|\[|\]|\''/.test(text[start - 1]))) {
    start--;
  }

  // Expand to the right
  while (end < text.length && (/\w\''/.test(text[end]))) {
    end++;
  }

  variableName = text.slice(start, end);

  // Use the 'evaluate' request to get the variable value
  const result = await activeDebugSession.customRequest('evaluate', <EvaluateArguments>{
    expression: variableName,
    frameId: frameId,
    context: 'hover'
  });

  if (result.variablesReference) {
    const variablesResponse = await activeDebugSession.customRequest('variables', { variablesReference: result.variablesReference });
    return { type: 'object', value: variablesResponse.variables }; // todo use result
  }

  return { type: 'yes', value: result.result };
}
