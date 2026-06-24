/**
 * Module augmentation for VS Code MCP APIs not yet in @types/vscode.
 *
 * These APIs are available in VS Code 1.97+ (insider / stable builds with MCP
 * support).  We augment the `vscode` module here so our extension compiles
 * cleanly while waiting for the DefinitelyTyped package to catch up.
 *
 * See: https://code.visualstudio.com/api/extension-guides/ai/mcp
 */
import * as vscode from 'vscode';

declare module 'vscode' {
    // ── McpStdioServerDefinition ─────────────────────────────────────
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

    // ── McpServerDefinitionProvider ──────────────────────────────────
    export interface McpServerDefinitionProvider {
        onDidChangeMcpServerDefinitions?: vscode.Event<void>;
        provideMcpServerDefinitions(
            token: vscode.CancellationToken,
        ): vscode.ProviderResult<McpStdioServerDefinition[]>;
        resolveMcpServerDefinition?(
            server: McpStdioServerDefinition,
            token: vscode.CancellationToken,
        ): vscode.ProviderResult<McpStdioServerDefinition>;
    }

    // ── namespace lm augmentation ────────────────────────────────────
    export namespace lm {
        export function registerMcpServerDefinitionProvider(
            id: string,
            provider: McpServerDefinitionProvider,
        ): vscode.Disposable;
    }
}
