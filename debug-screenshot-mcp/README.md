# Debug Screenshot MCP

AI 디버그 지원을 위한 VSCode Extension — 스크린샷 + 콜스택 + 컨텍스트를 MCP 서버로 전송합니다.

## 개요

디버깅 중 발생하는 오류를 AI 에이전트에게 정확히 전달하기 위해:
- 현재 화면 스크린샷 캡처
- 콜스택, 로컬 변수 수집 (DAP 프로토콜)
- 활성 파일/커서 라인/선택 코드 수집
- 디버그 콘솔 및 터미널 출력 수집
- Git 브랜치/커밋 정보 수집

모든 정보를 MCP 서버로 전송하여 AI가 문제를 정확하게 분석할 수 있도록 합니다.

## 설치

### 방법 1: .vsix 파일로 설치

```bash
code --install-extension debug-screenshot-mcp-0.1.0.vsix
```

### 방법 2: 개발 모드

```bash
git clone <repository>
cd debug-screenshot-mcp
npm install
npm run compile
# F5 키로 Extension Host 실행
```

## 사용법

### 단축키

| OS | 단축키 |
|---|---|
| Windows / Linux | `Ctrl+Shift+Alt+D` |
| macOS | `Cmd+Shift+Alt+D` |

### Command Palette

`Ctrl+Shift+P` → `Debug Screenshot: Capture & Send to MCP`

### 워크플로우

```
1. 디버그 세션 시작 (F5)
2. 오류 발생 / breakpoint 중단
3. Ctrl+Shift+Alt+D 실행
4. 스크린샷 + 콜스택 + 컨텍스트 자동 수집
5. MCP 서버로 전송
6. AI 에이전트가 분석 힌트 반환
```

## MCP 서버 실행

```bash
cd server
npm install
npm run build
node dist/mcpServer.js
# 기본 포트: 5010
# 포트 변경: MCP_PORT=5020 node dist/mcpServer.js
```

### Health Check

```bash
curl http://localhost:5010/health
# {"status":"ok","port":5010}
```

## 설정

VSCode 설정 (`settings.json`):

```json
{
  "debugScreenshotMcp.serverUrl": "http://localhost:5010",
  "debugScreenshotMcp.maxConsoleLines": 100,
  "debugScreenshotMcp.captureTimeout": 30000
}
```

| 설정 | 기본값 | 설명 |
|---|---|---|
| `serverUrl` | `http://localhost:5010` | MCP 서버 URL (localhost/사설 IP만 허용) |
| `maxConsoleLines` | `100` | 디버그 콘솔 최대 수집 라인 수 |
| `captureTimeout` | `30000` | 서버 요청 타임아웃 (ms) |

## 전송 페이로드 구조

```json
{
  "type": "debug_capture",
  "screenshot": "<base64 PNG>",
  "file": "path/to/file.ts",
  "line": 42,
  "code": "selected code snippet",
  "terminal": "terminal output",
  "debugConsole": "debug console output",
  "context": {
    "filePath": "...",
    "lineNumber": 42,
    "languageId": "typescript",
    "debugSessionName": "Launch Program",
    "debugSessionType": "node",
    "callStack": [
      { "frameId": 1, "name": "myFunction", "source": "app.ts", "line": 42 }
    ],
    "localVariables": [
      { "name": "x", "value": "undefined", "type": "undefined" }
    ],
    "gitBranch": "main",
    "gitCommitHash": "abc12345",
    "timestamp": "2026-03-17T..."
  }
}
```

## 보안

- `localhost` 및 사설 네트워크 IP만 허용 (SSRF 방지)
- `.env`, `*.key`, `*.pem` 등 민감 파일 내용 자동 차단
- `password:`, `token:`, `secret:`, `api_key:` 등 민감 패턴 자동 마스킹
- 스크린샷 크기 10MB 제한

## 아키텍처

```
VSCode Extension (클라이언트)
  ├ src/extension.ts          — 진입점, 커맨드 등록
  ├ src/commands/captureDebug.ts — 메인 캡처 흐름
  ├ src/capture/screenshot.ts    — 스크린샷 캡처
  ├ src/context/vscodeContext.ts — 콜스택/변수/Git 수집
  ├ src/mcp/mcpClient.ts         — HTTP 전송
  └ src/utils/security.ts        — 민감 정보 마스킹

MCP Server (서버)
  └ server/mcpServer.ts       — HTTP 수신, 분석 힌트 생성
```

## 크로스 플랫폼

| OS | 스크린샷 | 테스트 |
|---|---|---|
| Windows | ✅ | ✅ |
| macOS | ✅ | 예정 |
| Linux | ✅ | 예정 |

## 라이선스

MIT
