# Change Log

<!-- Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file. -->

## [0.0.2] - 2025-06-24

### Added

- **MCP Server** — Built-in Model Context Protocol server exposing 20 debug tools + 1 prompt for AI agent-driven debugging
- MCP tools: `get_active_session`, `list_debug_configs`, `start_debug`, `stop_debug`, `disconnect`, `restart`, `list_breakpoints`, `set_breakpoint`, `remove_breakpoint`, `wait_for_breakpoint_hit`, `list_threads`, `get_stack_trace`, `get_variables`, `get_source`, `evaluate`, `step_over`, `step_into`, `step_out`, `resume`, `pause`
- `debug_session_workflow` prompt for guiding AI agents through debug workflows
- `debug-graph.mcp.enabled` setting to toggle the MCP server
- `call-graph.restart-mcp` command to restart the MCP server
- Function breakpoint support in `list_breakpoints` and `set_breakpoint`
- Per-frame variable inspection via `frameId` on `get_variables` and `evaluate`

## [0.0.1] - 2024-07-14

### Added

- Basic functionality (Show call history for a breakpoint in python code)
- Editor uses the same theme as the rest of the IDE
- Auto update the graph on debugger events
- Show the graph in a separate window
- Button to open graph in document header
