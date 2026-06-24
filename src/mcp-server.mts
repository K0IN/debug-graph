/**
 * MCP Server — Debug Graph
 *
 * Entry point launched as a child process by VS Code via
 * `McpStdioServerDefinition`.  Uses Comlink over TCP to call debug APIs
 * exposed by the extension-host-side `DebugBridge`.
 *
 * IMPORTANT: This process communicates on **stdout** for the MCP protocol.
 *            All diagnostic logs go to **stderr**.
 */

import { McpServer } from '@modelcontextprotocol/server';
import { StdioServerTransport } from '@modelcontextprotocol/server';
import * as net from 'net';
import { wrap } from 'comlink';
import { z } from 'zod';
import { comlinkEndpointFromSocket } from './mcp/transport.js';
import type { DebugApi } from './mcp/debug-api.js';

// ── Helpers ───────────────────────────────────────────────────────────

function logStderr(...args: unknown[]): void {
    process.stderr.write(`[debug-graph-mcp] ${args.map((a) => String(a)).join(' ')}\n`);
}

// ── MCP Server ────────────────────────────────────────────────────────

async function main(): Promise<void> {
    const portStr = process.env['DEBUG_BRIDGE_PORT'];
    if (!portStr) {
        logStderr('ERROR: DEBUG_BRIDGE_PORT environment variable not set');
        process.exit(1);
    }

    const port = parseInt(portStr, 10);
    if (Number.isNaN(port)) {
        logStderr(`ERROR: invalid DEBUG_BRIDGE_PORT value: ${portStr}`);
        process.exit(1);
    }

    // ── Connect to the extension-host bridge via Comlink ──────────────
    const socket = new net.Socket();
    await new Promise<void>((resolve, reject) => {
        socket.on('connect', () => {
            logStderr(`connected to bridge at 127.0.0.1:${port}`);
            resolve();
        });
        socket.on('error', reject);
        socket.setTimeout(5000);
        socket.connect(port, '127.0.0.1');
    });

    const endpoint = comlinkEndpointFromSocket(socket);
    const api = wrap<DebugApi>(endpoint);
    logStderr('Comlink bridge proxy created');

    // ── Result helpers ──────────────────────────────────────────────
    const ok = (text: string) => ({ content: [{ type: 'text' as const, text }] });
    const fail = (e: unknown) => ({
        content: [{ type: 'text' as const, text: `Error: ${e}` }],
        isError: true as const,
    });
    const json = (data: unknown) => ok(JSON.stringify(data, null, 2));

    // ── MCP server ──────────────────────────────────────────────────
    const serverVersion = process.env['DEBUG_GRAPH_VERSION'] ?? '0.0.0';
    const server = new McpServer({
        name: 'debug-graph-mcp',
        version: serverVersion,
    });

    // ────────── Query tools ──────────────────────────────────────────

    server.registerTool(
        'get_active_session',
        {
            description: 'Active debug session {id, name, type}, or null.',
        },
        async () => json(await api.getActiveSession()),
    );

    server.registerTool(
        'get_stack_trace',
        {
            description: 'Stack frames (id, name, source, line) from the active debug session.',
        },
        async () => json(await api.getStackTraces()),
    );

    server.registerTool(
        'get_variables',
        {
            description: 'Variables [{name, value, type}] in the current or specified stack frame.',
            inputSchema: z.object({
                frameId: z.number().optional().describe('Stack frame ID (default: active frame)'),
            }),
        },
        async (args) => json(await api.getVariables({ frameId: args.frameId })),
    );

    server.registerTool(
        'list_breakpoints',
        {
            description: 'All breakpoints in the workspace.',
        },
        async () => json(await api.getBreakpoints()),
    );

    server.registerTool(
        'evaluate',
        {
            description: 'Evaluate an expression in the paused debug context. Returns the result as a string.',
            inputSchema: z.object({
                expression: z.string().describe('Expression to evaluate (e.g. a variable name, a condition)'),
            }),
        },
        async (args) => ok(await api.evaluate({ expression: args.expression })),
    );

    // ────────── Launch & breakpoint tools ─────────────────────────────

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
        async (args) =>
            ok(
                await api.startDebug({
                    configName: args.configName,
                    type: args.type,
                    name: args.name,
                    request: args.request,
                    program: args.program,
                }),
            ),
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
        async (args) =>
            ok(
                await api.setBreakpoint({
                    file: args.file,
                    line: args.line,
                    condition: args.condition,
                    hitCondition: args.hitCondition,
                    logMessage: args.logMessage,
                }),
            ),
    );

    // ────────── Control tools ─────────────────────────────────────────

    server.registerTool('step_over', { description: 'Step to next line (over).' }, async () => {
        try {
            await api.stepOver();
            return ok('Ok');
        } catch (e) {
            return fail(e);
        }
    });

    server.registerTool('step_into', { description: 'Step into the called function.' }, async () => {
        try {
            await api.stepInto();
            return ok('Ok');
        } catch (e) {
            return fail(e);
        }
    });

    server.registerTool('step_out', { description: 'Step out of the current function.' }, async () => {
        try {
            await api.stepOut();
            return ok('Ok');
        } catch (e) {
            return fail(e);
        }
    });

    server.registerTool('resume', { description: 'Continue execution (resume the program).' }, async () => {
        try {
            await api.resume();
            return ok('Ok');
        } catch (e) {
            return fail(e);
        }
    });

    server.registerTool('pause', { description: 'Pause execution.' }, async () => {
        try {
            await api.pause();
            return ok('Ok');
        } catch (e) {
            return fail(e);
        }
    });

    // ── Connect transport & start listening ──────────────────────────
    const transport = new StdioServerTransport();
    await server.connect(transport);
    logStderr('MCP server connected via stdio, ready for requests.');
}

main().catch((err) => {
    logStderr('FATAL:', err);
    process.exit(1);
});
