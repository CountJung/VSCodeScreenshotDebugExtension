# Debug Screenshot MCP

> A VSCode Extension + MCP Server that captures debugging screenshots, call stacks, local variables, and development context to send to AI agents for precise error analysis.

---

## Overview

When debugging errors occur during AI-assisted coding, the biggest challenge is conveying *exactly what happened* to the AI. This project solves that by capturing:

- **Screenshot** of the current screen (cross-platform via `screenshot-desktop`)
- **Call Stack** — full stack trace via DAP (Debug Adapter Protocol)
- **Local Variables** — variable names, values, and types from the current scope
- **Active File** — file path, cursor line, selected code, language ID
- **Debug Console** — recent debug output (buffered, configurable lines)
- **Terminal Output** — active terminal information
- **Git Context** — current branch and commit hash
- **Sensitive Data Masking** — passwords, tokens, API keys are automatically masked

All data is packaged into a JSON payload and sent to a local MCP server.

## Architecture

```
┌─────────────────────────────────────────┐
│  VSCode Extension (Client)              │
│  ├─ extension.ts          Entry point   │
│  ├─ commands/captureDebug.ts            │
│  ├─ capture/screenshot.ts               │
│  ├─ context/vscodeContext.ts (DAP)      │
│  ├─ mcp/mcpClient.ts      HTTP client  │
│  └─ utils/security.ts     Masking       │
└───────────────┬─────────────────────────┘
                │ HTTP POST /debug-capture
┌───────────────▼─────────────────────────┐
│  MCP Server                             │
│  ├─ mcpServer.ts           HTTP server  │
│  └─ serviceManager.ts     Win service   │
└─────────────────────────────────────────┘
```

## Quick Start

### 1. Install the Extension

```bash
# Build and install
cd debug-screenshot-mcp
npm install
npm run compile
vsce package --no-dependencies
code --install-extension debug-screenshot-mcp-0.1.0.vsix
```

### 2. Start the MCP Server

```bash
cd debug-screenshot-mcp/server
npm install
npm run build
npm start
# Server running at http://127.0.0.1:5010
```

### 3. Use the Extension

| OS | Shortcut |
|---|---|
| Windows / Linux | `Ctrl+Shift+Alt+D` |
| macOS | `Cmd+Shift+Alt+D` |

Or: `Ctrl+Shift+P` → `Debug Screenshot: Capture & Send to MCP`

### Workflow

```
1. Start debug session (F5)
2. Hit a breakpoint or encounter an error
3. Press Ctrl+Shift+Alt+D
4. Screenshot + call stack + context captured automatically
5. Sent to MCP server
6. AI agent receives full analysis context
```

## Windows Service

The MCP server can be registered as a Windows service for background operation.

### Using PowerShell (Recommended)

```powershell
# Install service (requires Administrator)
.\manage-service.ps1 install

# Check status
.\manage-service.ps1 status

# Health check
.\manage-service.ps1 health

# Stop / Restart / Uninstall
.\manage-service.ps1 stop
.\manage-service.ps1 restart
.\manage-service.ps1 uninstall
```

### Using Batch Script

```cmd
manage-service.bat install
manage-service.bat status
manage-service.bat stop
manage-service.bat uninstall
```

### Using npm Scripts

```bash
cd server
npm run service:install    # Install & start
npm run service:status     # Check status
npm run service:stop       # Stop
npm run service:uninstall  # Remove
```

## Configuration

VSCode Settings (`settings.json`):

| Setting | Default | Description |
|---|---|---|
| `debugScreenshotMcp.serverUrl` | `http://localhost:5010` | MCP server URL (localhost/private IP only) |
| `debugScreenshotMcp.maxConsoleLines` | `100` | Max debug console lines to collect |
| `debugScreenshotMcp.captureTimeout` | `30000` | Server request timeout (ms) |

## Payload Structure

```json
{
  "type": "debug_capture",
  "screenshot": "<base64 PNG>",
  "file": "src/app.ts",
  "line": 42,
  "code": "const result = divide(a, 0);",
  "terminal": "Terminal: PowerShell",
  "debugConsole": "TypeError: Cannot read property...",
  "context": {
    "callStack": [
      { "frameId": 1, "name": "divide", "source": "app.ts", "line": 42 },
      { "frameId": 2, "name": "main", "source": "app.ts", "line": 10 }
    ],
    "localVariables": [
      { "name": "a", "value": "10", "type": "number" },
      { "name": "b", "value": "0", "type": "number" }
    ],
    "gitBranch": "main",
    "gitCommitHash": "abc12345"
  }
}
```

## Security

- **SSRF Prevention**: Only `localhost` and private network IPs allowed as server URL
- **Sensitive File Blocking**: `.env`, `*.key`, `*.pem` file contents automatically blocked
- **Pattern Masking**: `password:`, `token:`, `secret:`, `api_key:` patterns → `[MASKED]`
- **Size Limit**: Screenshots capped at 10MB

## Cross-Platform

| OS | Screenshot | Extension | Service |
|---|---|---|---|
| Windows | ✅ | ✅ | ✅ (node-windows) |
| macOS | ✅ | ✅ | — |
| Linux | ✅ | ✅ | — |

## Tech Stack

- TypeScript, Node.js
- VSCode Extension API
- DAP (Debug Adapter Protocol)
- `screenshot-desktop` — cross-platform screen capture
- `node-windows` — Windows service registration
- HTTP JSON API

## License

MIT

---

# Debug Screenshot MCP (한국어)

> AI 에이전트에게 디버그 오류 현상을 정확히 전달하기 위한 VSCode 확장 + MCP 서버 프로젝트

---

## 개요

AI 지원 코딩 중 디버깅 오류가 발생하면, AI에게 *정확히 무슨 일이 일어났는지* 전달하는 것이 가장 큰 과제입니다. 이 프로젝트는 다음 정보를 자동으로 수집합니다:

- **스크린샷** — 현재 화면 캡처 (크로스 플랫폼, `screenshot-desktop`)
- **콜스택** — DAP(Debug Adapter Protocol)을 통한 전체 스택 트레이스
- **로컬 변수** — 현재 스코프의 변수명, 값, 타입
- **활성 파일** — 파일 경로, 커서 라인, 선택 코드, 언어 ID
- **디버그 콘솔** — 최근 디버그 출력 (설정 가능한 버퍼 크기)
- **터미널 출력** — 활성 터미널 정보
- **Git 컨텍스트** — 현재 브랜치 및 커밋 해시
- **민감 정보 마스킹** — 비밀번호, 토큰, API 키 자동 마스킹

모든 데이터는 JSON 페이로드로 패키징되어 로컬 MCP 서버로 전송됩니다.

## 아키텍처

```
┌─────────────────────────────────────────┐
│  VSCode 확장 (클라이언트)                │
│  ├─ extension.ts          진입점         │
│  ├─ commands/captureDebug.ts             │
│  ├─ capture/screenshot.ts                │
│  ├─ context/vscodeContext.ts (DAP)       │
│  ├─ mcp/mcpClient.ts      HTTP 클라이언트│
│  └─ utils/security.ts     마스킹         │
└───────────────┬─────────────────────────┘
                │ HTTP POST /debug-capture
┌───────────────▼─────────────────────────┐
│  MCP 서버                                │
│  ├─ mcpServer.ts           HTTP 서버     │
│  └─ serviceManager.ts     Win 서비스     │
└─────────────────────────────────────────┘
```

## 빠른 시작

### 1. 확장 설치

```bash
# 빌드 및 설치
cd debug-screenshot-mcp
npm install
npm run compile
vsce package --no-dependencies
code --install-extension debug-screenshot-mcp-0.1.0.vsix
```

### 2. MCP 서버 시작

```bash
cd debug-screenshot-mcp/server
npm install
npm run build
npm start
# 서버 주소: http://127.0.0.1:5010
```

### 3. 사용법

| OS | 단축키 |
|---|---|
| Windows / Linux | `Ctrl+Shift+Alt+D` |
| macOS | `Cmd+Shift+Alt+D` |

또는: `Ctrl+Shift+P` → `Debug Screenshot: Capture & Send to MCP`

### 워크플로우

```
1. 디버그 세션 시작 (F5)
2. Breakpoint 도달 또는 에러 발생
3. Ctrl+Shift+Alt+D 실행
4. 스크린샷 + 콜스택 + 컨텍스트 자동 수집
5. MCP 서버로 전송
6. AI 에이전트가 전체 분석 컨텍스트 수신
```

## Windows 서비스

MCP 서버를 Windows 서비스로 등록하여 백그라운드로 실행할 수 있습니다.

### PowerShell 사용 (권장)

```powershell
# 서비스 설치 (관리자 권한 필요)
.\manage-service.ps1 install

# 상태 확인
.\manage-service.ps1 status

# Health Check
.\manage-service.ps1 health

# 중지 / 재시작 / 제거
.\manage-service.ps1 stop
.\manage-service.ps1 restart
.\manage-service.ps1 uninstall
```

### 배치 스크립트 사용

```cmd
manage-service.bat install
manage-service.bat status
manage-service.bat stop
manage-service.bat uninstall
```

### npm 스크립트 사용

```bash
cd server
npm run service:install    # 설치 및 시작
npm run service:status     # 상태 확인
npm run service:stop       # 중지
npm run service:uninstall  # 제거
```

## 설정

VSCode 설정 (`settings.json`):

| 설정 | 기본값 | 설명 |
|---|---|---|
| `debugScreenshotMcp.serverUrl` | `http://localhost:5010` | MCP 서버 URL (localhost/사설 IP만 허용) |
| `debugScreenshotMcp.maxConsoleLines` | `100` | 디버그 콘솔 최대 수집 라인 수 |
| `debugScreenshotMcp.captureTimeout` | `30000` | 서버 요청 타임아웃 (ms) |

## 페이로드 구조

```json
{
  "type": "debug_capture",
  "screenshot": "<base64 PNG>",
  "file": "src/app.ts",
  "line": 42,
  "code": "const result = divide(a, 0);",
  "terminal": "Terminal: PowerShell",
  "debugConsole": "TypeError: Cannot read property...",
  "context": {
    "callStack": [
      { "frameId": 1, "name": "divide", "source": "app.ts", "line": 42 },
      { "frameId": 2, "name": "main", "source": "app.ts", "line": 10 }
    ],
    "localVariables": [
      { "name": "a", "value": "10", "type": "number" },
      { "name": "b", "value": "0", "type": "number" }
    ],
    "gitBranch": "main",
    "gitCommitHash": "abc12345"
  }
}
```

## 보안

- **SSRF 방지**: `localhost` 및 사설 네트워크 IP만 서버 URL로 허용
- **민감 파일 차단**: `.env`, `*.key`, `*.pem` 파일 내용 자동 차단
- **패턴 마스킹**: `password:`, `token:`, `secret:`, `api_key:` 패턴 → `[MASKED]`
- **크기 제한**: 스크린샷 최대 10MB

## 크로스 플랫폼 지원

| OS | 스크린샷 | 확장 | 서비스 |
|---|---|---|---|
| Windows | ✅ | ✅ | ✅ (node-windows) |
| macOS | ✅ | ✅ | — |
| Linux | ✅ | ✅ | — |

## 기술 스택

- TypeScript, Node.js
- VSCode Extension API
- DAP (Debug Adapter Protocol)
- `screenshot-desktop` — 크로스 플랫폼 화면 캡처
- `node-windows` — Windows 서비스 등록
- HTTP JSON API

## 라이선스

MIT
