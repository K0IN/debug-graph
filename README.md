# 📊 Debug Graph

A Visual Studio Code extension that visualizes the function calls (code paths) leading up to your breakpoints. Gain insights into the execution flow in your code and troubleshoot efficiently!

## ✨ Features

![Show the call path](./.docs/images/basic_example.gif)

- **Visual call graph** — See the full chain of function calls that led to your breakpoint, rendered as an interactive tree
- **Multi-language support** — Works with Go, Python, JavaScript, TypeScript, C++, C, Rust, C#, Zig, and more
- **Variable inspection** — Hover over any stack frame to view variables and their values at that point in execution
- **Source-code navigation** — Click any frame in the graph to jump directly to the corresponding line in the editor
- **MCP-powered AI debugging** — Exposes debug tools so AI agents can inspect and step through code (see [MCP Server](#-mcp-server---let-your-agent-control-your-debug-session))

## 🤖 MCP Server - Let your agent control your debug session

Debug Graph includes a built-in **MCP (Model Context Protocol) server**. It lets AI agents use the VS Code debugger directly.

The MCP server exposes **20 tools** that let an agent interact with the VS Code debugger directly:

| Tool | What it does |
|---|---|
| `list_debug_configs` | Reads `.vscode/launch.json` and returns available debug configurations. |
| `list_breakpoints` | Shows existing breakpoints (source and function). |
| `set_breakpoint` | Adds a breakpoint by file+line or function name, returns its id. |
| `remove_breakpoint` | Removes a breakpoint by id. |
| `start_debug` | Starts debugging. Supports `configName`, or `type` + `name` + `request`, plus `program`, `args`, `env`, `cwd`, `runtimeExecutable`, `runtimeArgs`, `console`, `stopOnEntry`. Returns `{id, name, type, configuration}`. |
| `stop_debug` | Stops the current debug session. |
| `disconnect` | Disconnects without killing the debugged program. |
| `restart` | Stops and restarts a debug session with a `configName`. |
| `get_active_session` | Shows the current debug session (includes `configuration`), or `null`. |
| `wait_for_breakpoint_hit` | Waits until the program pauses after start, resume, or step. |
| `list_threads` | Lists all threads in the debugged program. |
| `get_stack_trace` | Shows the paused call stack (optionally for a specific thread). |
| `get_variables` | Shows variables from all scopes. Pass a `frameId` for any frame, or omit for the active frame. |
| `get_source` | Reads source code from a file (whole file or line range). |
| `evaluate` | Runs an expression in the paused program. Pass a `frameId` to evaluate in a specific frame. ⚠️ executes in the real program — avoid side effects. |
| `step_over` | Runs the next line without entering functions. |
| `step_into` | Enters the called function. |
| `step_out` | Leaves the current function. |
| `resume` | Continues running. |
| `pause` | Pauses the running program. |

Simple workflow for agents:

1. Call `list_debug_configs` to see available configurations.
2. Call `get_active_session` to check if a session is already running.
3. Call `list_breakpoints` and `set_breakpoint` for each target line.
4. Call `start_debug` or `restart`.
5. Call `wait_for_breakpoint_hit` if the program is running.
6. Inspect with `get_stack_trace`, `get_variables`, `list_threads`, or `evaluate`.
7. Move with `step_over`, `step_into`, `step_out`, `resume`, or `pause`.
8. Call `stop_debug` when done.

### 🧠 Built-in MCP Prompt for Agents

The MCP server publishes a **`debug_session_workflow` prompt**. Agents should call it before using the debug tools.

Use this when you want an agent to find real runtime values instead of guessing from static code.

> **Typed outputs** — 10 tools (`get_active_session`, `list_debug_configs`, `get_stack_trace`, `list_threads`, `get_variables`, `list_breakpoints`, `wait_for_breakpoint_hit`, `set_breakpoint`, `evaluate`, `get_source`) publish `outputSchema` (JSON Schema) so AI clients know the exact return shape before calling the tool.

### ⚙️ MCP Settings

The MCP server is enabled by default. To disable it, set `"debug-graph.mcp.enabled": false` in your VS Code settings. Changes take effect after restarting VS Code or running the **`Debug: Restart MCP Server`** command (`call-graph.restart-mcp`).

## 🚀 Requirements

This extension is designed to work with **all languages** supported by Visual Studio Code. However, the following languages have been tested for compatibility:

| Language | Debugger | Linux | Windows | Notes |
| --- | --- | --- | --- | --- |
| Go | golang | ✅ | ✅ | delve |
| Python | [debugpy](https://marketplace.visualstudio.com/items?itemName=ms-python.debugpy) | ✅ | ✅ | |
| JavaScript | Node | ❔ | ✅ | using node.js runtime |
| TypeScript | pwa-node | ✅ | ✅ | using Deno runtime |
| C++ | GDB | ✅ | ❔ | |
| C | GDB | ✅ | ❔ | |
| Rust | lldb | ✅ | ❔ | |
| C# | dotnet | ✅ | ✅ | dotnet 8 + 6 |
| Zig | lldb | ✅ | ❔ | version 0.14 |

✅ tested | ❌ not working | ❔ not tested

All test projects can be found in the [test_code](./test_code) directory.

> More testing is planned for additional languages such as C#, C, and Java.

## 🛠️ How to Get Started

1. Set a breakpoint in your code.
2. Click on the `Call Graph` icon in the top bar of your editor (only visible while debugging).
3. Explore the variables and trace the origin of your execution.

## 📥 How to Install

1. Open Visual Studio Code.
2. Go to the Extensions view (square icon in the sidebar).
3. Search for Debug Graph and click Install.

You can also install it directly from the [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=k0in.debug-graph).

## 💻 Issues and Contributions

For bug reports or feature requests, please visit our [GitHub Repository](https://github.com/K0IN/stacktrace-history).

## 📦 Store Information

- Extension Name: **debug-graph**
- Extension ID: **k0in.debug-graph**
- [View on Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=k0in.debug-graph)

## Tech Stack

- TypeScript
- [Vue.js](https://vuejs.org/) (for the frontend)
- [Comlink](https://github.com/GoogleChromeLabs/comlink) (for communication between the frontend and backend)

