# Debug Screenshot MCP

> VS Code Extension + MCP Server for capturing debugging screenshots, call stacks, local variables, and debug context — delivering full analysis context to AI agents.

---

## Overview

When debugging errors occur during AI-assisted coding, the hardest part is conveying *exactly what happened* to the AI. This project captures everything automatically:

- **Multi-monitor Screenshots** — all connected displays captured simultaneously (`screenshot-desktop`)
- **Call Stack** — full stack trace via DAP (Debug Adapter Protocol)
- **Local Variables** — names, values, and types from the current scope
- **Active File** — file path, cursor line, selected code, language ID
- **Debug Console** — recent debug output (configurable buffer size)
- **Terminal Output** — active terminal information
- **Git Context** — current branch and commit hash
- **Sensitive Data Masking** — passwords, tokens, API keys automatically masked

Data is persisted to disk (`~/.debug-screenshot-mcp/captures/`) and accessible via **MCP stdio protocol** (for AI tools like Copilot Chat) or **HTTP API** (port 5010).

## Architecture

```
├── src/                 ← VS Code Extension (TypeScript → out/)
│   ├── extension.ts            Entry point (activate/deactivate)
│   ├── capture/screenshot.ts   Multi-monitor screenshot capture
│   ├── commands/captureDebug.ts   Main capture pipeline
│   ├── context/vscodeContext.ts   DAP-based debug context collection
│   ├── mcp/mcpClient.ts          HTTP client (→ mcpServer.ts)
│   └── utils/                     Base64, security masking
└── server/              ← MCP Server (TypeScript → dist/)
    ├── mcpServer.ts            HTTP server (port 5010, auto-cleanup)
    ├── mcpStdioServer.ts       MCP stdio server (AI tool integration)
    └── serviceManager.ts       Windows service registration (node-windows)
```

**Data Flow**: `Ctrl+Shift+Alt+D` → capture all monitors → collect debug context → mask sensitive data → save to disk + HTTP transmission

## MCP Tools (AI Integration)

The MCP stdio server exposes 5 tools for AI agents:

| Tool | Description |
|------|-------------|
| `capture_all_screens` | Capture screenshots from all connected displays |
| `get_debug_context` | Retrieve the latest saved debug context |
| `list_displays` | List all connected displays (id, name, resolution) |
| `list_captures` | List all saved capture sessions |
| `get_capture_screenshot` | Get a specific screenshot image (base64) |

## Quick Start

### 1. Build & Install Extension

```bash
npm install
npm run compile
vsce package          # Do NOT use --no-dependencies
code --install-extension debug-screenshot-mcp-0.1.0.vsix
```

### 2. Build & Start MCP Server

```bash
cd server
npm install
npm run build
npm start             # HTTP server at http://127.0.0.1:5010
```

Or run the stdio server directly for AI tool integration:

```bash
node server/dist/mcpStdioServer.js
```

### 3. Register MCP Server

**Workspace-level** (`.vscode/mcp.json` — included in this repo):

```json
{
  "servers": {
    "debug-screenshot-mcp": {
      "type": "stdio",
      "command": "node",
      "args": ["${workspaceFolder}/server/dist/mcpStdioServer.js"]
    }
  }
}
```

**Global** (VS Code `settings.json`):

```json
{
  "mcp": {
    "servers": {
      "debug-screenshot-mcp": {
        "type": "stdio",
        "command": "node",
        "args": ["<absolute-path-to-project>/server/dist/mcpStdioServer.js"]
      }
    }
  }
}
```

### 4. Use the Extension

| OS | Shortcut |
|----|----------|
| Windows / Linux | `Ctrl+Shift+Alt+D` |
| macOS | `Cmd+Shift+Alt+D` |

Or: `Ctrl+Shift+P` → `Debug Screenshot: Capture & Send to MCP`

### Workflow

```
1. Start a debug session (F5)
2. Hit a breakpoint or encounter an error
3. Press Ctrl+Shift+Alt+D
4. Screenshot + call stack + context captured automatically
5. Saved to disk and sent to MCP server
6. AI agent receives full analysis context via MCP tools
```

## Windows Service

Register the HTTP server as a Windows service for persistent background operation.

### PowerShell (Recommended)

```powershell
.\manage-service.ps1 install      # Install (requires Administrator)
.\manage-service.ps1 status       # Check status
.\manage-service.ps1 health       # Health check
.\manage-service.ps1 stop         # Stop
.\manage-service.ps1 restart      # Restart
.\manage-service.ps1 uninstall    # Remove
```

### Batch Script

```cmd
manage-service.bat install
manage-service.bat status
manage-service.bat stop
manage-service.bat uninstall
```

## Configuration

VS Code Settings (`settings.json`):

| Setting | Default | Description |
|---------|---------|-------------|
| `debugScreenshotMcp.serverUrl` | `http://localhost:5010` | MCP server URL (localhost/private IP only) |
| `debugScreenshotMcp.maxConsoleLines` | `100` | Max debug console lines to collect |
| `debugScreenshotMcp.captureTimeout` | `30000` | Server request timeout (ms) |

## Auto-cleanup

| Component | Max Age | Max Count |
|-----------|---------|-----------|
| HTTP Server (mcpServer) | 1 hour | 50 captures |
| MCP stdio Server | — | 20 captures |

## Security

- **SSRF Prevention**: Only `localhost` and private network IPs allowed as server URL
- **Sensitive File Blocking**: `.env`, `*.key`, `*.pem` file contents automatically blocked
- **Pattern Masking**: `password:`, `token:`, `secret:`, `api_key:` → `[MASKED]`
- **Size Limit**: Screenshots capped at 10MB

## Cross-Platform

| OS | Screenshot | Extension | Windows Service |
|----|------------|-----------|-----------------|
| Windows | ✅ | ✅ | ✅ (node-windows) |
| macOS | ✅ | ✅ | — |
| Linux | ✅ | ✅ | — |

## Tech Stack

- TypeScript, Node.js
- VS Code Extension API + DAP (Debug Adapter Protocol)
- MCP Protocol (`@modelcontextprotocol/sdk`, stdio transport)
- `screenshot-desktop` — cross-platform multi-monitor capture
- `node-windows` — Windows service registration
- `zod` — schema validation

## License

MIT

---

# Debug Screenshot MCP (한국어)

> AI 에이전트에게 디버그 오류 현상을 정확히 전달하기 위한 VS Code 확장 + MCP 서버

---

## 개요

AI 지원 코딩 중 디버깅 오류가 발생하면, AI에게 *정확히 무슨 일이 일어났는지* 전달하는 것이 가장 큰 과제입니다. 이 프로젝트는 다음 정보를 자동으로 수집합니다:

- **다중 모니터 스크린샷** — 연결된 모든 디스플레이 동시 캡처 (`screenshot-desktop`)
- **콜스택** — DAP(Debug Adapter Protocol)을 통한 전체 스택 트레이스
- **로컬 변수** — 현재 스코프의 변수명, 값, 타입
- **활성 파일** — 파일 경로, 커서 라인, 선택 코드, 언어 ID
- **디버그 콘솔** — 최근 디버그 출력 (설정 가능한 버퍼 크기)
- **터미널 출력** — 활성 터미널 정보
- **Git 컨텍스트** — 현재 브랜치 및 커밋 해시
- **민감 정보 마스킹** — 비밀번호, 토큰, API 키 자동 마스킹

데이터는 디스크(`~/.debug-screenshot-mcp/captures/`)에 저장되며, **MCP stdio 프로토콜**(Copilot Chat 등 AI 도구) 또는 **HTTP API**(포트 5010)로 접근할 수 있습니다.

## 아키텍처

```
├── src/                 ← VS Code 확장 (TypeScript → out/)
│   ├── extension.ts            진입점 (activate/deactivate)
│   ├── capture/screenshot.ts   다중 모니터 스크린샷 캡처
│   ├── commands/captureDebug.ts   메인 캡처 파이프라인
│   ├── context/vscodeContext.ts   DAP 기반 디버그 컨텍스트 수집
│   ├── mcp/mcpClient.ts          HTTP 클라이언트 (→ mcpServer.ts)
│   └── utils/                     Base64, 보안 마스킹
└── server/              ← MCP 서버 (TypeScript → dist/)
    ├── mcpServer.ts            HTTP 서버 (포트 5010, 자동 정리)
    ├── mcpStdioServer.ts       MCP stdio 서버 (AI 도구 연동)
    └── serviceManager.ts       Windows 서비스 등록 (node-windows)
```

**데이터 흐름**: `Ctrl+Shift+Alt+D` → 전체 모니터 캡처 → 디버그 컨텍스트 수집 → 민감정보 마스킹 → 디스크 저장 + HTTP 전송

## MCP 도구 (AI 연동)

MCP stdio 서버는 AI 에이전트용 5개 도구를 제공합니다:

| 도구 | 설명 |
|------|------|
| `capture_all_screens` | 연결된 모든 디스플레이의 스크린샷 캡처 |
| `get_debug_context` | 최근 저장된 디버그 컨텍스트 조회 |
| `list_displays` | 연결된 디스플레이 목록 조회 (id, 이름, 해상도) |
| `list_captures` | 저장된 캡처 세션 목록 조회 |
| `get_capture_screenshot` | 특정 스크린샷 이미지 조회 (base64) |

## 빠른 시작

### 1. 확장 빌드 및 설치

```bash
npm install
npm run compile
vsce package          # --no-dependencies 사용 금지
code --install-extension debug-screenshot-mcp-0.1.0.vsix
```

### 2. MCP 서버 빌드 및 시작

```bash
cd server
npm install
npm run build
npm start             # HTTP 서버: http://127.0.0.1:5010
```

또는 AI 도구 연동을 위한 stdio 서버 직접 실행:

```bash
node server/dist/mcpStdioServer.js
```

### 3. MCP 서버 등록

**워크스페이스** (`.vscode/mcp.json` — 이 저장소에 포함):

```json
{
  "servers": {
    "debug-screenshot-mcp": {
      "type": "stdio",
      "command": "node",
      "args": ["${workspaceFolder}/server/dist/mcpStdioServer.js"]
    }
  }
}
```

**전역** (VS Code `settings.json`):

```json
{
  "mcp": {
    "servers": {
      "debug-screenshot-mcp": {
        "type": "stdio",
        "command": "node",
        "args": ["<프로젝트-절대경로>/server/dist/mcpStdioServer.js"]
      }
    }
  }
}
```

### 4. 사용법

| OS | 단축키 |
|----|--------|
| Windows / Linux | `Ctrl+Shift+Alt+D` |
| macOS | `Cmd+Shift+Alt+D` |

또는: `Ctrl+Shift+P` → `Debug Screenshot: Capture & Send to MCP`

### 워크플로우

```
1. 디버그 세션 시작 (F5)
2. Breakpoint 도달 또는 에러 발생
3. Ctrl+Shift+Alt+D 실행
4. 스크린샷 + 콜스택 + 컨텍스트 자동 수집
5. 디스크 저장 및 MCP 서버 전송
6. AI 에이전트가 MCP 도구를 통해 분석 컨텍스트 수신
```

## Windows 서비스

HTTP 서버를 Windows 서비스로 등록하여 백그라운드에서 지속 실행할 수 있습니다.

### PowerShell (권장)

```powershell
.\manage-service.ps1 install      # 설치 (관리자 권한 필요)
.\manage-service.ps1 status       # 상태 확인
.\manage-service.ps1 health       # Health Check
.\manage-service.ps1 stop         # 중지
.\manage-service.ps1 restart      # 재시작
.\manage-service.ps1 uninstall    # 제거
```

### 배치 스크립트

```cmd
manage-service.bat install
manage-service.bat status
manage-service.bat stop
manage-service.bat uninstall
```

## 설정

VS Code 설정 (`settings.json`):

| 설정 | 기본값 | 설명 |
|------|--------|------|
| `debugScreenshotMcp.serverUrl` | `http://localhost:5010` | MCP 서버 URL (localhost/사설 IP만 허용) |
| `debugScreenshotMcp.maxConsoleLines` | `100` | 디버그 콘솔 최대 수집 라인 수 |
| `debugScreenshotMcp.captureTimeout` | `30000` | 서버 요청 타임아웃 (ms) |

## 자동 정리

| 구성요소 | 최대 보관 시간 | 최대 보관 수 |
|---------|--------------|------------|
| HTTP 서버 (mcpServer) | 1시간 | 50개 |
| MCP stdio 서버 | — | 20개 |

## 보안

- **SSRF 방지**: `localhost` 및 사설 네트워크 IP만 서버 URL로 허용
- **민감 파일 차단**: `.env`, `*.key`, `*.pem` 파일 내용 자동 차단
- **패턴 마스킹**: `password:`, `token:`, `secret:`, `api_key:` → `[MASKED]`
- **크기 제한**: 스크린샷 최대 10MB

## 크로스 플랫폼

| OS | 스크린샷 | 확장 | Windows 서비스 |
|----|---------|------|---------------|
| Windows | ✅ | ✅ | ✅ (node-windows) |
| macOS | ✅ | ✅ | — |
| Linux | ✅ | ✅ | — |

## 기술 스택

- TypeScript, Node.js
- VS Code Extension API + DAP (Debug Adapter Protocol)
- MCP 프로토콜 (`@modelcontextprotocol/sdk`, stdio transport)
- `screenshot-desktop` — 크로스 플랫폼 다중 모니터 캡처
- `node-windows` — Windows 서비스 등록
- `zod` — 스키마 검증

## 라이선스

MIT
