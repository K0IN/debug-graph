import { Uri, Position, debug, workspace, DebugSession } from "vscode";

export async function getCurrentValueForPosition(uri: Uri, line: number, column: number, frameId: number): Promise<string | undefined> {
  const debugSession = debug.activeDebugSession;
  if (!debugSession) {
    return undefined;
  }
  const document = await workspace.openTextDocument(uri);
  const range = document.getWordRangeAtPosition(new Position(line, column));
  const word = document.getText(range);

  if (!word) {
    return undefined;
  }

  const variableInfo = await inspectVariableAtPosition(debugSession, uri, new Position(line, column), word, frameId);
  return variableInfo ? formatVariableInfo(variableInfo) : undefined;
}

interface VariableInfo {
  name: string;
  value: string;
}

async function inspectVariableAtPosition(
  session: DebugSession,
  _uri: Uri,
  _position: Position,
  variableName: string, frameId: number
): Promise<VariableInfo | undefined> {
  try {
    const stackTraceResponse = await session.customRequest('stackTrace', { threadId: debug.activeStackItem?.threadId ?? 1 });
    if (!stackTraceResponse.stackFrames || stackTraceResponse.stackFrames.length === 0) {
      return undefined;
    }

    const frame = stackTraceResponse.stackFrames[0];
    const scopesResponse = await session.customRequest('scopes', { frameId: frameId || frame.id });

    for (const scope of scopesResponse.scopes) {
      const variablesResponse = await session.customRequest('variables', { variablesReference: scope.variablesReference });
      const variable = variablesResponse.variables.find((v: any) => v.name === variableName);

      // todo some things cat be expressed as variables (func refs in python for example)
      // todo sub elements of a variable are not supported yet, only the variable itself
      if (variable) {
        return { name: variable.name, value: variable.value };
      }
    }
  } catch (error) {
    console.error('Error inspecting variable:', error);
  }

  return undefined;
}

function formatVariableInfo(info: VariableInfo): string {
  const result = `${info.name} = ${info.value}\n`;
  return result;
}
