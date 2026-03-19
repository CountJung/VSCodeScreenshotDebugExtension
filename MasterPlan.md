# VSCode Screenshot Debug MCP Extension

Lightweight cross-platform VSCode extension that captures debugging screenshots and sends contextual data to an MCP server for AI-assisted debugging.

---

# 1. Project Overview

## Goal

Create a **VSCode Extension (.vsix)** that captures debugging errors through screenshots and sends contextual development data to an **MCP server** for AI analysis.

The extension should allow developers to quickly send debugging context to AI tools.

Example workflow:

```
Debug Error 발생
↓
단축키 실행
↓
스크린샷 캡처 + 코드 컨텍스트 수집
↓
MCP 서버 전달
↓
AI 분석
```

---

# 2. Core Features

## 2.1 Screenshot Capture

Capture screen when debugging errors occur.

Requirements:

* Cross platform
* Simple implementation
* Lightweight

Library:

```
screenshot-desktop
```

Capabilities:

* Capture entire screen
* Save temporary image
* Convert to Base64
* Send to MCP server

---

## 2.2 Context Extraction

Collect development context from VSCode.

Data to collect:

```
active file path
current cursor line
selected code
workspace path
git commit hash (optional)
debug console output
terminal output
```

---

## 2.3 MCP Communication

Send collected data to MCP server.

Payload structure:

```json
{
  "type": "debug_capture",
  "screenshot": "base64",
  "file": "path/to/file",
  "line": 52,
  "code": "selected code snippet",
  "terminal": "terminal output",
  "debugConsole": "debug output"
}
```

---

## 2.4 Debug Trigger

Manual trigger:

```
Ctrl + Shift + Alt + D
```

Future support:

* Debug session error detection
* Automatic capture on crash

---

## 2.5 Output Format

Extension packaged as:

```
.vsix
```

Install:

```
code --install-extension debug-screenshot-mcp.vsix
```

---

# 3. Project Architecture

```
vscode-debug-screenshot-mcp
│
├ extension
│  ├ extension.ts
│  ├ commands
│  │  └ captureDebug.ts
│  │
│  ├ capture
│  │  └ screenshot.ts
│  │
│  ├ context
│  │  └ vscodeContext.ts
│  │
│  ├ mcp
│  │  └ mcpClient.ts
│  │
│  └ utils
│     └ encoding.ts
│
├ server
│  └ mcpServer.ts
│
├ package.json
├ tsconfig.json
├ README.md
└ LICENSE
```

---

# 4. Technology Stack

## Language

```
TypeScript
```

## VSCode API

```
VSCode Extension API
```

## Screenshot Library

```
screenshot-desktop
```

Reason:

* Cross-platform
* Minimal dependency
* Stable

## MCP SDK

```
@modelcontextprotocol/sdk
```

Node.js implementation.

## Packaging Tool

```
vsce
```

---

# 5. Implementation Plan

## Step 1 — VSCode Extension Setup

Install generator:

```
npm install -g yo generator-code
```

Create extension:

```
yo code
```

Template:

```
TypeScript Extension
```

Project name:

```
debug-screenshot-mcp
```

---

## Step 2 — Install Dependencies

```
npm install screenshot-desktop
npm install @modelcontextprotocol/sdk
```

---

## Step 3 — Screenshot Module

File:

```
capture/screenshot.ts
```

Responsibilities:

* capture screen
* convert to base64
* return image data

---

## Step 4 — Context Collector

File:

```
context/vscodeContext.ts
```

Responsibilities:

* detect active file
* get cursor line
* get selected code
* capture terminal output

---

## Step 5 — MCP Client

File:

```
mcp/mcpClient.ts
```

Responsibilities:

* connect MCP server
* send JSON payload
* receive response

---

## Step 6 — VSCode Command

Command:

```
debugScreenshot.capture
```

Shortcut:

```
Ctrl + Shift + Alt + D
```

Flow:

```
capture screenshot
collect context
send MCP request
show result notification
```

---

# 6. MCP Server

Simple Node server.

Responsibilities:

* receive debug payload
* log data
* forward to AI tool

Future capability:

* integrate with ChatGPT
* integrate with Claude
* integrate with local LLM

---

# 7. Extension Packaging

Install packaging tool:

```
npm install -g vsce
```

Build extension:

```
vsce package
```

Output:

```
debug-screenshot-mcp.vsix
```

---

# 8. GitHub Repository Structure

```
github.com/<username>/vscode-debug-screenshot-mcp
```

Repository contents:

```
extension source
mcp server example
sample screenshots
usage guide
vsix release
```

---

# 9. Security Considerations

Sensitive data protection.

Avoid sending:

```
.env
secrets
tokens
```

Optional:

mask sensitive text before transmission.

---

# 10. Testing Plan

Test environments:

```
Windows
MacOS
Linux
```

Test scenarios:

```
debug error screenshot capture
manual trigger capture
large workspace
multiple monitors
```

---

# 11. Future Enhancements

```
automatic debug error detection
stack trace analysis
AI auto fix suggestion
VSCode inline patch generation
```

---

# 12. Expected Outcome

A lightweight developer tool that:

```
captures debug context
captures screenshots
sends AI debugging request
```

This enables **AI-assisted debugging workflow inside VSCode**.

---
