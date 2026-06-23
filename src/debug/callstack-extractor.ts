import { CancellationToken, debug, DocumentSymbol, Range, SymbolKind, Uri, workspace } from "vscode";
import { executeDocumentSymbolProvider } from "./typed-commands";
import { CallLocation, StackTraceInfo } from "shared/src/index";
import { callDebugFunction } from "../inspect/typed-debug";
import { DebugProtocol } from "@vscode/debugprotocol";
import { logDebug, logWarn } from "../log";

// Concurrency limit for parallel file operations
const MAX_CONCURRENT_FRAMES = 5;
// Timeout for individual frame processing (ms)
const FRAME_TIMEOUT_MS = 5000;
// Timeout for workspace file search (ms)
const FILE_SEARCH_TIMEOUT_MS = 2000;
// Max files to scan in workspace fallback
const MAX_WORKSPACE_FILES = 500;

/**
 * Process promises with limited concurrency
 */
async function pMap<T, U>(items: T[], fn: (item: T) => Promise<U>, concurrency: number): Promise<U[]> {
    const results: U[] = [];
    for (let i = 0; i < items.length; i += concurrency) {
        const batch = items.slice(i, i + concurrency);
        results.push(...(await Promise.all(batch.map(fn))));
    }
    return results;
}

/**
 * Wrap a promise with a timeout
 */
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
        promise.then(
            (val) => { clearTimeout(timer); resolve(val); },
            (err) => { clearTimeout(timer); reject(err); }
        );
    });
}

async function getAllSubnodesForSymbol(symbol: DocumentSymbol): Promise<DocumentSymbol[]> {
    const children = symbol.children ?? [];
    const nested = await Promise.all(children.map(getAllSubnodesForSymbol));
    return children.concat(...nested);
}

async function getAllSymbols(file: Uri): Promise<DocumentSymbol[]> {
    const documentSymbols = await executeDocumentSymbolProvider(file);
    if (!documentSymbols) {
        return [];
    }
    const symbols: DocumentSymbol[] = [];
    for (const symbol of documentSymbols) {
        symbols.push(symbol);
        symbols.push(...await getAllSubnodesForSymbol(symbol));
    }
    return symbols;
}


async function findSymbolForLine(file: Uri, zeroIndexedLine: number) {
    const documentSymbols = await getAllSymbols(file);
    return documentSymbols
        .filter(symbol => symbol.range.start.line <= zeroIndexedLine && zeroIndexedLine <= symbol.range.end.line)
        .sort((a, b) => (a.range.end.line - a.range.start.line) - (b.range.end.line - b.range.start.line));
}


async function getFunctionLocation(file: Uri, name: string, zeroIndexedLine: number): Promise<Range> {
    const documentSymbols = await findSymbolForLine(file, zeroIndexedLine);
    const allFunctions = documentSymbols
        .filter(symbol => symbol.kind === SymbolKind.Function || symbol.kind === SymbolKind.Method || symbol.kind === SymbolKind.Constructor); // avoid getting duplicate symbols

    // in go functions in the stack frame are spelled module.function name, so we WONT find it, best we can do is try to match it and fall back to line number
    const exactMatch = allFunctions.find(symbol => symbol.name === name);

    if (exactMatch && exactMatch.range) {
        return exactMatch.range;
    } else if (allFunctions.length === 1) {
        return allFunctions[0].range;
    } else if (allFunctions.find(symbol => symbol.name.includes(name))) {
        return allFunctions.find(symbol => symbol.name.includes(name))!.range;
    }

    throw new Error("Symbol not found");
}


async function getCodeAtRange(file: Uri, range: Range): Promise<string | undefined> {
    const symbolDoc = await workspace.openTextDocument(file);
    const text = symbolDoc?.getText(range);
    return text ?? undefined;
}


async function getLanguageForFile(file: Uri) {
    const document = await workspace.openTextDocument(file);
    return document.languageId;
}


async function tryGetCallLocation(file: Uri, frame: DebugProtocol.StackFrame, token: CancellationToken) {
    if (token?.isCancellationRequested) { return undefined; }
    const zeroIndexedLine = frame.line - 1;
    const noFunctionLookupSize = 3;
    let symbolLocation: Range | undefined;

    try {
        symbolLocation = await getFunctionLocation(file, frame.name, zeroIndexedLine);
    } catch (e) {
        logWarn("Failed to get function location", e);
        symbolLocation = new Range(Math.max(zeroIndexedLine - noFunctionLookupSize, 0), 0, zeroIndexedLine + noFunctionLookupSize, 99999);
    }

    const code = await getCodeAtRange(file, symbolLocation);

    const line = code
        ? (symbolLocation
            ? zeroIndexedLine - symbolLocation.start.line
            : noFunctionLookupSize)
        : 0;

    const language = await getLanguageForFile(file);

    return <CallLocation>{
        code,
        file: file.path,
        frameId: frame.id,

        language,
        fileLocationOffset: {
            startLine: frame.line - line,
            startCharacter: 0,
        },
        locationInCode: {
            startLine: line,
            startCharacter: 0,
        }
    };
}

async function getCallLocation(frame: DebugProtocol.StackFrame, token: CancellationToken): Promise<CallLocation | undefined> {
    if (!frame.source?.path) {
        logDebug(`getCallLocation: frame ${frame.id} has no source path`);
        return undefined;
    }

    // Try primary path resolution
    try {
        const file = Uri.file(frame.source.path);
        logDebug(`getCallLocation frame ${frame.id}: trying primary path ${frame.source.path}`);
        const location = await tryGetCallLocation(file, frame, token);
        return location;
    } catch (e) {
        logWarn(`getCallLocation frame ${frame.id}: primary path failed`, e);
    }

    // Try alternative path resolution
    try {
        logDebug(`getCallLocation frame ${frame.id}: trying alternative path resolution`);
        const file = Uri.from({ scheme: 'file', path: frame.source.path });
        const location = await tryGetCallLocation(file, frame, token);
        return location;
    } catch (e) {
        logWarn(`getCallLocation frame ${frame.id}: alternative path failed`, e);
    }

    // Fallback - find file by name with timeout and limit
    try {
        logDebug(`getCallLocation frame ${frame.id}: trying workspace file search for ${frame.source.name}`);
        const allFiles = await withTimeout(
            Promise.resolve(workspace.findFiles('**/*', null, MAX_WORKSPACE_FILES)),
            FILE_SEARCH_TIMEOUT_MS,
            'Workspace file search timed out'
        );
        const filesWithSameName = allFiles.filter((file) => frame.source?.name && file.fsPath.endsWith(frame.source?.name));
        logDebug(`getCallLocation frame ${frame.id}: found ${filesWithSameName.length} matching files in workspace`);
        if (filesWithSameName.length === 1) {
            const location = await tryGetCallLocation(filesWithSameName[0], frame, token);
            return location;
        }
    } catch (e) {
        logWarn(`getCallLocation frame ${frame.id}: workspace search failed`, e);
    }

    logDebug(`getCallLocation frame ${frame.id}: returning undefined`);
    return undefined;
}

export async function getStacktraceInfo(token?: CancellationToken): Promise<StackTraceInfo> {
    if (!debug.activeDebugSession) {
        logDebug('getStacktraceInfo: no active debug session');
        return [];
    }

    logDebug('getStacktraceInfo: fetching stack frames');
    const fetchStart = Date.now();
    const stackFrames = await callDebugFunction('stackTrace', { threadId: debug.activeStackItem?.threadId ?? 1, startFrame: 0 });
    logDebug(`getStacktraceInfo: got ${stackFrames.stackFrames.length} frames in ${Date.now() - fetchStart}ms`);

    // Process frames with concurrency limiting and timeout
    const processStart = Date.now();
    const callLocations = await pMap(
        stackFrames.stackFrames,
        async (frame) => {
            if (token?.isCancellationRequested) {
                return undefined;
            }
            return withTimeout(
                getCallLocation(frame, token!),
                FRAME_TIMEOUT_MS,
                `Frame ${frame.id} processing timed out`
            ).catch(e => {
                logWarn(`Failed to process frame ${frame.id}:`, e);
                return undefined;
            });
        },
        MAX_CONCURRENT_FRAMES
    );
    logDebug(`getStacktraceInfo: processed ${callLocations.length} frames in ${Date.now() - processStart}ms`);

    return callLocations.filter(Boolean) as CallLocation[];
}