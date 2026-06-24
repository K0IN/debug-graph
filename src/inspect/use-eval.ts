import { CancellationToken, Uri, Position, debug, workspace } from 'vscode';
import { ValueLookupResult } from 'shared/src';
import { callDebugFunction, getVariablesRecursive } from './typed-debug';
import { logDebug, logWarn } from '../log';

export async function getValueWithEvalMethod(
    uri: Uri,
    line: number,
    column: number,
    frameId: number,
    token?: CancellationToken,
): Promise<ValueLookupResult> {
    // Check cancellation
    if (token?.isCancellationRequested) {
        logDebug('getValueWithEvalMethod: cancelled (entry)');
        throw new Error('Cancelled');
    }

    const activeDebugSession = debug.activeDebugSession;
    if (!activeDebugSession) {
        logWarn('getValueWithEvalMethod: no active debug session');
        throw new Error('No active debug session');
    }

    logDebug(`getValueWithEvalMethod: uri=${uri.fsPath}, line=${line}, col=${column}, frameId=${frameId}`);
    const startTime = Date.now();

    const document = await workspace.openTextDocument(uri);
    const position = new Position(line, column);
    const range = document.getWordRangeAtPosition(position);

    if (!range) {
        logDebug('getValueWithEvalMethod: no word range at position');
        throw new Error('No variable at the specified position');
    }

    const variableName = document.getText(range);
    const text = document.lineAt(line).text;

    let start = range.start.character;
    while (start > 0 && /[\[\]\w.\'"]/.test(text[start - 1])) {
        start--;
    }

    let end = range.end.character;
    while (end < text.length && /[\w\'"]/.test(text[end])) {
        end++;
    }

    const expression = text.slice(start, end);
    logDebug(`getValueWithEvalMethod: evaluating expression "${expression}"`);
    const result = await callDebugFunction('evaluate', { expression, frameId, context: 'hover' });
    logDebug(
        `getValueWithEvalMethod: evaluate result = "${result.result}" (varsRef=${result.variablesReference}) in ${Date.now() - startTime}ms`,
    );

    if (result.variablesReference) {
        return {
            provider: 'eval',
            formattedValue: result.result,
            variableInfo: await getVariablesRecursive(result.variablesReference, 5, token),
        };
    }

    return {
        provider: 'eval',
        formattedValue: result.result,
        variableInfo: [{ name: variableName, value: result.result, type: result.type }],
    };
}
