import { DocumentSymbol, Uri, commands } from "vscode";

export async function executeDocumentSymbolProvider(uri: Uri) {
    return await commands.executeCommand<DocumentSymbol[] | undefined>('vscode.executeDocumentSymbolProvider', uri);
}
