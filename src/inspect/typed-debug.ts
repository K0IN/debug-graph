import { CancellationToken, debug } from 'vscode';
import type { DebugProtocol } from '@vscode/debugprotocol';
import { VariableInfo } from 'shared/src';
import { logDebug, logError } from '../log';

// Timeout for debug adapter requests (ms)
const DEBUG_REQUEST_TIMEOUT_MS = 3000;
// Maximum variables to fetch at each level to prevent memory explosion
const MAX_VARIABLES_PER_LEVEL = 100;
// Maximum recursion depth
const MAX_RECURSION_DEPTH = 3;

/**
 * Wrap a debug request with a timeout
 */
async function callDebugFunctionWithTimeout<T, R>(
    endpoint: string,
    param: T,
    timeoutMs: number = DEBUG_REQUEST_TIMEOUT_MS,
): Promise<R> {
    const debugSession = debug.activeDebugSession;
    if (!debugSession) {
        throw new Error('No active debug session');
    }

    logDebug(`DAP request: ${endpoint} (timeout: ${timeoutMs}ms)`);
    const start = Date.now();

    return new Promise<R>((resolve, reject) => {
        const timer = setTimeout(() => {
            const elapsed = Date.now() - start;
            logError(`DAP request ${endpoint} timed out after ${timeoutMs}ms (elapsed: ${elapsed}ms)`);
            reject(new Error(`Debug request ${endpoint} timed out`));
        }, timeoutMs);

        Promise.resolve(debugSession.customRequest(endpoint, param))
            .then((result: any) => {
                clearTimeout(timer);
                logDebug(`DAP response: ${endpoint} in ${Date.now() - start}ms`);
                resolve(result as R);
            })
            .catch((error: any) => {
                clearTimeout(timer);
                logError(`DAP request ${endpoint} failed after ${Date.now() - start}ms:`, error);
                reject(new Error(`Failed to call ${endpoint} due to error: ${error}`));
            });
    });
}

export async function callDebugFunction(
    endpoint: 'stackTrace',
    param: DebugProtocol.StackTraceArguments,
): Promise<DebugProtocol.StackTraceResponse['body']>;
export async function callDebugFunction(
    endpoint: 'scopes',
    param: DebugProtocol.ScopesArguments,
): Promise<DebugProtocol.ScopesResponse['body']>;
export async function callDebugFunction(
    endpoint: 'evaluate',
    param: DebugProtocol.EvaluateArguments,
): Promise<DebugProtocol.EvaluateResponse['body']>;
export async function callDebugFunction(
    endpoint: 'variables',
    param: DebugProtocol.VariablesArguments,
): Promise<DebugProtocol.VariablesResponse['body']>;
export async function callDebugFunction(endpoint: 'threads', param: {}): Promise<DebugProtocol.ThreadsResponse['body']>;
export async function callDebugFunction<T, R>(endpoint: string, param: T) {
    return callDebugFunctionWithTimeout<T, R>(endpoint, param);
}

export async function getVariablesRecursive(
    variableRef: number,
    maxRecursion = MAX_RECURSION_DEPTH,
    token?: CancellationToken,
    seenRefs?: Set<number>,
): Promise<VariableInfo[]> {
    // Guard against cancellation
    if (token?.isCancellationRequested) {
        logDebug('getVariablesRecursive: cancelled (entry)');
        return [];
    }

    if (maxRecursion <= 0) {
        return [];
    }

    // Guard against DAP adapters that return circular variable references.
    if (seenRefs?.has(variableRef)) {
        logDebug(`getVariablesRecursive: ref=${variableRef} already visited, skipping cycle`);
        return [];
    }
    seenRefs ??= new Set<number>();
    seenRefs.add(variableRef);

    logDebug(
        `getVariablesRecursive: ref=${variableRef}, depth=${MAX_RECURSION_DEPTH - maxRecursion + 1}/${MAX_RECURSION_DEPTH}`,
    );
    const fetchStart = Date.now();

    try {
        const variablesResponse: any = await callDebugFunctionWithTimeout('variables', {
            variablesReference: variableRef,
        }).catch(() => ({ variables: [] }));

        // Limit variables to prevent memory explosion
        const limitedVariables = variablesResponse.variables.slice(0, MAX_VARIABLES_PER_LEVEL);
        logDebug(
            `getVariablesRecursive: ref=${variableRef} got ${limitedVariables.length} variables in ${Date.now() - fetchStart}ms`,
        );

        // Process variables with concurrency limit
        const results: VariableInfo[] = [];
        const concurrencyLimit = 5;

        for (let i = 0; i < limitedVariables.length; i += concurrencyLimit) {
            const batch = limitedVariables.slice(i, i + concurrencyLimit);

            // Check cancellation between batches
            if (token?.isCancellationRequested) {
                logDebug('getVariablesRecursive: cancelled mid-batch');
                break;
            }

            const batchResults = await Promise.all(
                batch.map(async (variable: any) => {
                    const subVariables =
                        variable.variablesReference > 0
                            ? await getVariablesRecursive(
                                  variable.variablesReference,
                                  maxRecursion - 1,
                                  token,
                                  seenRefs,
                              ).catch(() => [])
                            : [];

                    return {
                        name: variable.name,
                        value: variable.value,
                        type: variable.type,
                        subVariables,
                    } as VariableInfo;
                }),
            );

            results.push(...batchResults);
        }

        logDebug(
            `getVariablesRecursive: ref=${variableRef} returning ${results.length} vars in ${Date.now() - fetchStart}ms`,
        );
        return results;
    } catch (e) {
        logError('Failed to fetch variables recursively:', e);
        return [];
    }
}
