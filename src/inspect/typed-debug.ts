import { debug } from "vscode";
import type { DebugProtocol } from "@vscode/debugprotocol";
import { VariableInfo } from "shared/src";

export function callDebugFunction(endpoint: 'stackTrace', param: DebugProtocol.StackTraceArguments): Promise<DebugProtocol.StackTraceResponse['body']>;
export function callDebugFunction(endpoint: 'scopes', param: DebugProtocol.ScopesArguments): Promise<DebugProtocol.ScopesResponse['body']>;
export function callDebugFunction(endpoint: 'evaluate', param: DebugProtocol.EvaluateArguments): Promise<DebugProtocol.EvaluateResponse['body']>;
export function callDebugFunction(endpoint: 'variables', param: DebugProtocol.VariablesArguments): Promise<DebugProtocol.VariablesResponse['body']>;
export function callDebugFunction<T, R>(endpoint: string, param: T) {
  if (!debug.activeDebugSession) {
    throw new Error('No active debug session');
  }
  return debug.activeDebugSession.customRequest(endpoint, param) as Promise<R>;
}

export async function getVariablesRecursive(variableRef: number, maxRecursion = 3): Promise<VariableInfo[]> {
  if (maxRecursion <= 0) {
    return [];
  }
  const variablesResponse = await callDebugFunction('variables', { variablesReference: variableRef }).catch(e => ({ variables: [] }));
  const results = await Promise.all(variablesResponse.variables.map(async (variable) => ({
    name: variable.name,
    value: variable.value,
    type: variable.type,
    subVariables: await getVariablesRecursive(variable.variablesReference, maxRecursion - 1).catch(e => [])
  } as VariableInfo)));
  return results;
}