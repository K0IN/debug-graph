import { Uri, Position, debug, workspace, Location, DebugSession } from "vscode";

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

  if (variableInfo) {
    return formatVariableInfo(variableInfo);
  }

  return undefined;
}

interface VariableInfo {
  name: string;
  value: string;
  definition?: Location;
  references?: Location[];
}

async function inspectVariableAtPosition(
  session: DebugSession,
  uri: Uri,
  position: Position,
  variableName: string, frameId: number
): Promise<VariableInfo | undefined> {
  try {
    const stackTraceResponse = await session.customRequest('stackTrace', { threadId: 1 });
    if (!stackTraceResponse.stackFrames || stackTraceResponse.stackFrames.length === 0) {
      return undefined;
    }

    const frame = stackTraceResponse.stackFrames[0];
    const scopesResponse = await session.customRequest('scopes', { frameId: frameId || frame.id });

    for (const scope of scopesResponse.scopes) {
      const variablesResponse = await session.customRequest('variables', { variablesReference: scope.variablesReference });
      const variable = variablesResponse.variables.find((v: any) => v.name === variableName);

      // todo some things cat be expressed as variables (func refs in python for example)
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
  let result = `${info.name} = ${info.value}\n`;
  if (info.definition) {
    result += `Defined at: ${info.definition.uri.fsPath}:${info.definition.range.start.line + 1}\n`;
  }
  if (info.references) {
    result += `Used at ${info.references.length} location(s)`;
  }
  return result;
}
