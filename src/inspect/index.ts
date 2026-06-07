import type { CancellationToken, Uri } from "vscode";
import { ValueLookupResult } from "shared/src";
import { getValueWithEvalMethod } from "./use-eval";
import { getValueWithLookupMethod } from "./use-lookup";
import { logDebug, logWarn } from "../log";

export async function getCurrentValueForPosition(uri: Uri, line: number, column: number, frameId: number, token?: CancellationToken): Promise<ValueLookupResult | undefined> {
    logDebug(`getCurrentValueForPosition: ${uri.fsPath}:${line}:${column} frameId=${frameId}`);
    const startTime = Date.now();

    logDebug('getCurrentValueForPosition: trying eval method');
    const evalValue = await getValueWithEvalMethod(uri, line, column, frameId, token).catch((e) => {
        logWarn('getCurrentValueForPosition: eval method failed:', e);
        return undefined;
    });
    if (evalValue) {
        logDebug(`getCurrentValueForPosition: eval method returned in ${Date.now() - startTime}ms`);
        return evalValue;
    }

    logDebug('getCurrentValueForPosition: trying lookup method');
    const lookupValue = await getValueWithLookupMethod(uri, line, column, frameId, token).catch((e) => {
        logWarn('getCurrentValueForPosition: lookup method failed:', e);
        return undefined;
    });
    logDebug(`getCurrentValueForPosition: completed in ${Date.now() - startTime}ms, result=${lookupValue ? 'found' : 'not found'}`);
    return lookupValue;
}