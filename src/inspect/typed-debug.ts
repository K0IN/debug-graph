import { debug } from "vscode";
import type { DebugProtocol } from "@vscode/debugprotocol";

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