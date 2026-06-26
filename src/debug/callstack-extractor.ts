import { CancellationToken, debug, DocumentSymbol, Range, SymbolKind, TextDocument, Uri, workspace } from 'vscode';
import { executeDocumentSymbolProvider } from './typed-commands';
import { CallLocation, StackTraceInfo } from 'shared/src/index';
import { callDebugFunction } from '../inspect/typed-debug';
import { DebugProtocol } from '@vscode/debugprotocol';
import { logDebug, logWarn } from '../log';

// Concurrency limit for parallel file operations
const MAX_CONCURRENT_FRAMES = 10;
// Timeout for individual frame processing (ms)
const FRAME_TIMEOUT_MS = 5000;
// Timeout for workspace file search (ms)
const FILE_SEARCH_TIMEOUT_MS = 2000;
// Max files to scan in workspace fallback
const MAX_WORKSPACE_FILES = 500;
// Cache TTL for workspace file search results
const WORKSPACE_CACHE_TTL_MS = 10000;
// Glob exclude pattern for workspace file search (skip non-project directories)
const WORKSPACE_EXCLUDE =
    '**/{node_modules,.git,.svn,.hg,__pycache__,.venv,venv,.tox,pytest_cache,target,build,dist,.next,.nuxt,go/pkg/mod,vendor}/**';

// Cache for workspace file list to avoid repeated expensive findFiles calls
let workspaceFilesCache: { files: Uri[]; timestamp: number } | undefined;

/** Per-file cache used during a single getStacktraceInfo call to avoid redundant lookups. */
type FileCacheEntry = {
    document: TextDocument;
    symbols: DocumentSymbol[];
};

async function getWorkspaceFilesOnce(): Promise<Uri[]> {
    const now = Date.now();
    if (workspaceFilesCache && now - workspaceFilesCache.timestamp < WORKSPACE_CACHE_TTL_MS) {
        return workspaceFilesCache.files;
    }
    const allFiles = await withTimeout(
        Promise.resolve(workspace.findFiles('**/*', WORKSPACE_EXCLUDE, MAX_WORKSPACE_FILES)),
        FILE_SEARCH_TIMEOUT_MS,
        'Workspace file search timed out',
    );
    workspaceFilesCache = { files: allFiles, timestamp: now };
    return allFiles;
}

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
            (val) => {
                clearTimeout(timer);
                resolve(val);
            },
            (err) => {
                clearTimeout(timer);
                reject(err);
            },
        );
    });
}

async function getAllSubnodesForSymbol(symbol: DocumentSymbol): Promise<DocumentSymbol[]> {
    const children = symbol.children ?? [];
    const nested = await Promise.all(children.map(getAllSubnodesForSymbol));
    return children.concat(...nested);
}

async function getAllSymbolsCached(file: Uri, cache: Map<string, FileCacheEntry>): Promise<DocumentSymbol[]> {
    const key = file.toString();
    let entry = cache.get(key);
    if (!entry) {
        const document = await workspace.openTextDocument(file);
        const documentSymbols = await executeDocumentSymbolProvider(file);
        entry = { document, symbols: documentSymbols ?? [] };
        cache.set(key, entry);
    }
    const symbols: DocumentSymbol[] = [];
    for (const symbol of entry.symbols) {
        symbols.push(symbol);
        symbols.push(...(await getAllSubnodesForSymbol(symbol)));
    }
    return symbols;
}

async function getCodeAtRangeCached(
    file: Uri,
    range: Range,
    cache: Map<string, FileCacheEntry>,
): Promise<string | undefined> {
    const key = file.toString();
    let entry = cache.get(key);
    if (!entry) {
        const document = await workspace.openTextDocument(file);
        entry = { document, symbols: [] };
        cache.set(key, entry);
    }
    const text = entry.document.getText(range);
    return text ?? undefined;
}

function getLanguageForFileCached(file: Uri, cache: Map<string, FileCacheEntry>): string {
    return cache.get(file.toString())?.document.languageId ?? 'plaintext';
}

async function findSymbolForLine(file: Uri, zeroIndexedLine: number, cache: Map<string, FileCacheEntry>) {
    const documentSymbols = await getAllSymbolsCached(file, cache);
    return documentSymbols
        .filter((symbol) => symbol.range.start.line <= zeroIndexedLine && zeroIndexedLine <= symbol.range.end.line)
        .sort((a, b) => a.range.end.line - a.range.start.line - (b.range.end.line - b.range.start.line));
}

async function getFunctionLocation(
    file: Uri,
    name: string,
    zeroIndexedLine: number,
    cache: Map<string, FileCacheEntry>,
): Promise<Range> {
    const documentSymbols = await findSymbolForLine(file, zeroIndexedLine, cache);
    const allFunctions = documentSymbols.filter(
        (symbol) =>
            symbol.kind === SymbolKind.Function ||
            symbol.kind === SymbolKind.Method ||
            symbol.kind === SymbolKind.Constructor,
    ); // avoid getting duplicate symbols

    // in go functions in the stack frame are spelled module.function name, so we WONT find it, best we can do is try to match it and fall back to line number
    const exactMatch = allFunctions.find((symbol) => symbol.name === name);

    if (exactMatch && exactMatch.range) {
        return exactMatch.range;
    } else if (allFunctions.length === 1) {
        return allFunctions[0].range;
    } else {
        const partialMatch = allFunctions.find((symbol) => name.includes(symbol.name));
        if (partialMatch) {
            return partialMatch.range;
        }
    }

    throw new Error('Symbol not found');
}

async function tryGetCallLocation(
    file: Uri,
    frame: DebugProtocol.StackFrame,
    token: CancellationToken,
    fileCache?: Map<string, FileCacheEntry>,
) {
    if (token?.isCancellationRequested) {
        throw new Error('cancelled');
    }
    const zeroIndexedLine = frame.line - 1;
    const noFunctionLookupSize = 3;
    let symbolLocation: Range | undefined;

    try {
        symbolLocation = await getFunctionLocation(file, frame.name, zeroIndexedLine, fileCache ?? new Map());
    } catch (e) {
        logWarn('Failed to get function location', e);
        symbolLocation = new Range(
            Math.max(zeroIndexedLine - noFunctionLookupSize, 0),
            0,
            zeroIndexedLine + noFunctionLookupSize,
            99999,
        );
    }

    const cache = fileCache ?? new Map();
    const code = await getCodeAtRangeCached(file, symbolLocation!, cache);

    const line = code ? (symbolLocation ? zeroIndexedLine - symbolLocation.start.line : noFunctionLookupSize) : 0;

    const language = getLanguageForFileCached(file, cache);

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
        },
    };
}

function stubCallLocation(frame: DebugProtocol.StackFrame): CallLocation {
    return {
        code: '<source not found>',
        file: frame.source?.path ?? '<unknown>',
        frameId: frame.id,
        language: 'plaintext',
        fileLocationOffset: { startLine: 0, startCharacter: 0 },
        locationInCode: { startLine: 0, startCharacter: 0 },
    };
}

async function getCallLocation(
    frame: DebugProtocol.StackFrame,
    token: CancellationToken,
    fileCache?: Map<string, FileCacheEntry>,
): Promise<CallLocation> {
    if (!frame.source?.path) {
        logDebug(`getCallLocation: frame ${frame.id} has no source path`);
        return stubCallLocation(frame);
    }

    // Try primary path resolution
    try {
        const file = Uri.file(frame.source.path);
        logDebug(`getCallLocation frame ${frame.id}: trying primary path ${frame.source.path}`);
        const location = await tryGetCallLocation(file, frame, token, fileCache);
        if (location) {
            return location;
        }
    } catch (e) {
        logWarn(`getCallLocation frame ${frame.id}: primary path failed`, e);
    }

    // Try alternative path resolution
    try {
        logDebug(`getCallLocation frame ${frame.id}: trying alternative path resolution`);
        const file = Uri.from({ scheme: 'file', path: frame.source.path });
        const location = await tryGetCallLocation(file, frame, token, fileCache);
        if (location) {
            return location;
        }
    } catch (e) {
        logWarn(`getCallLocation frame ${frame.id}: alternative path failed`, e);
    }

    // Fallback - find file by name
    try {
        logDebug(`getCallLocation frame ${frame.id}: trying workspace file search for ${frame.source.name}`);
        const allFiles = await getWorkspaceFilesOnce();
        const filesWithSameName = allFiles.filter(
            (file) => frame.source?.name && file.fsPath.endsWith(frame.source?.name),
        );
        logDebug(`getCallLocation frame ${frame.id}: found ${filesWithSameName.length} matching files in workspace`);
        if (filesWithSameName.length === 1) {
            const location = await tryGetCallLocation(filesWithSameName[0], frame, token, fileCache);
            if (location) {
                return location;
            }
        }
    } catch (e) {
        logWarn(`getCallLocation frame ${frame.id}: workspace search failed`, e);
    }

    logDebug(`getCallLocation frame ${frame.id}: returning stub (source not found)`);
    return stubCallLocation(frame);
}

export async function getStacktraceInfo(token?: CancellationToken): Promise<StackTraceInfo> {
    if (!debug.activeDebugSession) {
        logDebug('getStacktraceInfo: no active debug session');
        return [];
    }

    logDebug('getStacktraceInfo: fetching stack frames');
    const fetchStart = Date.now();
    const stackFrames = await callDebugFunction('stackTrace', {
        threadId: debug.activeStackItem?.threadId ?? 1,
        startFrame: 0,
        levels: 200,
    });
    logDebug(`getStacktraceInfo: got ${stackFrames.stackFrames.length} frames in ${Date.now() - fetchStart}ms`);

    // Process frames with concurrency limiting and timeout
    const processStart = Date.now();
    const fileCache = new Map<string, FileCacheEntry>();
    const callLocations = await pMap(
        stackFrames.stackFrames,
        async (frame) => {
            if (token?.isCancellationRequested) {
                return stubCallLocation(frame);
            }
            return withTimeout(
                getCallLocation(frame, token!, fileCache),
                FRAME_TIMEOUT_MS,
                `Frame ${frame.id} processing timed out`,
            ).catch((e) => {
                logWarn(`Failed to process frame ${frame.id}:`, e);
                return stubCallLocation(frame);
            });
        },
        MAX_CONCURRENT_FRAMES,
    );
    logDebug(`getStacktraceInfo: processed ${callLocations.length} frames in ${Date.now() - processStart}ms`);

    return callLocations;
}
