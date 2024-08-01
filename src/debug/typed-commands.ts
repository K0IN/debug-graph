import { DocumentSymbol, Uri, commands, workspace } from "vscode";

export async function executeDocumentSymbolProvider(uri: Uri) {
  try {
    await workspace.openTextDocument(uri);
  } catch (e) {
    // nop
  }
  return await commands.executeCommand</* SymbolInformation[] |*/ DocumentSymbol[] | undefined>('vscode.executeDocumentSymbolProvider', uri);
}
