import * as vscode from 'vscode';

declare module 'vscode' {
    export class McpStdioServerDefinition {
        constructor(
            label: string,
            command: string,
            args?: string[],
            env?: Record<string, string | number | null>,
            version?: string,
        );
        readonly label: string;
        readonly command: string;
        readonly args?: readonly string[];
        readonly env?: { readonly [key: string]: string | number | null | undefined };
        readonly version?: string;
    }

    export class McpHttpServerDefinition {
        constructor(label: string, uri: vscode.Uri, headers?: Record<string, string>, version?: string);
        readonly label: string;
        uri: vscode.Uri;
        headers: Record<string, string>;
        readonly version?: string;
    }

    export interface McpServerDefinitionProvider {
        onDidChangeMcpServerDefinitions?: vscode.Event<void>;
        provideMcpServerDefinitions(token: vscode.CancellationToken): vscode.ProviderResult<McpHttpServerDefinition[]>;
        resolveMcpServerDefinition?(
            server: McpHttpServerDefinition,
            token: vscode.CancellationToken,
        ): vscode.ProviderResult<McpHttpServerDefinition>;
    }

    export namespace lm {
        export function registerMcpServerDefinitionProvider(
            id: string,
            provider: McpServerDefinitionProvider,
        ): vscode.Disposable;
    }
}
