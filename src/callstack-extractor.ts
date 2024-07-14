import { DocumentSymbol, Range, SymbolKind, Uri, workspace } from "vscode";
import { executeDocumentSymbolProvider, executeStacktrace, StackTraceFrame } from "./typed-commands";
import { CallLocation, StackTraceInfo } from "./types";

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


async function convertScriptLineNumberToFunctionLineNumber(file: Uri, zeroIndexedFileLineNumber: number): Promise<number> {
  const documentSymbols = await findSymbolForLine(file, zeroIndexedFileLineNumber);
  if (!documentSymbols) {
    return zeroIndexedFileLineNumber;
  }
  const filteredBySymbolType = documentSymbols.filter(symbol => symbol.kind === SymbolKind.Function || symbol.kind === SymbolKind.Method || symbol.kind === SymbolKind.Constructor);
  const hasCorrection = filteredBySymbolType.length > 0;
  const correctedLine = hasCorrection ? (zeroIndexedFileLineNumber - filteredBySymbolType[0].range.start.line) : zeroIndexedFileLineNumber;
  return correctedLine;
}


async function getFunctionCode(file: Uri, name: string, zeroIndexedLine: number): Promise<string | undefined> {
  const documentSymbols = await findSymbolForLine(file, zeroIndexedLine);
  const symbol = documentSymbols
    .filter(symbol => symbol.kind === SymbolKind.Function || symbol.kind === SymbolKind.Method || symbol.kind === SymbolKind.Constructor)
    .find(symbol => symbol.name === name); // avoid getting duplicate symbols

  if (!symbol) {
    return undefined; // source unknown
  }
  const symbolDoc = await workspace.openTextDocument(file);
  const range = symbol!.range;
  const rangeStart = range.start;
  const rangeEnd = range.end;
  const { line: startLine, character: startCharacter } = rangeStart;
  const { line: endLine, character: endCharacter } = rangeEnd;
  const text = symbolDoc?.getText(new Range(startLine, startCharacter, endLine, endCharacter));
  return text ?? "";

}

async function getLocationCode(file: Uri, line: number) {
  const symbolDoc = await workspace.openTextDocument(file);
  const text = symbolDoc?.getText(new Range(line - 1, 0, line + 1, 0));
  return text;
}


async function getLanguageForFile(file: Uri) {
  const document = await workspace.openTextDocument(file);
  return document.languageId;
}

async function getCallLocation(frame: StackTraceFrame): Promise<CallLocation> {
  const file = Uri.file(frame.source.path);
  const zeroIndexedLine = frame.line - 1;

  let line = await convertScriptLineNumberToFunctionLineNumber(file, zeroIndexedLine);
  let code = await getFunctionCode(file, frame.name, zeroIndexedLine);

  if (!code) {
    // we don't know the code / so we show 3 lines of code where we found the call (if possible), our code will be in the middle line so 
    try {
      code = await getLocationCode(file, zeroIndexedLine);
      line = 1;
    } catch (e) {
      code = "<source unknown>";
      line = 0;
    }
  }

  const language = await getLanguageForFile(file);

  return <CallLocation>{
    code,
    file: file.path,
    language,
    location: {
      startCharacter: 0,
      startLine: line,
    }
  };
}

export async function getStacktraceInfo(): Promise<StackTraceInfo> {
  const stackFrames = await executeStacktrace({ threadId: 1 });
  return await Promise.all(stackFrames.stackFrames.map((frame, index) => getCallLocation(frame)));
}