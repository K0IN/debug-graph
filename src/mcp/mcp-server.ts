/// <reference types="node" />

// MCP HTTP server — runs in-process in the extension host.
// Bundled via esbuild into dist/mcp-server.js (CJS, self-contained).
// The extension loads this module with __non_webpack_require__ and passes
// an http.Server to handleStreamableHttp().

import { McpServer } from '@modelcontextprotocol/server';
import { NodeStreamableHTTPServerTransport } from '@modelcontextprotocol/node';
import type { IncomingMessage, ServerResponse } from 'http';
import type { Server } from 'http';
import { z } from 'zod';
import { debug, commands, workspace, SourceBreakpoint, Location, Range, Uri } from 'vscode';
import { callDebugFunction, getVariablesRecursive } from '../inspect/typed-debug';
import type { DebugProtocol } from '@vscode/debugprotocol';

export function handleStreamableHttp(server: Server): void {
    const mcpServer = createMcpServer();

    server.on('request', async (req: IncomingMessage, res: ServerResponse) => {
        if (req.method !== 'POST' || req.url !== '/mcp') {
            res.writeHead(404).end();
            return;
        }

        const transport = new NodeStreamableHTTPServerTransport({
            sessionIdGenerator: undefined,
        });

        await mcpServer.connect(transport);

        res.on('close', () => {
            transport.close();
        });

        await transport.handleRequest(req, res);
    });
}

function createMcpServer(): McpServer {
    const server = new McpServer({
        name: 'debug-graph-mcp',
        version: '0.0.0',
    });

    const ok = (text: string) => ({ content: [{ type: 'text' as const, text }] });
    const fail = (e: unknown) => ({
        content: [{ type: 'text' as const, text: `Error: ${e}` }],
        isError: true as const,
    });
    const json = (data: unknown) => ok(JSON.stringify(data, null, 2));

    // --- Tools ---

    server.registerTool(
        'get_active_session',
        { description: 'Active debug session {id, name, type}, or null.' },
        async () => {
            const session = debug.activeDebugSession;
            if (!session) {return json(null);}
            return json({ id: session.id, name: session.name, type: session.type });
        },
    );

    server.registerTool(
        'get_stack_trace',
        { description: 'Stack frames (id, name, source, line) from the active debug session.' },
        async () => {
            const session = debug.activeDebugSession;
            if (!session) {throw new Error('No active debug session');}
            const stackItem = debug.activeStackItem;
            const threadId = stackItem?.threadId;
            if (!threadId) {throw new Error('No active stack frame thread');}
            return json(await callDebugFunction('stackTrace', { threadId, startFrame: 0, levels: 50 }));
        },
    );

    server.registerTool(
        'get_variables',
        {
            description: 'Variables [{name, value, type}] in the current or specified stack frame.',
            inputSchema: z.object({
                frameId: z.number().optional().describe('Stack frame ID (default: active frame)'),
            }),
        },
        async (args) => {
            if (args.frameId === undefined) {
                const stackItem = debug.activeStackItem;
                if (!stackItem) {throw new Error('No active stack item');}
                const stackFrame = stackItem as { frameId?: number };
                if (stackFrame.frameId === undefined) {throw new Error('No frame ID available');}
                const scopesResponse = await callDebugFunction('scopes', { frameId: stackFrame.frameId });
                if (scopesResponse.scopes.length === 0) {return json([]);}
                const variablesResponse = await callDebugFunction('variables', {
                    variablesReference: scopesResponse.scopes[0].variablesReference,
                });
                return json(variablesResponse.variables.map((v: { name: string; value: string; type?: string }) => ({
                    name: v.name, value: v.value, type: v.type,
                })));
            }
            return json(await getVariablesRecursive(args.frameId, 2));
        },
    );

    server.registerTool(
        'list_breakpoints',
        { description: 'All breakpoints in the workspace.' },
        async () =>
            json(
                debug.breakpoints.map((bp) => ({
                    id: bp.id,
                    enabled: bp.enabled,
                    condition: 'condition' in bp ? (bp as { condition?: string }).condition : undefined,
                    hitCondition: 'hitCondition' in bp ? (bp as { hitCondition?: string }).hitCondition : undefined,
                    logMessage: 'logMessage' in bp ? (bp as { logMessage?: string }).logMessage : undefined,
                })),
            ),
    );

    server.registerTool(
        'evaluate',
        {
            description: 'Evaluate an expression in the paused debug context. Returns the result as a string.',
            inputSchema: z.object({
                expression: z.string().describe('Expression to evaluate (e.g. a variable name, a condition)'),
            }),
        },
        async (args) => {
            const session = debug.activeDebugSession;
            if (!session) {throw new Error('No active debug session');}
            const evaluateArgs: DebugProtocol.EvaluateArguments = {
                expression: args.expression,
                context: 'repl',
            };
            const response = await callDebugFunction('evaluate', evaluateArgs);
            return ok(response.result);
        },
    );

    server.registerTool(
        'start_debug',
        {
            description: 'Start a debug session. Provide a launch config name, or type+name+request.',
            inputSchema: z.object({
                configName: z.string().optional().describe('Name of the launch.json configuration to run'),
                type: z.string().optional().describe('Debugger type (e.g. "node", "python", "go")'),
                name: z.string().optional().describe('Session display name'),
                request: z.string().optional().describe('"launch" or "attach"'),
                program: z.string().optional().describe('Path to the program to debug'),
            }),
        },
        async (args) => {
            let config: string | { type: string; name: string; request: string; [key: string]: unknown };
            if (args.configName) {
                config = args.configName;
            } else if (args.type && args.name && args.request) {
                config = { type: args.type, name: args.name, request: args.request };
                if (args.program) {config.program = args.program;}
            } else {
                throw new Error('Provide configName, or type+name+request');
            }
            const folder = workspace.workspaceFolders?.[0];
            const result = await debug.startDebugging(folder ?? undefined, config);
            return ok(result ? 'Debug session started' : 'Failed to start debug session');
        },
    );

    server.registerTool(
        'set_breakpoint',
        {
            description: 'Set a breakpoint at a file:line. Optionally with condition, hitCondition, or logMessage.',
            inputSchema: z.object({
                file: z.string().describe('Absolute path to the source file'),
                line: z.number().describe('1-based line number'),
                condition: z.string().optional().describe('Expression that must be true to break'),
                hitCondition: z.string().optional().describe('Break after this many hits (e.g. "5")'),
                logMessage: z.string().optional().describe('Message logged instead of breaking'),
            }),
        },
        async (args) => {
            const uri = Uri.file(args.file);
            const bp = new SourceBreakpoint(
                new Location(uri, new Range(args.line - 1, 0, args.line - 1, 0)),
                true,
                args.condition,
                args.hitCondition,
                args.logMessage,
            );
            debug.addBreakpoints([bp]);
            return ok(`Breakpoint set at ${args.file}:${args.line}`);
        },
    );

    server.registerTool('step_over', { description: 'Step to next line (over).' }, async () => {
        try {
            await commands.executeCommand('workbench.action.debug.stepOver');
            return ok('Ok');
        } catch (e) {
            return fail(e);
        }
    });

    server.registerTool('step_into', { description: 'Step into the called function.' }, async () => {
        try {
            await commands.executeCommand('workbench.action.debug.stepInto');
            return ok('Ok');
        } catch (e) {
            return fail(e);
        }
    });

    server.registerTool('step_out', { description: 'Step out of the current function.' }, async () => {
        try {
            await commands.executeCommand('workbench.action.debug.stepOut');
            return ok('Ok');
        } catch (e) {
            return fail(e);
        }
    });

    server.registerTool('resume', { description: 'Continue execution (resume the program).' }, async () => {
        try {
            await commands.executeCommand('workbench.action.debug.continue');
            return ok('Ok');
        } catch (e) {
            return fail(e);
        }
    });

    server.registerTool('pause', { description: 'Pause execution.' }, async () => {
        try {
            await commands.executeCommand('workbench.action.debug.pause');
            return ok('Ok');
        } catch (e) {
            return fail(e);
        }
    });

    server.registerPrompt(
        'debug_session_workflow',
        {
            title: 'Debug Session Workflow',
            description: `Guides the agent through the correct workflow for debugging with this MCP server.

The correct order is:
1. FIRST — Review existing breakpoints with "list_breakpoints".
2. THEN — Set breakpoints using the "set_breakpoint" tool at the file:line(s) you care about.
3. THEN — Start a debug session using the "start_debug" tool.
4. Once the session hits a breakpoint, use "get_stack_trace", "get_variables", "evaluate", "step_over", "step_into", "step_out", or "resume" as needed.

Call this prompt first whenever you need to debug something. It will give you the exact instructions to follow.`,
        },
        () => ({
            messages: [
                {
                    role: 'user' as const,
                    content: {
                        type: 'text' as const,
                        text: `You are about to start a debugging session. Follow this workflow in order:

STEP 1 — Review existing breakpoints
Use the "list_breakpoints" tool first to check for breakpoints that may already exist from your session. Be aware that other breakpoints might be present — make yourself familiar with all currently set breakpoints.

STEP 2 — Set breakpoints
Use the "set_breakpoint" tool to set breakpoints at the file:line(s) you care about before starting the debug session. You can set one or more breakpoints.

STEP 3 — Start debugging
Use the "start_debug" tool with the appropriate configuration (type like "node", "python", "go"; and program path, or a named launch config).

STEP 4 — Interact with the session
Once a breakpoint is hit, you can:
- "get_stack_trace" — see the call stack
- "get_variables" — inspect variable values (optionally pass a frameId)
- "evaluate" — evaluate any expression in the paused context
- "step_over" — advance to the next line
- "step_into" — step into a function call
- "step_out" — finish the current function
- "resume" — continue execution
- "pause" — pause execution at any time

Make sure all breakpoints are set before starting the debug session.`,
                    },
                },
            ],
        }),
    );

    return server;
}
