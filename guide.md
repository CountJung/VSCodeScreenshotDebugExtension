# Debug Screenshot MCP — 상세 사용 가이드

> VS Code에서 디버깅 중 발생한 오류를 AI에게 정확히 전달하기 위한 도구 모음

---

## 목차

1. [시스템 요구사항](#1-시스템-요구사항)
2. [아키텍처 개요](#2-아키텍처-개요)
3. [설치 방법](#3-설치-방법)
   - [방법 A: npm으로 MCP 서버만 설치 (가장 간단)](#방법-a-npm으로-mcp-서버만-설치-가장-간단)
   - [방법 B: 소스에서 빌드 (전체 기능)](#방법-b-소스에서-빌드-전체-기능)
4. [VS Code 확장 설정](#4-vs-code-확장-설정)
5. [MCP 서버 등록](#5-mcp-서버-등록)
6. [기본 사용 워크플로우](#6-기본-사용-워크플로우)
7. [Copilot Chat에서 MCP 도구 사용](#7-copilot-chat에서-mcp-도구-사용)
8. [MCP 도구 상세 설명](#8-mcp-도구-상세-설명)
9. [설정 옵션](#9-설정-옵션)
10. [단일 모니터 환경 팁](#10-단일-모니터-환경-팁)
11. [Windows 서비스 등록](#11-windows-서비스-등록)
12. [자동 정리 정책](#12-자동-정리-정책)
13. [보안 고려사항](#13-보안-고려사항)
14. [문제 해결](#14-문제-해결)
15. [배포 / 배포자 가이드](#15-배포--배포자-가이드)

---

## 1. 시스템 요구사항

| 항목 | 요구사항 |
|------|----------|
| OS | Windows / macOS / Linux |
| Node.js | 18.x 이상 |
| VS Code | 1.85.0 이상 |
| npm | 9.x 이상 |

---

## 2. 아키텍처 개요

```
┌─────────────────────────────────────────┐
│          VS Code 확장 (Extension)         │
│                                         │
│  Ctrl+Shift+Alt+D                       │
│       │                                 │
│       ▼                                 │
│  1. 디버그 컨텍스트 수집 (DAP)            │
│     ├─ 콜스택                           │
│     ├─ 로컬 변수                        │
│     ├─ 활성 파일/라인                   │
│     ├─ 디버그 콘솔 출력                 │
│     └─ Git 브랜치/커밋                  │
│                                         │
│  2. 스크린샷 캡처 (screenshot-desktop)  │
│     └─ 연결된 모든 모니터 동시 캡처      │
│                                         │
│  3. 민감정보 마스킹 (security.ts)        │
│                                         │
│  4. 디스크 저장 + HTTP 전송              │
└────────────────┬────────────────────────┘
                 │  HTTP POST + 파일 저장
                 ▼
┌─────────────────────────────────────────┐
│    ~/.debug-screenshot-mcp/captures/    │
│    (capture-{timestamp}/ 디렉토리)       │
└────────────────┬────────────────────────┘
                 │  파일 읽기
                 ▼
┌─────────────────────────────────────────┐
│      MCP stdio 서버 (mcpStdioServer)     │
│                                         │
│  MCP 도구 노출:                          │
│  ├─ capture_all_screens                 │
│  ├─ get_debug_context                   │
│  ├─ list_displays                       │
│  ├─ list_captures                       │
│  └─ get_capture_screenshot              │
└────────────────┬────────────────────────┘
                 │  MCP stdio 프로토콜
                 ▼
┌─────────────────────────────────────────┐
│      AI 에이전트 (Copilot Chat 등)       │
└─────────────────────────────────────────┘
```

**데이터 저장 위치**: `~/.debug-screenshot-mcp/captures/capture-{타임스탬프}/`

각 캡처 디렉토리에는 다음이 저장됩니다:
- `context.json` — 콜스택, 변수, 파일정보, git 컨텍스트
- `screen-{n}.png` — 각 모니터 스크린샷

---

## 3. 설치 방법

### 방법 A: npm으로 MCP 서버만 설치 (가장 간단)

AI 도구에서 MCP 서버로만 사용할 경우 (VS Code 확장 없이도 동작):

```bash
# 임시 실행 (MCP 클라이언트에서 자동 실행)
npx @countjung/debug-screenshot-mcp

# 전역 설치 (영구적으로 사용)
npm install -g @countjung/debug-screenshot-mcp
```

MCP 클라이언트 설정 (`mcp.json` 또는 `settings.json`):

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

### 방법 B: 소스에서 빌드 (전체 기능)

VS Code 확장 + MCP 서버 모두 설치:

#### Step 1: 저장소 클론

```bash
git clone https://github.com/CountJung/VSCodeScreenshotDebugExtension.git
cd VSCodeScreenshotDebugExtension
```

#### Step 2: VS Code 확장 빌드

```bash
# 루트 디렉토리에서 실행
npm install
npm run compile

# .vsix 패키지 생성
npx vsce package   # --no-dependencies 절대 사용 금지

# VS Code에 설치
code --install-extension debug-screenshot-mcp-0.1.1.vsix
```

> ⚠️ `vsce package --no-dependencies`를 사용하면 `screenshot-desktop` 등의 런타임 의존성이 누락되어 확장이 활성화에 실패합니다.

#### Step 3: MCP 서버 빌드

```bash
cd server
npm install
npm run build

# HTTP 서버 시작 (포트 5010)
npm start

# 또는 stdio 서버 직접 실행 (AI 도구용)
node dist/mcpStdioServer.js
```

---

## 4. VS Code 확장 설정

### 확장 설치 확인

1. VS Code에서 `Ctrl+Shift+X` (확장 탭 열기)
2. 검색: `Debug Screenshot MCP`
3. "활성화됨" 상태 확인

### 출력 채널에서 로그 확인

`보기` → `출력` → 드롭다운에서 `Debug Screenshot MCP` 선택

---

## 5. MCP 서버 등록

### 워크스페이스별 등록 (권장)

프로젝트 루트에 `.vscode/mcp.json` 생성 또는 편집:

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

### 전역 등록 (모든 프로젝트에서 사용)

VS Code `settings.json` (`Ctrl+Shift+P` → "Open User Settings JSON"):

```json
{
  "mcp": {
    "servers": {
      "debug-screenshot-mcp": {
        "type": "stdio",
        "command": "npx",
        "args": ["-y", "@countjung/debug-screenshot-mcp"]
      }
    }
  }
}
```

### 자동 시작 설정

기본값(`"never"`)에서는 VS Code 재시작 시 MCP 서버를 수동으로 시작해야 합니다.  
항상 자동 시작하려면 settings.json에 추가:

```json
{
  "chat.mcp.autostart": "always"
}
```

### MCP 서버 상태 확인

1. Copilot Chat 패널 열기 (`Ctrl+Alt+I`)
2. 채팅 입력창 하단의 **🔧 도구 아이콘** 클릭
3. `debug-screenshot-mcp` 서버 상태 확인
   - 🟢 실행 중 → 정상
   - 🔴 중지됨 → 클릭하여 수동 시작

---

## 6. 기본 사용 워크플로우

```
1. 디버깅 대상 프로젝트에서 F5로 디버그 세션 시작
         │
         ▼
2. 버그가 발생하는 지점에 브레이크포인트 설정
         │
         ▼
3. 브레이크포인트에서 실행이 멈추거나 오류 발생
         │
         ▼
4. Ctrl+Shift+Alt+D 누름 (macOS: Cmd+Shift+Alt+D)
   또는: Ctrl+Shift+P → "Debug Screenshot: Capture & Send to MCP"
         │
         ▼
5. 자동 수집 항목:
   ├─ 연결된 모든 모니터 스크린샷
   ├─ 현재 콜스택 (전체 스택 트레이스)
   ├─ 로컬 변수 (이름, 값, 타입)
   ├─ 활성 파일 경로 및 커서 위치
   ├─ 디버그 콘솔 출력 (최근 100줄)
   └─ Git 브랜치 및 커밋 해시
         │
         ▼
6. 데이터가 ~/.debug-screenshot-mcp/captures/ 에 저장됨
         │
         ▼
7. Copilot Chat에서 MCP 도구를 통해 분석 요청
```

---

## 7. Copilot Chat에서 MCP 도구 사용

### 기본 사용법

채팅 입력창에 `#`을 입력하면 사용 가능한 MCP 도구 목록이 나타납니다:

```
#mcp_debug-screens_list_captures
```

### 도구별 사용 예시

#### 최근 캡처 목록 확인

```
#mcp_debug-screens_list_captures 최근 캡처된 디버그 세션 목록을 보여줘
```

#### 최신 디버그 컨텍스트 분석

```
#mcp_debug-screens_get_debug_context 
현재 발생한 오류의 콜스택과 변수 값을 분석해서 원인을 알려줘
```

#### 화면 직접 캡처 (확장 없이)

```
#mcp_debug-screens_capture_all_screens 지금 화면을 캡처해줘
```

#### 특정 스크린샷 확인

```
#mcp_debug-screens_get_capture_screenshot captureId와 screenshotId를 지정해서 특정 스크린샷을 보여줘
```

### 복합 사용 예시

```
방금 Ctrl+Shift+Alt+D로 캡처한 디버그 정보가 있어.
#mcp_debug-screens_get_debug_context
스택 트레이스와 변수를 보고 왜 NullPointerException이 발생했는지 진단해줘.
```

---

## 8. MCP 도구 상세 설명

### `capture_all_screens`

연결된 모든 디스플레이에서 스크린샷을 캡처하여 디스크에 저장합니다.

**파라미터**: 없음

**반환값**:
```json
{
  "captureId": "capture-1712345678901",
  "screenshots": [
    {
      "displayId": 1,
      "displayName": "주 모니터",
      "width": 1920,
      "height": 1080,
      "path": "/home/user/.debug-screenshot-mcp/captures/capture-1712345678901/screen-1.png"
    }
  ]
}
```

---

### `get_debug_context`

가장 최근에 저장된 디버그 컨텍스트(`context.json`)를 반환합니다.

**파라미터**: 없음

**반환값 구조**:
```json
{
  "timestamp": "2024-04-05T12:34:56.789Z",
  "callStack": [
    {
      "functionName": "processData",
      "source": "/src/data.ts",
      "line": 42,
      "column": 8
    }
  ],
  "localVariables": [
    {
      "name": "userData",
      "value": "{ id: 123, name: 'user' }",
      "type": "object"
    }
  ],
  "activeFile": {
    "path": "/src/data.ts",
    "language": "typescript",
    "cursorLine": 42,
    "selectedText": "const result = processData(input);"
  },
  "debugConsole": ["Error: Cannot read property...", "at processData (data.ts:42)"],
  "gitContext": {
    "branch": "feature/fix-null-check",
    "commit": "abc1234"
  }
}
```

---

### `list_displays`

연결된 모든 디스플레이 목록을 반환합니다.

**파라미터**: 없음

**반환값**:
```json
{
  "displays": [
    { "id": 1, "name": "주 모니터", "width": 1920, "height": 1080 },
    { "id": 2, "name": "보조 모니터", "width": 2560, "height": 1440 }
  ]
}
```

---

### `list_captures`

저장된 모든 캡처 세션 목록을 반환합니다 (최신순, 최대 20개).

**파라미터**: 없음

**반환값**:
```json
{
  "captures": [
    {
      "captureId": "capture-1712345678901",
      "timestamp": "2024-04-05T12:34:56.789Z",
      "screenshotCount": 2,
      "hasDebugContext": true
    }
  ]
}
```

---

### `get_capture_screenshot`

특정 캡처 세션의 특정 스크린샷을 base64로 반환합니다.

**파라미터**:
| 파라미터 | 타입 | 설명 |
|----------|------|------|
| `captureId` | string | `list_captures`에서 얻은 captureId |
| `screenshotIndex` | number | 스크린샷 인덱스 (0부터 시작) |

**반환값**: base64 인코딩된 PNG 이미지

---

## 9. 설정 옵션

VS Code settings.json에서 변경 (`Ctrl+Shift+P` → "Open User Settings JSON"):

```json
{
  "debugScreenshotMcp.serverUrl": "http://localhost:5010",
  "debugScreenshotMcp.maxConsoleLines": 100,
  "debugScreenshotMcp.captureTimeout": 30000,
  "debugScreenshotMcp.captureDelay": 0
}
```

### 각 항목 설명

| 설정 키 | 기본값 | 설명 |
|---------|--------|------|
| `serverUrl` | `http://localhost:5010` | HTTP MCP 서버 URL. `localhost` 및 사설 IP만 허용. |
| `maxConsoleLines` | `100` | 디버그 콘솔에서 수집할 최대 라인 수 (10~1000). |
| `captureTimeout` | `30000` | 서버 요청 타임아웃 (밀리초). |
| `captureDelay` | `0` | 스크린샷 캡처 전 대기 시간 (밀리초). 단일 모니터 환경에서 대상 앱으로 전환할 때 사용. |

---

## 10. 단일 모니터 환경 팁

단일 모니터 환경에서는 VS Code에 포커스가 있어야 단축키가 작동하므로, 디버깅 중인 앱이 VS Code에 가려집니다.

### 해결책: `captureDelay` 설정

```json
{
  "debugScreenshotMcp.captureDelay": 3000
}
```

### 동작 순서

```
1. VS Code에서 Ctrl+Shift+Alt+D 누름
         │
         ▼
2. 디버그 컨텍스트 즉시 수집 (VS Code 포커스 유지)
         │
         ▼
3. 알림 표시: "3.0초 후 캡처합니다. 대상 앱으로 전환하세요"
         │
         ▼
4. Alt+Tab으로 대상 앱으로 전환
         │
         ▼
5. 3초 후 스크린샷 자동 캡처 (대상 앱이 화면에 표시된 상태)
```

> 💡 **듀얼 모니터 권장**: VS Code와 디버깅 대상 앱을 서로 다른 모니터에 배치하면 `captureDelay`를 0으로 유지할 수 있습니다.

---

## 11. Windows 서비스 등록

HTTP 서버(`mcpServer`)를 Windows 서비스로 등록하면 시스템 시작 시 자동으로 실행됩니다.

### PowerShell (관리자 권한 필요)

```powershell
# 관리자 권한으로 PowerShell 실행
cd <프로젝트_경로>

# 서비스 설치
.\manage-service.ps1 install

# 상태 확인
.\manage-service.ps1 status

# 헬스 체크 (HTTP 응답 확인)
.\manage-service.ps1 health

# 서비스 중지
.\manage-service.ps1 stop

# 서비스 재시작
.\manage-service.ps1 restart

# 서비스 제거
.\manage-service.ps1 uninstall
```

### 배치 스크립트 (cmd.exe)

```cmd
manage-service.bat install
manage-service.bat status
manage-service.bat stop
manage-service.bat uninstall
```

### 서비스 로그 위치

```
~/.debug-screenshot-mcp/logs/
```

---

## 12. 자동 정리 정책

디스크 공간 무제한 증가를 방지하기 위한 자동 정리 정책:

| 구성요소 | 최대 보관 시간 | 최대 보관 수 | 트리거 |
|---------|--------------|------------|--------|
| HTTP 서버 (`mcpServer`) | 1시간 | 50개 | 새 캡처 수신 시 |
| MCP stdio 서버 | — | 20개 | 도구 호출 시 |

정리 대상: `~/.debug-screenshot-mcp/captures/capture-{타임스탬프}/` 디렉토리

---

## 13. 보안 고려사항

### SSRF 방지

`serverUrl` 설정에는 다음 주소만 허용됩니다:
- `localhost` / `127.0.0.1`
- `::1` (IPv6 loopback)
- 사설 IP 대역: `10.x.x.x`, `172.16-31.x.x`, `192.168.x.x`

외부 URL 입력 시 오류 발생.

### 민감정보 마스킹

다음 패턴의 값은 자동으로 `[MASKED]`로 치환됩니다:
- `password:`, `passwd:`, `pwd:`
- `token:`, `access_token:`, `auth_token:`
- `secret:`, `api_secret:`
- `api_key:`, `apikey:`
- `private_key:`, `client_secret:`

### 민감 파일 차단

다음 파일 타입의 내용은 컨텍스트에서 자동 제외됩니다:
- `.env`, `.env.local`, `.env.production`
- `*.key`, `*.pem`, `*.p12`, `*.pfx`
- `*.cert`, `*.crt`

### 스크린샷 크기 제한

개별 스크린샷 최대 크기: **10MB**

---

## 14. 문제 해결

### 확장이 활성화되지 않음

**증상**: 단축키가 작동하지 않거나 출력 채널이 없음

**해결책**:
1. Extension 탭에서 "Debug Screenshot MCP" 확장 활성화 확인
2. `vece package --no-dependencies`로 패키징했다면 제거 후 올바른 방법으로 재패키징
3. Node.js 18+ 설치 여부 확인
4. 출력 채널 로그 확인: `보기` → `출력` → `Debug Screenshot MCP`

---

### MCP 서버에 연결 안 됨

**증상**: "서버가 응답하지 않음" 또는 도구 목록에 서버가 없음

**해결책**:
1. MCP 서버가 실행 중인지 확인:
   ```bash
   node server/dist/mcpStdioServer.js
   ```
2. `.vscode/mcp.json` 경로가 올바른지 확인
3. Copilot Chat의 도구 목록에서 서버를 클릭하여 수동 시작
4. `chat.mcp.autostart`를 `"always"`로 설정

---

### 스크린샷이 검게 나옴 (Windows)

**원인**: GPU 가속 앱의 화면이 캡처되지 않는 경우

**해결책**:
```json
{
  "debugScreenshotMcp.captureDelay": 500
}
```
약간의 딜레이 후 캡처하면 해결되는 경우가 있습니다.

---

### 콜스택이 비어 있음

**원인**: 디버그 세션이 브레이크포인트에서 멈춰 있지 않은 상태에서 캡처

**해결책**: 반드시 디버그 세션이 **일시 중지(paused)** 상태일 때 캡처하세요.  
F5로 세션을 시작하고 브레이크포인트에서 멈춘 직후 단축키를 누르세요.

---

### npm publish 실패 — "You do not have permission"

**원인**: npm 로그인 안 됨 또는 스코프 권한 없음

**해결책**:
```bash
npm login     # npmjs.com 계정으로 로그인
npm whoami    # 로그인 확인
npm publish --access public   # 스코프 패키지는 public 필수
```

---

### MCP Registry publish 실패 — "validation failed"

**원인**: server.json의 description이 100자를 초과

**해결책**: description을 100자 이내로 줄이고 재시도:
```bash
mcp-publisher validate   # 재검증
mcp-publisher publish    # 재배포
```

---

## 15. 배포 / 배포자 가이드

이 섹션은 패키지를 npm 및 MCP Registry에 배포하는 담당자를 위한 내용입니다.

### npm 패키지 배포 (`@countjung/debug-screenshot-mcp`)

```bash
# 1. server/ 디렉토리로 이동
cd server

# 2. npm 로그인 (최초 1회)
npm login

# 3. 배포 전 패키지 파일 확인 (실제 배포 안 함)
npm pack --dry-run

# 4. 배포 실행
npm publish --access public

# 5. 배포 확인
npm view @countjung/debug-screenshot-mcp
```

#### 버전 업데이트 시

```bash
# server/package.json 버전 업데이트
npm version patch   # 0.1.0 → 0.1.1 (버그픽스)
npm version minor   # 0.1.1 → 0.2.0 (새 기능)
npm version major   # 0.2.0 → 1.0.0 (주요 변경)

# server.json 버전도 동일하게 업데이트 필요!
# server/server.json의 "version"과 packages[0].version 수정

# 재배포
npm publish --access public
```

---

### MCP Registry 배포

#### 사전 준비

1. **npm 패키지 배포 완료** (위 단계 선행 필수)
2. **mcp-publisher CLI 설치** (최초 1회):

   **Windows (PowerShell)**:
   ```powershell
   $arch = if ([System.Runtime.InteropServices.RuntimeInformation]::ProcessArchitecture -eq "Arm64") { "arm64" } else { "amd64" }
   Invoke-WebRequest -Uri "https://github.com/modelcontextprotocol/registry/releases/latest/download/mcp-publisher_windows_$arch.tar.gz" -OutFile "mcp-publisher.tar.gz"
   tar xf mcp-publisher.tar.gz mcp-publisher.exe
   # mcp-publisher.exe를 PATH에 포함된 디렉토리로 이동
   Move-Item mcp-publisher.exe "$env:USERPROFILE\.local\bin\mcp-publisher.exe"
   ```

   **macOS/Linux**:
   ```bash
   curl -L "https://github.com/modelcontextprotocol/registry/releases/latest/download/mcp-publisher_$(uname -s | tr '[:upper:]' '[:lower:]')_$(uname -m | sed 's/x86_64/amd64/;s/aarch64/arm64/').tar.gz" | tar xz mcp-publisher
   sudo mv mcp-publisher /usr/local/bin/
   ```

3. **설치 확인**:
   ```bash
   mcp-publisher --help
   ```

#### 배포 절차

```bash
# 1. server/ 디렉토리로 이동
cd server

# 2. server.json 검증
mcp-publisher validate

# 3. GitHub 인증 (최초 1회 또는 토큰 만료 시)
mcp-publisher login github
# → 터미널에 표시되는 URL 방문 후 코드 입력

# 4. MCP Registry에 배포
mcp-publisher publish

# 5. 배포 확인
curl "https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.CountJung/debug-screenshot-mcp"
```

#### 버전 업데이트 시 server.json 수정 예시

```json
{
  "$schema": "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
  "name": "io.github.CountJung/debug-screenshot-mcp",
  "title": "Debug Screenshot MCP",
  "description": "Captures debug screenshots, call stacks, and local variables from VS Code for AI agents.",
  "repository": {
    "url": "https://github.com/CountJung/VSCodeScreenshotDebugExtension",
    "source": "github"
  },
  "version": "0.1.1",
  "packages": [
    {
      "registryType": "npm",
      "identifier": "@countjung/debug-screenshot-mcp",
      "version": "0.1.1",
      "transport": {
        "type": "stdio"
      }
    }
  ]
}
```

#### GitHub Actions로 자동 배포 (선택사항)

`.github/workflows/publish.yml` 예시:

```yaml
name: Publish to MCP Registry

on:
  release:
    types: [published]

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      id-token: write  # GitHub OIDC 인증에 필요
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'
      
      - name: Install dependencies & build
        run: |
          cd server
          npm ci
          npm run build
      
      - name: Publish to npm
        run: |
          cd server
          npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
      
      - name: Install mcp-publisher
        run: |
          curl -L "https://github.com/modelcontextprotocol/registry/releases/latest/download/mcp-publisher_linux_amd64.tar.gz" | tar xz mcp-publisher
          sudo mv mcp-publisher /usr/local/bin/
      
      - name: Publish to MCP Registry
        run: |
          cd server
          mcp-publisher publish
```

> GitHub Actions에서는 `mcp-publisher login` 없이 OIDC로 자동 인증됩니다.  
> `id-token: write` 권한과 `io.github.CountJung/` 네임스페이스가 일치하면 자동 통과.

---

## 참고 링크

| 리소스 | URL |
|--------|-----|
| GitHub 저장소 | https://github.com/CountJung/VSCodeScreenshotDebugExtension |
| npm 패키지 | https://www.npmjs.com/package/@countjung/debug-screenshot-mcp |
| MCP Registry | https://registry.modelcontextprotocol.io/servers/io.github.CountJung/debug-screenshot-mcp |
| MCP Registry 퀵스타트 | https://modelcontextprotocol.io/registry/quickstart |
| mcp-publisher 릴리즈 | https://github.com/modelcontextprotocol/registry/releases |

---

*MIT License — Copyright (c) 2024 CountJung*
