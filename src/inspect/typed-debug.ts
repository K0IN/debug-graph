import { debug } from "vscode";
import type { DebugProtocol } from "@vscode/debugprotocol";

export function callDebug(endpoint: 'stackTrace', param: DebugProtocol.StackTraceArguments): Promise<DebugProtocol.StackTraceResponse['body']>;
export function callDebug(endpoint: 'scopes', param: DebugProtocol.ScopesArguments): Promise<DebugProtocol.ScopesResponse['body']>;
export function callDebug(endpoint: 'evaluate', param: DebugProtocol.EvaluateArguments): Promise<DebugProtocol.EvaluateResponse['body']>;
export function callDebug(endpoint: 'variables', param: DebugProtocol.VariablesArguments): Promise<DebugProtocol.VariablesResponse['body']>;
export function callDebug<T, R>(endpoint: string, param: T) {
  if (!debug.activeDebugSession) {
    throw new Error('No active debug session');
  }
  return debug.activeDebugSession.customRequest(endpoint, param) as Promise<R>;
}