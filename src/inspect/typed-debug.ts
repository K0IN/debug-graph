import { debug } from "vscode";
import type { DebugProtocol } from "@vscode/debugprotocol";
import { VariableInfo } from "shared/src";

export async function callDebugFunction(endpoint: 'stackTrace', param: DebugProtocol.StackTraceArguments): Promise<DebugProtocol.StackTraceResponse['body']>;
export async function callDebugFunction(endpoint: 'scopes', param: DebugProtocol.ScopesArguments): Promise<DebugProtocol.ScopesResponse['body']>;
export async function callDebugFunction(endpoint: 'evaluate', param: DebugProtocol.EvaluateArguments): Promise<DebugProtocol.EvaluateResponse['body']>;
export async function callDebugFunction(endpoint: 'variables', param: DebugProtocol.VariablesArguments): Promise<DebugProtocol.VariablesResponse['body']>;
export async function callDebugFunction<T, R>(endpoint: string, param: T) {
  const debugSession = debug.activeDebugSession;
  if (!debugSession) {
    throw new Error('No active debug session');
  }
  try {
    const result = await debugSession.customRequest(endpoint, param) as Promise<R>;
    return result;
  } catch (e) {
    throw new Error(`Failed to call ${endpoint} due to error: ${e}`);
  }
}

export async function getVariablesRecursive(variableRef: number, maxRecursion = 3): Promise<VariableInfo[]> {
  if (maxRecursion <= 0) {
    return [];
  }
  const variablesResponse = await callDebugFunction('variables', { variablesReference: variableRef }).catch(() => ({ variables: [] }));
  const results = await Promise.all(variablesResponse.variables.map(async (variable) => ({
    name: variable.name,
    value: variable.value,
    type: variable.type,
    subVariables: await getVariablesRecursive(variable.variablesReference, maxRecursion - 1).catch(() => [])
  } as VariableInfo)));
  return results;
}