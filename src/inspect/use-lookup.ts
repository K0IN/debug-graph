import { ValueLookupResult } from "shared/src";
import { CancellationToken } from "vscode";
import { Uri, Position, debug, workspace, DebugSession } from "vscode";
import { callDebugFunction, getVariablesRecursive } from "./typed-debug";
import { logDebug, logWarn } from "../log";

export async function getValueWithLookupMethod(uri: Uri, line: number, column: number, frameId: number, token?: CancellationToken): Promise<ValueLookupResult> {
    // Check cancellation
    if (token?.isCancellationRequested) {
        logDebug('getValueWithLookupMethod: cancelled (entry)');
        throw new Error('Cancelled');
    }

    const debugSession = debug.activeDebugSession;
    if (!debugSession) {
        logWarn('getValueWithLookupMethod: no active debug session');
        throw new Error('No active debug session');
    }

    logDebug(`getValueWithLookupMethod: uri=${uri.fsPath}, line=${line}, col=${column}, frameId=${frameId}`);
    const startTime = Date.now();

    const document = await workspace.openTextDocument(uri);
    const range = document.getWordRangeAtPosition(new Position(line, column));
    const word = document.getText(range);

    if (!word) {
        logDebug('getValueWithLookupMethod: no word at position');
        throw new Error('No variable at the specified position');
    }

    logDebug(`getValueWithLookupMethod: looking up variable "${word}"`);
    const variableInfo = await inspectVariableAtPosition(debugSession, uri, new Position(line, column), word, frameId, token);
    logDebug(`getValueWithLookupMethod: completed in ${Date.now() - startTime}ms`);
    return variableInfo;
}

async function inspectVariableAtPosition(
    _session: DebugSession,
    _uri: Uri,
    _position: Position,
    variableName: string, frameId: number, token?: CancellationToken
): Promise<ValueLookupResult> {
    // Check cancellation
    if (token?.isCancellationRequested) {
        throw new Error('Cancelled');
    }

    logDebug(`inspectVariableAtPosition: fetching stacktrace for variable "${variableName}"`);
    const stackTraceResponse = await callDebugFunction('stackTrace', { threadId: debug.activeStackItem?.threadId ?? 1 });
    if (!stackTraceResponse.stackFrames || stackTraceResponse.stackFrames.length === 0) {
        throw new Error('No stack frames');
    }

    const frame = stackTraceResponse.stackFrames[0];
    logDebug(`inspectVariableAtPosition: fetching scopes for frameId=${frameId || frame.id}`);
    const scopesResponse = await callDebugFunction('scopes', { frameId: frameId || frame.id });
    logDebug(`inspectVariableAtPosition: got ${scopesResponse.scopes.length} scopes`);

    for (const scope of scopesResponse.scopes) {
        // Check cancellation between scope iterations
        if (token?.isCancellationRequested) {
            logDebug('inspectVariableAtPosition: cancelled mid-scope');
            throw new Error('Cancelled');
        }

        logDebug(`inspectVariableAtPosition: fetching variables for scope (ref=${scope.variablesReference})`);
        const variablesResponse = await callDebugFunction('variables', { variablesReference: scope.variablesReference });
        const variable = variablesResponse.variables.find((v: any) => v.name === variableName);

        if (variable) {
            logDebug(`inspectVariableAtPosition: found variable "${variableName}" = "${variable.value}"`);
            const result = {
                provider: 'lookup' as const,
                formattedValue: variable.value,
                variableInfo: await getVariablesRecursive(variable.variablesReference, 5, token)
            };
            logDebug(`inspectVariableAtPosition: completed lookup for "${variableName}"`);
            return result;
        }
    }

    logWarn(`inspectVariableAtPosition: variable "${variableName}" not found in any scope`);
    throw new Error('Variable not found');
}

