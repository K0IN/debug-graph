import { debug, DocumentSymbol, Range, SymbolKind, Uri, workspace } from "vscode";
import { executeDocumentSymbolProvider } from "./typed-commands";
import { CallLocation, StackTraceInfo } from "shared/src/index";
import { callDebugFunction } from "../inspect/typed-debug";
import { DebugProtocol } from "@vscode/debugprotocol";

async function getAllSubnodesForSymbol(symbol: DocumentSymbol) {
  const symbols: DocumentSymbol[] = [];
  if (symbol.children) {
    for (const child of symbol.children) {
      symbols.push(child);
      symbols.push(...await getAllSubnodesForSymbol(child));
    }
  }
  return symbols;
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


async function getCallLocation(frame: DebugProtocol.StackFrame): Promise<CallLocation> {
  if (!frame.source?.path) {
    throw new Error("No source path found for frame");
  }
  const file = Uri.file(frame.source.path);
  const zeroIndexedLine = frame.line - 1;
  const noFunctionLookupSize = 3;

  const symbolLocation = await getFunctionLocation(file, frame.name, zeroIndexedLine)
    .catch(() => undefined);


  const code = symbolLocation
    ? await getCodeAtRange(file, symbolLocation)
    : await getCodeAtRange(file, new Range(zeroIndexedLine - noFunctionLookupSize, 0, zeroIndexedLine + noFunctionLookupSize, 99999));

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


export async function getStacktraceInfo(): Promise<StackTraceInfo> {
  const stackFrames = await callDebugFunction('stackTrace', { threadId: debug.activeStackItem?.threadId ?? 1 });
  return await Promise.all(stackFrames.stackFrames.map((frame) => getCallLocation(frame)));
}