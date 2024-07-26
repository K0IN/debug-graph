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
  const range = document.getWordRangeAtPosition(position);

  if (!range) {
    throw new Error('No variable at the specified position');
  }

  const variableName = document.getText(range);
  const text = document.lineAt(line).text;

  let start = range.start.character;
  while (start > 0 && /\w|\.|\[|\]|\'\"'/.test(text[start - 1])) {
    start--;
  }

  let end = range.end.character;
  while (end < text.length && /\w\'\"'/.test(text[end])) {
    end++;
  }

  const expression = text.slice(start, end);
  const result = await callDebugFunction('evaluate', { expression, frameId, context: 'hover' });

  if (result.variablesReference) {
    return {
      provider: "eval",
      formattedValue: result.result,
      variableInfo: await getVariablesRecursive(result.variablesReference, 2)
    };
  }

  return {
    provider: "eval",
    formattedValue: result.result,
    variableInfo: [{ name: variableName, value: result.result, type: result.type }]
  };
}
