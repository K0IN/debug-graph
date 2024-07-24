import type { Uri } from "vscode";
import { ValueLookupResult } from "shared/src";
import { getValueWithEvalMethod } from "./use-eval";
import { getValueWithLookupMethod } from "./use-lookup";

export async function getCurrentValueForPosition(uri: Uri, line: number, column: number, frameId: number): Promise<ValueLookupResult | undefined> {
  const evalValue = await getValueWithEvalMethod(uri, line, column, frameId).catch(e => undefined);
  if (evalValue) {
    return evalValue;
  }
  return await getValueWithLookupMethod(uri, line, column, frameId).catch(e => undefined);
}