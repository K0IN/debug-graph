import { Uri, Position, debug, workspace } from "vscode";
import { ValueLookupResult } from "shared/src";
import { callDebugFunction, getVariablesRecursive } from "./typed-debug";

// todo use this: https://github.com/microsoft/vscode/blob/bdde2df59d5ab67254d6489227dafc3b472ad055/src/vs/workbench/contrib/debug/common/debugUtils.ts#L124

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
  while (start > 0 && (/\w|\.|\[|\]|\'\"'/.test(text[start - 1]))) {
    start--;
  }

  // Expand to the right
  while (end < text.length && (/\w\'\"'/.test(text[end]))) {
    end++;
  }

  variableName = text.slice(start, end);

  // Use the 'evaluate' request to get the variable value
  const result = await callDebugFunction('evaluate', { expression: variableName, frameId: frameId, context: 'hover' });

  if (result.variablesReference) {
    return {
      provider: "eval",
      formattedValue: result.result,
      variableInfo: await getVariablesRecursive(result.variablesReference)
    };
  }

  return {
    provider: "eval",
    formattedValue: result.result,
    variableInfo: [{ name: variableName, value: result.result, type: result.type }]
  };
}
