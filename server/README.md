# @countjung/debug-screenshot-mcp

MCP Server that captures debug screenshots, call stacks, and local variables from VS Code — delivering full analysis context to AI agents.

[![npm](https://img.shields.io/npm/v/@countjung/debug-screenshot-mcp)](https://www.npmjs.com/package/@countjung/debug-screenshot-mcp)
[![MCP Registry](https://img.shields.io/badge/MCP%20Registry-io.github.CountJung%2Fdebug--screenshot--mcp-blue)](https://registry.modelcontextprotocol.io/servers/io.github.CountJung/debug-screenshot-mcp)

## Quick Start

```bash
npx @countjung/debug-screenshot-mcp
```

Or add to your MCP client config:

```json
{
  "servers": {
    "debug-screenshot-mcp": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@countjung/debug-screenshot-mcp"]
    }
  }
}
```

## MCP Tools

| Tool | Description |
|------|-------------|
| `capture_all_screens` | Capture screenshots from all connected displays |
| `get_debug_context` | Retrieve the latest saved debug context |
| `list_displays` | List all connected displays |
| `list_captures` | List all saved capture sessions |
| `get_capture_screenshot` | Get a specific screenshot (base64) |

## Full Documentation

See the [main project repository](https://github.com/CountJung/VSCodeScreenshotDebugExtension) for complete documentation, including:

- VS Code extension setup and usage
- Capture pipeline details
- Windows service registration
- Configuration options

## License

MIT
