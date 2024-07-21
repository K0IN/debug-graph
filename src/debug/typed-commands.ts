import { DocumentSymbol, Uri, commands, debug } from "vscode";

export async function executeDocumentSymbolProvider(uri: Uri) {
  return await commands.executeCommand</* SymbolInformation[] |*/ DocumentSymbol[] | undefined>(
    'vscode.executeDocumentSymbolProvider',
    uri);
}

export interface StackTraceFrame {
  id: number;
  column: number;
  line: number; // 1 indexed
  name: string;
  source: {
    path: string;
    sourceReference: number;
  };
}

export type StackTraceResponse = {
  stackFrames: StackTraceFrame[];
  totalFrames: number;
};

export async function executeStacktrace<P = any>(args: P = {} as any): Promise<StackTraceResponse> {
  const session = debug.activeDebugSession;
  if (!session) {
    throw new Error("No active debug session");
  }
  return await session.customRequest('stackTrace', args) as StackTraceResponse;
}
