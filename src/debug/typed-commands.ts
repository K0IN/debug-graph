import { DocumentSymbol, Uri, commands } from "vscode";

export function executeDocumentSymbolProvider(uri: Uri) {
  return commands.executeCommand</* SymbolInformation[] |*/ DocumentSymbol[] | undefined>('vscode.executeDocumentSymbolProvider', uri);
}
