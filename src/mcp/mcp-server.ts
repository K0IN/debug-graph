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
import { debug, commands, workspace, SourceBreakpoint, FunctionBreakpoint, Location, Range, Uri } from 'vscode';
import { callDebugFunction } from '../inspect/typed-debug';
import type { DebugProtocol } from '@vscode/debugprotocol';

export function handleStreamableHttp(server: Server): void {
    const mcpServer = createMcpServer();

    server.on('request', async (req: IncomingMessage, res: ServerResponse) => {
        if (req.url === '/mcp' && req.method !== 'POST') {
            res.writeHead(405, { Allow: 'POST' }).end();
            return;
        }
        if (req.url !== '/mcp') {
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
    const RESTART_TIMEOUT_MS = 5000;
    const WAIT_BREAKPOINT_TIMEOUT_MS = 30000;
    const json = (data: unknown) => {
        const base: { content: { type: 'text'; text: string }[]; structuredContent?: Record<string, unknown> } = {
            content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
        };
        if (data !== null && data !== undefined) {
            base.structuredContent = data as Record<string, unknown>;
        }
        return base;
    };

    server.registerTool(
        'get_active_session',
        {
            title: 'Get Active Debug Session',
            annotations: { readOnlyHint: true },
            description:
                'Show the current debug session. Returns {id, name, type, configuration} or null if none is running.',
            outputSchema: z
                .object({
                    id: z.string(),
                    name: z.string(),
                    type: z.string(),
                })
                .passthrough()
                .nullable(),
        },
        async () => {
            const session = debug.activeDebugSession;
            if (!session) {
                return json(null);
            }
            return json({
                id: session.id,
                name: session.name,
                type: session.type,
                configuration: session.configuration,
            });
        },
    );

    server.registerTool(
        'list_debug_configs',
        {
            title: 'List Debug Configurations',
            annotations: { readOnlyHint: true },
            description:
                'List available debug configurations from .vscode/launch.json. Returns [{name, type, request, program?, ...}]. Use a configName from this list with start_debug.',
            outputSchema: z.array(
                z
                    .object({
                        name: z.string().optional(),
                        type: z.string().optional(),
                        request: z.string().optional(),
                    })
                    .passthrough(),
            ),
        },
        async () => {
            const folders = workspace.workspaceFolders;
            if (!folders || folders.length === 0) {
                return json([]);
            }
            const configs: unknown[] = [];
            for (const folder of folders) {
                const launchPath = Uri.joinPath(folder.uri, '.vscode', 'launch.json');
                try {
                    const content = await workspace.fs.readFile(launchPath);
                    const parsed = JSON.parse(new TextDecoder().decode(content));
                    if (parsed.configurations && Array.isArray(parsed.configurations)) {
                        configs.push(...parsed.configurations);
                    }
                } catch {
                    // No launch.json or unparseable — skip this folder
                }
            }
            // Validate output against outputSchema by returning json.
            // Include a hint in the text content when empty, but always return valid array.
            const result = json(configs);
            if (configs.length === 0) {
                result.content = [
                    {
                        type: 'text' as const,
                        text: 'No launch.json found or empty. You can still use start_debug with manual type+name+request+program.',
                    },
                ];
            }
            return result;
        },
    );

    server.registerTool(
        'get_stack_trace',
        {
            title: 'Get Call Stack',
            annotations: { readOnlyHint: true },
            description:
                'Show the call stack for the paused program. Returns {stackFrames: [{id, name, source: {path, name}, line, column}]}. Omit threadId to use the active thread, or pass one from list_threads.',
            inputSchema: z.object({
                threadId: z.number().optional().describe('Thread ID from list_threads. Omit for the active thread.'),
            }),
            outputSchema: z.object({
                stackFrames: z.array(
                    z.object({
                        id: z.union([z.number(), z.string()]),
                        name: z.string(),
                        source: z
                            .object({
                                name: z.string().optional(),
                                path: z.string().optional(),
                            })
                            .optional(),
                        line: z.number(),
                        column: z.number(),
                    }),
                ),
                totalFrames: z.number().optional(),
            }),
        },
        async (args) => {
            const session = debug.activeDebugSession;
            if (!session) {
                return fail('No active debug session');
            }
            const threadId = args.threadId ?? debug.activeStackItem?.threadId;
            if (!threadId) {
                return fail('No thread ID — pass one or make sure the program is paused');
            }
            try {
                return json(await callDebugFunction('stackTrace', { threadId, startFrame: 0, levels: 50 }));
            } catch (e) {
                return fail(e);
            }
        },
    );

    server.registerTool(
        'list_threads',
        {
            title: 'List Threads',
            annotations: { readOnlyHint: true },
            description:
                'List all threads in the debugged program. Returns {threads: [{id, name}]}. Use a threadId from this list with get_stack_trace.',
            outputSchema: z.object({
                threads: z.array(
                    z
                        .object({
                            id: z.number(),
                            name: z.string(),
                        })
                        .passthrough(),
                ),
            }),
        },
        async () => {
            const session = debug.activeDebugSession;
            if (!session) {
                return fail('No active debug session');
            }
            try {
                return json(await callDebugFunction('threads', {}));
            } catch (e) {
                return fail(`Failed to list threads: ${e}. Some debug adapters may not support this.`);
            }
        },
    );

    server.registerTool(
        'get_variables',
        {
            title: 'Get Variables',
            annotations: { readOnlyHint: true },
            description:
                'Show variables from ALL scopes (Local, Global, Closure). Pass a frameId from get_stack_trace, or omit for the active frame. Returns [{scope, name, value, type}].',
            inputSchema: z.object({
                frameId: z.number().optional().describe('Frame ID from get_stack_trace. Omit for the active frame.'),
            }),
            outputSchema: z.array(
                z.object({
                    scope: z.string(),
                    name: z.string(),
                    value: z.string(),
                    type: z.string().optional(),
                }),
            ),
        },
        async (args) => {
            try {
                const stackItem = debug.activeStackItem;
                if (!stackItem) {
                    return fail('No active stack item');
                }
                const stackFrame = stackItem as { frameId?: number };
                const frameId = args.frameId ?? stackFrame.frameId;
                if (frameId === undefined) {
                    return fail('No frame ID available');
                }
                const scopesResponse = await callDebugFunction('scopes', { frameId: frameId });
                if (scopesResponse.scopes.length === 0) {
                    return json([]);
                }
                const allVars: { scope: string; name: string; value: string; type?: string }[] = [];
                for (const scope of scopesResponse.scopes) {
                    const variablesResponse = await callDebugFunction('variables', {
                        variablesReference: scope.variablesReference,
                    });
                    for (const v of variablesResponse.variables) {
                        allVars.push({
                            scope: scope.name,
                            name: v.name,
                            value: v.value,
                            type: v.type,
                        });
                    }
                }
                return json(allVars);
            } catch (e) {
                return fail(e);
            }
        },
    );

    server.registerTool(
        'list_breakpoints',
        {
            title: 'List Breakpoints',
            annotations: { readOnlyHint: true },
            description:
                'List all breakpoints that are already set. Returns [{id, enabled, file?, line?, functionName?, condition?, hitCondition?, logMessage?}].',
            outputSchema: z.array(
                z.object({
                    id: z.string(),
                    enabled: z.boolean(),
                    file: z.string().optional(),
                    line: z.number().optional(),
                    functionName: z.string().optional(),
                    condition: z.string().optional(),
                    hitCondition: z.string().optional(),
                    logMessage: z.string().optional(),
                }),
            ),
        },
        async () => {
            try {
                const breakpoints = debug.breakpoints.map((bp) => {
                    const base = {
                        id: bp.id,
                        enabled: bp.enabled,
                        condition: 'condition' in bp ? (bp as { condition?: string }).condition : undefined,
                        hitCondition: 'hitCondition' in bp ? (bp as { hitCondition?: string }).hitCondition : undefined,
                        logMessage: 'logMessage' in bp ? (bp as { logMessage?: string }).logMessage : undefined,
                    };
                    if (bp instanceof SourceBreakpoint && bp.location) {
                        return {
                            ...base,
                            file: bp.location.uri.fsPath,
                            line: bp.location.range.start.line + 1,
                        };
                    }
                    if (bp instanceof FunctionBreakpoint) {
                        return {
                            ...base,
                            functionName: bp.functionName,
                        };
                    }
                    return base;
                });
                return json(breakpoints);
            } catch (e) {
                return fail(e);
            }
        },
    );

    server.registerTool(
        'evaluate',
        {
            title: 'Evaluate Expression',
            annotations: { destructiveHint: true },
            description:
                'Run an expression in the paused program and return the result as a string. WARNING: The expression actually executes in the debugged program — assignments and function calls have real side effects. Prefer get_variables for read-only inspection.',
            inputSchema: z.object({
                expression: z
                    .string()
                    .describe(
                        'Expression to evaluate in the paused context, e.g. "myVar" or "myVar.length > 0". Avoid mutations like "x++" or calling functions with side effects.',
                    ),
                frameId: z
                    .number()
                    .optional()
                    .describe(
                        "Frame ID from get_stack_trace. Evaluate in this frame's context. Omit for the active frame.",
                    ),
            }),
            outputSchema: z.string(),
        },
        async (args) => {
            const session = debug.activeDebugSession;
            if (!session) {
                return fail('No active debug session');
            }
            try {
                const evaluateArgs: DebugProtocol.EvaluateArguments = {
                    expression: args.expression,
                    context: 'repl',
                };
                if (args.frameId !== undefined) {
                    evaluateArgs.frameId = args.frameId;
                }
                const response = await callDebugFunction('evaluate', evaluateArgs);
                return json(response.result);
            } catch (e) {
                return fail(e);
            }
        },
    );

    server.registerTool(
        'start_debug',
        {
            title: 'Start Debug Session',
            annotations: { destructiveHint: true },
            description:
                'Start debugging. Use a configName from list_debug_configs, or build one with type + name + request + program. Returns {id, name, type, configuration} on success. Check get_active_session first to avoid duplicate sessions.',
            inputSchema: z.object({
                configName: z.string().optional().describe('Name of the launch.json debug config to run.'),
                type: z.string().optional().describe('Debugger type, such as "node", "python", or "go".'),
                name: z.string().optional().describe('Session display name'),
                request: z.string().optional().describe('"launch" or "attach"'),
                program: z.string().optional().describe('Path to the program to debug'),
                args: z.array(z.string()).optional().describe('Command-line arguments passed to the program'),
                env: z.record(z.string(), z.string()).optional().describe('Environment variables for the program'),
                cwd: z.string().optional().describe('Working directory for the program'),
                runtimeExecutable: z.string().optional().describe('Runtime executable path (e.g. node, python).'),
                runtimeArgs: z.array(z.string()).optional().describe('Arguments for the runtime executable.'),
                console: z
                    .string()
                    .optional()
                    .describe('Console type, e.g. "internalConsole" or "integratedTerminal".'),
                stopOnEntry: z.boolean().optional().describe('Stop at the program entry point.'),
            }),
            outputSchema: z.object({
                id: z.string(),
                name: z.string(),
                type: z.string(),
            }),
        },
        async (args) => {
            try {
                let config: string | { type: string; name: string; request: string; [key: string]: unknown };
                if (args.configName) {
                    config = args.configName;
                } else if (args.type && args.name && args.request) {
                    config = { type: args.type, name: args.name, request: args.request };
                    if (args.program) {
                        config.program = args.program;
                    }
                    if (args.args) {
                        config.args = args.args;
                    }
                    if (args.env) {
                        config.env = args.env;
                    }
                    if (args.cwd) {
                        config.cwd = args.cwd;
                    }
                    if (args.runtimeExecutable) {
                        config.runtimeExecutable = args.runtimeExecutable;
                    }
                    if (args.runtimeArgs) {
                        config.runtimeArgs = args.runtimeArgs;
                    }
                    if (args.console) {
                        config.console = args.console;
                    }
                    if (args.stopOnEntry !== undefined) {
                        config.stopOnEntry = args.stopOnEntry;
                    }
                } else {
                    return fail('Provide configName, or type+name+request');
                }
                const folder = workspace.workspaceFolders?.[0];
                const started = await debug.startDebugging(folder ?? undefined, config);
                if (!started) {
                    return fail('Failed to start debug session — check the config and adapter');
                }
                // debug.startDebugging returns boolean — read the active session after it starts
                const session = debug.activeDebugSession!;
                return json({ id: session.id, name: session.name, type: session.type });
            } catch (e) {
                return fail(e);
            }
        },
    );

    server.registerTool(
        'restart',
        {
            title: 'Restart Debug Session',
            annotations: { destructiveHint: true },
            description:
                'Stop the current session, wait for it to end, then start debugging with the same configName. Returns {id, name, type} on success.',
            inputSchema: z.object({
                configName: z.string().describe('Name of the launch.json debug config to restart with.'),
            }),
            outputSchema: z.object({
                id: z.string(),
                name: z.string(),
                type: z.string(),
            }),
        },
        async (args) => {
            const oldSession = debug.activeDebugSession;
            if (oldSession) {
                try {
                    await commands.executeCommand('workbench.action.debug.stop');
                } catch {
                    // Session may already be gone
                }
                // Wait up to 5s for the session to actually terminate
                const ended = await new Promise<boolean>((resolve) => {
                    const t = setTimeout(() => {
                        sub.dispose();
                        resolve(false);
                    }, RESTART_TIMEOUT_MS);
                    const sub = debug.onDidTerminateDebugSession((s) => {
                        if (s.id === oldSession.id) {
                            clearTimeout(t);
                            sub.dispose();
                            resolve(true);
                        }
                    });
                });
                if (!ended) {
                    return fail('Previous session did not end within 5s. Try "stop_debug" manually first.');
                }
            }
            try {
                const folder = workspace.workspaceFolders?.[0];
                const started = await debug.startDebugging(folder ?? undefined, args.configName);
                if (!started) {
                    return fail('Failed to restart — check the config and adapter');
                }
                const session = debug.activeDebugSession!;
                return json({ id: session.id, name: session.name, type: session.type });
            } catch (e) {
                return fail(e);
            }
        },
    );

    server.registerTool(
        'disconnect',
        {
            title: 'Disconnect',
            annotations: { destructiveHint: true },
            description:
                'Disconnect from the debug session without terminating the debugged program. Use instead of stop_debug when you want the program to keep running.',
        },
        async () => {
            try {
                await commands.executeCommand('workbench.action.debug.disconnect');
                return ok('Disconnected');
            } catch (e) {
                return fail(e);
            }
        },
    );

    server.registerTool(
        'get_source',
        {
            title: 'Get Source Code',
            annotations: { readOnlyHint: true },
            description:
                'Read source code from a file in the workspace. Pass a file path (absolute) and optionally a line range. Returns the file content as text.',
            inputSchema: z.object({
                file: z.string().describe('Absolute path to the source file.'),
                startLine: z
                    .number()
                    .optional()
                    .describe('1-based start line (inclusive). Omit to read the whole file.'),
                endLine: z.number().optional().describe('1-based end line (inclusive). Omit to read to end.'),
            }),
            outputSchema: z.string(),
        },
        async (args) => {
            try {
                const uri = Uri.file(args.file);
                const content = new TextDecoder().decode(await workspace.fs.readFile(uri));
                if (args.startLine !== undefined) {
                    // Normalize line endings so \r\n and \r count as single line breaks
                    const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
                    const lines = normalized.split('\n');
                    const start = Math.max(0, args.startLine - 1);
                    const end = args.endLine !== undefined ? Math.min(lines.length, args.endLine) : lines.length;
                    return json(lines.slice(start, end).join('\n'));
                }
                return json(content);
            } catch (e) {
                return fail(e);
            }
        },
    );

    server.registerTool(
        'stop_debug',
        {
            title: 'Stop Debug Session',
            annotations: { destructiveHint: true },
            description:
                'Stop the current debug session. Use before starting a new session with a different config, or when done debugging.',
        },
        async () => {
            try {
                await commands.executeCommand('workbench.action.debug.stop');
                return ok('Debug session stopped');
            } catch {
                return ok('Ok');
            }
        },
    );

    server.registerTool(
        'wait_for_breakpoint_hit',
        {
            title: 'Wait for Breakpoint Hit',
            annotations: { readOnlyHint: true },
            description:
                'Wait until the debugged program pauses (e.g. at a breakpoint). Use after start_debug, resume, or any step. Returns {reason, threadId, sessionId} on success. If it times out, check get_active_session — the session may have ended.',
            inputSchema: z.object({
                timeout: z.number().optional().describe('Max wait time in milliseconds (default 30000).'),
            }),
            outputSchema: z.object({
                reason: z.string(),
                threadId: z.number().optional(),
                sessionId: z.string(),
            }),
        },
        async (args) => {
            const timeoutMs = args.timeout ?? WAIT_BREAKPOINT_TIMEOUT_MS;
            const session = debug.activeDebugSession;
            if (!session) {
                return fail('No active debug session — start a debug session first');
            }

            // If already paused, return immediately — avoid waiting for an event that already fired
            if (debug.activeStackItem) {
                return json({
                    reason: 'already paused',
                    threadId: debug.activeStackItem.threadId,
                    sessionId: session.id,
                });
            }

            return new Promise((resolve) => {
                // Re-check after subscribing — program may have paused between the
                // early-return check above and subscribing here
                if (debug.activeStackItem && debug.activeDebugSession?.id === session.id) {
                    resolve(
                        json({
                            reason: 'already paused',
                            threadId: debug.activeStackItem.threadId,
                            sessionId: session.id,
                        }),
                    );
                    return;
                }

                const timer = setTimeout(() => {
                    subscription.dispose();
                    resolve(
                        fail(
                            `Timed out waiting for breakpoint after ${timeoutMs}ms. The program may be running without hitting a breakpoint, or may have finished. Try calling "pause" to see where it is, or "get_active_session" to check if the session ended.`,
                        ),
                    );
                }, timeoutMs);

                const subscription = debug.onDidReceiveDebugSessionCustomEvent((e) => {
                    if (e.session.id === session.id && e.event === 'stopped') {
                        clearTimeout(timer);
                        subscription.dispose();
                        const body = e.body as { threadId?: number; reason?: string } | undefined;
                        resolve(
                            json({
                                reason: body?.reason ?? 'stopped',
                                threadId: body?.threadId,
                                sessionId: e.session.id,
                            }),
                        );
                    }
                });
            });
        },
    );

    server.registerTool(
        'set_breakpoint',
        {
            title: 'Set Breakpoint',
            annotations: { destructiveHint: true },
            description:
                'Set a breakpoint at a file and line, or on a function name. Returns {id, file?, line?, functionName?}. Use the id to remove_breakpoint later.',
            inputSchema: z.object({
                file: z
                    .string()
                    .optional()
                    .describe('Absolute path to the source file. Required unless functionName is set.'),
                line: z.number().optional().describe('1-based line number. Required unless functionName is set.'),
                functionName: z.string().optional().describe('Function name to break on. Alternative to file + line.'),
                condition: z.string().optional().describe('Only stop when this expression is true.'),
                hitCondition: z.string().optional().describe('Only stop after this many hits, such as "5".'),
                logMessage: z.string().optional().describe('Log this message instead of stopping.'),
            }),
            outputSchema: z.object({
                id: z.string(),
                file: z.string().optional(),
                line: z.number().optional(),
                functionName: z.string().optional(),
            }),
        },
        async (args) => {
            try {
                if (args.functionName) {
                    const bp = new FunctionBreakpoint(
                        args.functionName,
                        true,
                        args.condition,
                        args.hitCondition,
                        args.logMessage,
                    );
                    debug.addBreakpoints([bp]);
                    return json({ id: bp.id, functionName: args.functionName });
                }
                if (!args.file || args.line === undefined) {
                    return fail('Provide file+line, or functionName');
                }
                const uri = Uri.file(args.file);
                const bp = new SourceBreakpoint(
                    new Location(uri, new Range(args.line - 1, 0, args.line - 1, 0)),
                    true,
                    args.condition,
                    args.hitCondition,
                    args.logMessage,
                );
                debug.addBreakpoints([bp]);
                return json({ id: bp.id, file: args.file, line: args.line });
            } catch (e) {
                return fail(e);
            }
        },
    );

    server.registerTool(
        'remove_breakpoint',
        {
            title: 'Remove Breakpoint',
            annotations: { idempotentHint: true },
            description:
                'Remove a breakpoint by its id (from list_breakpoints or set_breakpoint). Returns a confirmation string.',
            inputSchema: z.object({
                id: z.string().describe('Breakpoint id to remove'),
            }),
        },
        async (args) => {
            try {
                const found = debug.breakpoints.find((bp) => bp.id === args.id);
                if (!found) {
                    return fail(`No breakpoint with id ${args.id}`);
                }
                debug.removeBreakpoints([found]);
                return ok(`Breakpoint ${args.id} removed`);
            } catch (e) {
                return fail(e);
            }
        },
    );

    server.registerTool(
        'step_over',
        {
            title: 'Step Over',
            annotations: { destructiveHint: true },
            description: 'Run the next line without entering functions.',
        },
        async () => {
            try {
                await commands.executeCommand('workbench.action.debug.stepOver');
                return ok('Ok');
            } catch (e) {
                return fail(e);
            }
        },
    );

    server.registerTool(
        'step_into',
        {
            title: 'Step Into',
            annotations: { destructiveHint: true },
            description: 'Enter the function called on this line.',
        },
        async () => {
            try {
                await commands.executeCommand('workbench.action.debug.stepInto');
                return ok('Ok');
            } catch (e) {
                return fail(e);
            }
        },
    );

    server.registerTool(
        'step_out',
        {
            title: 'Step Out',
            annotations: { destructiveHint: true },
            description: 'Finish this function and return to the caller.',
        },
        async () => {
            try {
                await commands.executeCommand('workbench.action.debug.stepOut');
                return ok('Ok');
            } catch (e) {
                return fail(e);
            }
        },
    );

    server.registerTool(
        'resume',
        {
            title: 'Resume',
            annotations: { destructiveHint: true },
            description: 'Continue running until the next breakpoint or program end.',
        },
        async () => {
            try {
                await commands.executeCommand('workbench.action.debug.continue');
                return ok('Ok');
            } catch (e) {
                return fail(e);
            }
        },
    );

    server.registerTool(
        'pause',
        { title: 'Pause', annotations: { destructiveHint: true }, description: 'Pause the running program.' },
        async () => {
            try {
                await commands.executeCommand('workbench.action.debug.pause');
                return ok('Ok');
            } catch (e) {
                return fail(e);
            }
        },
    );

    server.registerPrompt(
        'debug_session_workflow',
        {
            title: 'Debug Session Workflow',
            description: `Debug workflow for agents. 18 tools available.

Session: get_active_session, list_debug_configs, start_debug (returns {id,name,type}), stop_debug, restart
Breakpoints: list_breakpoints, set_breakpoint, remove_breakpoint
Wait: wait_for_breakpoint_hit
Inspect: list_threads, get_stack_trace (per thread), get_variables (all scopes), evaluate
Stepping: step_over, step_into, step_out
Execution: resume, pause

Call this prompt before using the debug tools.`,
        },
        () => ({
            messages: [
                {
                    role: 'user' as const,
                    content: {
                        type: 'text' as const,
                        text: `You are debugging a program using the Debug Graph MCP tools. Follow this investigative loop:

— PREPARATION —
1. Use "list_debug_configs" to see available launch configurations. Note the configName you want.
2. Read the source files you'll be debugging (use your filesystem tools). Identify the functions and lines where you want breakpoints.
3. Use "get_active_session" to check if a session is already running. If one exists with a different config, call "stop_debug" first. If you need the same config again after code changes, use "restart" to stop + start in one call.
4. Use "list_breakpoints" to see existing breakpoints. Remove unwanted ones with "remove_breakpoint".

— SETUP —
5. Use "set_breakpoint" for each target file and line. You can add conditions, hit conditions, or log messages. Breakpoints persist across sessions.
6. Use "start_debug" with the configName (or type+name+request+program). It returns {id, name, type} — or use "restart" to stop + start in one call when re-launching after code changes.

— INSPECTION LOOP (repeat as needed) —
7. Call "wait_for_breakpoint_hit" (default 30s timeout). It returns {reason, threadId, sessionId}. If it times out, check "get_active_session" — the program may have finished or the breakpoint may not be hit.
8. When paused, inspect the state:
   - "get_stack_trace" — see the full call path. Returns {stackFrames: [{id, name, source:{path}, line, column}]}.
   - "list_threads" — see all threads. Returns {threads: [{id, name}]}. Pass a threadId to get_stack_trace to inspect other threads.
   - "get_variables" — read all variables (Local, Global, Closure) in the current frame. Returns [{scope, name, value, type}].
   - "evaluate" — run an expression in the paused context. WARNING: This executes in the real program — avoid mutations (x++, assignments) and functions with side effects. Prefer get_variables for read-only inspection.
9. Form a hypothesis from the variable state. Then control execution to test it:
   - "step_over" — execute the current line, stay in this function.
   - "step_into" — enter the function being called on this line.
   - "step_out" — finish the current function and return to the caller.
   - "resume" — continue until the next breakpoint or program end.
   - "pause" — interrupt a running program that is stuck (infinite loop, deadlock, or missed breakpoint). After pause, inspect with get_stack_trace and get_variables.
10. After ANY execution command, call "wait_for_breakpoint_hit" to wait for the next pause. Then loop back to step 8.

— CLEANUP —
11. When done, call "stop_debug" to end the session. Optionally "remove_breakpoint" leftover breakpoints.

Key rules:
- Always call wait_for_breakpoint_hit after start_debug, resume, or any step before inspecting.
- Check get_active_session before starting a new session — duplicate sessions cause errors.
- Use get_variables (read-only) over evaluate when possible to avoid side effects.
- If something fails, read the error message; it usually tells you what's wrong (no session, no frame, etc.).`,
                    },
                },
            ],
        }),
    );

    return server;
}
