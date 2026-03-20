# VSCode Screenshot Debug MCP Extension — TODO List

> 목적: AI 코딩 에이전트에게 디버그 오류 현상(스크린샷 + 상태정보 + 콜스택 + 컨텍스트)을 정확히 전달하기 위한 VSCode Extension + MCP Server 구축  
> 각 Phase 완료 시 **셀프 테스트** 항목을 반드시 수행하여 검증한다.

---

## Phase 0 — 사전 환경 준비

- [ ] **0-1** Node.js 및 npm 버전 확인 (Node >= 18, npm >= 9)
  ```
  node -v && npm -v
  ```
- [ ] **0-2** TypeScript 전역 설치 확인
  ```
  tsc -v
  ```
- [ ] **0-3** VSCode Extension 생성기 전역 설치
  ```
  npm install -g yo generator-code
  ```
- [ ] **0-4** vsce 패키징 도구 전역 설치
  ```
  npm install -g @vscode/vsce
  ```

### ✅ Phase 0 셀프 테스트
- [ ] `yo --version` 출력 확인
- [ ] `vsce --version` 출력 확인

---

## Phase 1 — 프로젝트 초기화

- [ ] **1-1** `yo code` 로 TypeScript Extension 프로젝트 생성
  - Template: `New Extension (TypeScript)`
  - Project name: `debug-screenshot-mcp`
  - Bundle: `No` (webpack/esbuild 미사용)
  - Package manager: `npm`
- [ ] **1-2** 프로젝트 디렉터리 구조 확인 (package.json, tsconfig.json, src/extension.ts 존재 여부)
- [ ] **1-3** 필수 의존성 설치
  ```
  npm install screenshot-desktop
  npm install @modelcontextprotocol/sdk
  ```
- [ ] **1-4** 개발 의존성 설치
  ```
  npm install --save-dev @types/node
  ```
- [ ] **1-5** 디렉터리 구조 생성
  ```
  src/commands/
  src/capture/
  src/context/
  src/mcp/
  src/utils/
  server/
  ```

### ✅ Phase 1 셀프 테스트
- [ ] `npm install` 오류 없이 완료
- [ ] `node_modules/screenshot-desktop` 존재 확인
- [ ] `node_modules/@modelcontextprotocol` 존재 확인

---

## Phase 2 — tsconfig.json 및 package.json 설정

- [ ] **2-1** `tsconfig.json` 설정
  - `outDir`: `./out`
  - `rootDir`: `./src`
  - `strict`: `true`
  - `target`: `ES2020`
  - `module`: `commonjs`
- [ ] **2-2** `package.json` 설정 — Extension 기본 정보
  - `name`: `debug-screenshot-mcp`
  - `displayName`: `Debug Screenshot MCP`
  - `description`: AI 디버그 지원용 스크린샷 및 컨텍스트 캡처
  - `engines.vscode`: `^1.85.0`
- [ ] **2-3** `package.json` — commands 등록
  ```json
  "contributes": {
    "commands": [
      {
        "command": "debugScreenshot.capture",
        "title": "Debug Screenshot: Capture & Send to MCP"
      }
    ],
    "keybindings": [
      {
        "command": "debugScreenshot.capture",
        "key": "ctrl+shift+alt+d",
        "mac": "cmd+shift+alt+d"
      }
    ]
  }
  ```
- [ ] **2-4** `package.json` — scripts 설정
  ```json
  "scripts": {
    "compile": "tsc -p ./",
    "watch": "tsc -watch -p ./",
    "package": "vsce package",
    "lint": "eslint src"
  }
  ```
- [ ] **2-5** `package.json` — activationEvents 설정
  ```json
  "activationEvents": ["onCommand:debugScreenshot.capture"]
  ```

### ✅ Phase 2 셀프 테스트
- [ ] `npm run compile` 에러 없이 완료
- [ ] `out/` 디렉터리 생성 확인

---

## Phase 3 — utils/encoding.ts 구현

- [ ] **3-1** `src/utils/encoding.ts` 파일 생성
  - `imageToBase64(filePath: string): string` 함수 구현
  - fs.readFileSync로 파일 읽어 base64 인코딩 반환
- [ ] **3-2** 임시 파일 경로 생성 헬퍼 구현
  - OS temp 디렉터리에 `debug-screenshot-{timestamp}.png` 형식으로 경로 반환
- [ ] **3-3** 임시 파일 삭제 헬퍼 구현

### ✅ Phase 3 셀프 테스트
- [ ] `npm run compile` 통과
- [ ] encoding.ts 독립 실행 테스트 (임의 이미지 파일 base64 변환 확인)

---

## Phase 4 — capture/screenshot.ts 구현

- [ ] **4-1** `src/capture/screenshot.ts` 파일 생성
- [ ] **4-2** `captureScreen(): Promise<string>` 함수 구현
  - `screenshot-desktop` 라이브러리 사용
  - 캡처 결과를 임시 파일에 저장
  - base64 문자열로 변환하여 반환
  - 캡처 완료 후 임시 파일 삭제 (cleanup)
- [ ] **4-3** 멀티모니터 환경 대응
  - `screenshot.listDisplays()` 사용하여 주 모니터 식별
- [ ] **4-4** 에러 핸들링
  - 캡처 실패 시 명확한 에러 메시지 throw

### ✅ Phase 4 셀프 테스트
- [ ] `npm run compile` 통과
- [ ] VSCode Extension Host(F5)에서 실행 후 스크린샷 캡처 정상 동작 확인
- [ ] 생성된 base64 문자열 길이가 0보다 큰지 확인

---

## Phase 5 — context/vscodeContext.ts 구현

- [ ] **5-1** `src/context/vscodeContext.ts` 파일 생성
- [ ] **5-2** 기본 편집기 컨텍스트 수집
  - 현재 활성 파일 경로 (`vscode.window.activeTextEditor?.document.fileName`)
  - 현재 커서 라인 번호
  - 선택된 코드 스니펫
  - 워크스페이스 경로
- [ ] **5-3** 디버그 세션 컨텍스트 수집
  - 활성 디버그 세션 이름 (`vscode.debug.activeDebugSession`)
  - 디버그 세션 타입 (node, python, cppvsdbg 등)
- [ ] **5-4** 콜스택 정보 수집
  - `vscode.debug.activeDebugSession.customRequest('stackTrace', ...)` 사용
  - 스택 프레임 목록 (파일명, 라인, 함수명)
  - 현재 스코프 변수 정보 수집 (`scopes`, `variables` DAP 요청)
- [ ] **5-5** 디버그 콘솔 출력 수집
  - `vscode.debug.onDidReceiveDebugSessionCustomEvent` 이벤트 리스닝
  - 최근 N줄 버퍼링 (기본값: 100줄)
- [ ] **5-6** 터미널 출력 수집
  - `vscode.window.terminals` 목록에서 활성 터미널 식별
  - Shell Integration API 사용 (VSCode 1.85+)
- [ ] **5-7** Git 컨텍스트 수집 (선택)
  - `vscode.extensions.getExtension('vscode.git')` API 활용
  - 현재 브랜치명, 최신 커밋 해시 수집
- [ ] **5-8** `DebugContext` 인터페이스 정의 및 export
  ```typescript
  export interface DebugContext {
    filePath: string;
    lineNumber: number;
    selectedCode: string;
    workspacePath: string;
    debugSessionName: string;
    debugSessionType: string;
    callStack: StackFrame[];
    localVariables: Variable[];
    debugConsoleOutput: string;
    terminalOutput: string;
    gitBranch?: string;
    gitCommitHash?: string;
    timestamp: string;
  }
  ```

### ✅ Phase 5 셀프 테스트
- [ ] `npm run compile` 통과
- [ ] F5 Extension Host에서 breakpoint 중단 상태에서 컨텍스트 수집 실행
- [ ] 콜스택 정보가 올바르게 포함되는지 Output Channel로 확인
- [ ] 파일 경로, 라인 번호 정확도 확인

---

## Phase 6 — mcp/mcpClient.ts 구현

- [ ] **6-1** `src/mcp/mcpClient.ts` 파일 생성
- [ ] **6-2** MCP 서버 연결 설정 (stdio 방식)
  - `@modelcontextprotocol/sdk` `Client` 클래스 사용
  - `StdioClientTransport` 또는 `SSEClientTransport` 구현
- [ ] **6-3** `sendDebugCapture(payload: McpPayload): Promise<McpResponse>` 함수 구현
  ```typescript
  export interface McpPayload {
    type: "debug_capture";
    screenshot: string;       // base64
    context: DebugContext;
  }
  ```
- [ ] **6-4** MCP 서버 URL/포트 설정 (VSCode Settings에서 읽기)
  - `vscode.workspace.getConfiguration('debugScreenshotMcp').get('serverUrl')`
  - 기본값: `http://localhost:5010`
- [ ] **6-5** HTTP fallback 구현 (MCP SDK 미사용 환경 대응)
  - `node:http` / `node:https` 모듈로 POST 요청
- [ ] **6-6** 요청 타임아웃 설정 (기본: 30초)
- [ ] **6-7** 에러 핸들링 및 재시도 로직 (최대 2회)

### ✅ Phase 6 셀프 테스트
- [ ] `npm run compile` 통과
- [ ] Mock 서버(localhost:5010) 실행 후 페이로드 전송 확인
- [ ] 서버 미가동 시 에러 알림이 VSCode에 표시되는지 확인

---

## Phase 7 — MCP 서버 구현 (server/mcpServer.ts)

- [ ] **7-1** `server/mcpServer.ts` 파일 생성
- [ ] **7-2** `@modelcontextprotocol/sdk` `McpServer` / `Server` 클래스로 서버 초기화
- [ ] **7-3** `receive_debug_capture` 툴 정의
  ```typescript
  server.tool("receive_debug_capture", {
    description: "AI 디버그 지원: 스크린샷 + 컨텍스트 수신",
    parameters: McpPayloadSchema  // zod schema
  }, async (payload) => { ... })
  ```
- [ ] **7-4** 수신된 페이로드 처리
  - 스크린샷 Base64 디코딩 후 임시 파일 저장
  - 컨텍스트 정보 구조화하여 로깅
  - AI 에이전트에게 전달할 분석 요약 텍스트 생성
- [ ] **7-5** 응답 포맷 정의
  ```json
  {
    "status": "received",
    "analysisHint": "오류 발생 위치 및 컨텍스트 요약 텍스트"
  }
  ```
- [ ] **7-6** `StdioServerTransport` 연결 (Claude Desktop 등 MCP 클라이언트와의 통합)
- [ ] **7-7** HTTP 엔드포인트도 별도 제공 (Express.js 또는 내장 http)
  - `POST /debug-capture` 엔드포인트
  - 포트: `5010` (설정 가능)
- [ ] **7-8** `server/package.json` 및 `server/tsconfig.json` 별도 구성

### ✅ Phase 7 셀프 테스트
- [ ] `ts-node server/mcpServer.ts` 로 서버 기동 확인
- [ ] `curl -X POST http://localhost:5010/debug-capture` 로 테스트 페이로드 전송
- [ ] 수신 로그 출력 및 응답 JSON 확인
- [ ] MCP 툴 `receive_debug_capture` 호출 정상 동작 확인

---

## Phase 8 — commands/captureDebug.ts 구현

- [ ] **8-1** `src/commands/captureDebug.ts` 파일 생성
- [ ] **8-2** `captureAndSend()` 함수 구현 (메인 커맨드 핸들러)
  ```
  1. vscode.window.withProgress()로 진행 표시 시작
  2. captureScreen() 호출
  3. collectDebugContext() 호출
  4. sendDebugCapture(payload) 호출
  5. 성공/실패 알림 표시
  ```
- [ ] **8-3** 진행 상태 메시지 단계별 표시
  - "스크린샷 캡처 중..."
  - "디버그 컨텍스트 수집 중..."
  - "MCP 서버로 전송 중..."
  - "완료 / 실패"
- [ ] **8-4** Output Channel 생성 (디버그 정보 로깅용)
  - `vscode.window.createOutputChannel('Debug Screenshot MCP')`
  - 수집된 컨텍스트 전체를 Output Channel에 기록

### ✅ Phase 8 셀프 테스트
- [ ] `npm run compile` 통과
- [ ] F5 Extension Host에서 `Ctrl+Shift+Alt+D` 실행
- [ ] Progress 알림이 화면에 표시되고 완료 메시지 확인
- [ ] Output Channel에 컨텍스트 데이터 출력 확인

---

## Phase 9 — extension.ts 메인 진입점 구현

- [ ] **9-1** `src/extension.ts` 업데이트
  - `activate(context)` 함수에서 커맨드 등록
  ```typescript
  context.subscriptions.push(
    vscode.commands.registerCommand('debugScreenshot.capture', captureAndSend)
  );
  ```
- [ ] **9-2** `deactivate()` 함수 구현 (리소스 해제)
- [ ] **9-3** Output Channel 초기화 및 Extension 생명주기 연결
- [ ] **9-4** Extension 설정 스키마 추가 (`package.json`)
  ```json
  "configuration": {
    "title": "Debug Screenshot MCP",
    "properties": {
      "debugScreenshotMcp.serverUrl": {
        "type": "string",
        "default": "http://localhost:5010",
        "description": "MCP 서버 URL"
      },
      "debugScreenshotMcp.maxConsoleLines": {
        "type": "number",
        "default": 100,
        "description": "디버그 콘솔 최대 수집 라인 수"
      }
    }
  }
  ```

### ✅ Phase 9 셀프 테스트
- [ ] F5로 Extension Host 실행 후 Command Palette에서 "Debug Screenshot" 검색 확인
- [ ] 커맨드 목록에 `Debug Screenshot: Capture & Send to MCP` 표시 확인
- [ ] `Ctrl+Shift+Alt+D` 단축키 동작 확인

---

## Phase 10 — 통합 테스트

- [ ] **10-1** 전체 플로우 통합 테스트 시나리오 작성
  ```
  [시나리오 A] 일반 편집 상태에서 캡처
  [시나리오 B] 디버그 세션 진입 후 breakpoint 중단 상태에서 캡처
  [시나리오 C] MCP 서버 미가동 상태에서 캡처 (에러 처리 확인)
  [시나리오 D] 활성 터미널 없는 상태에서 캡처 (graceful 처리 확인)
  ```
- [ ] **10-2** 시나리오 A 수행 및 결과 기록
- [ ] **10-3** 시나리오 B 수행 및 결과 기록
  - Node.js 샘플 앱 작성 → 런타임 에러 발생 → Extension 실행
  - 콜스택 정보 포함 여부 확인
- [ ] **10-4** 시나리오 C 수행 및 결과 기록 (사용자 에러 알림 표시 확인)
- [ ] **10-5** 시나리오 D 수행 및 결과 기록 (크래시 없이 graceful 처리 확인)
- [ ] **10-6** 멀티모니터 환경 테스트 (가능한 경우)

### ✅ Phase 10 셀프 테스트 체크리스트
- [ ] 시나리오 A~D 모두 크래시 없이 완료
- [ ] 시나리오 B에서 MCP 서버가 올바른 콜스택 데이터 수신 확인
- [ ] 페이로드 JSON 구조가 MasterPlan 2.3 명세와 일치 확인

---

## Phase 11 — 보안 검토

- [ ] **11-1** `.env` 및 시크릿 키가 페이로드에 포함되지 않도록 필터 구현
  - 파일명 패턴 검사: `.env`, `*.key`, `*.pem`, `*secret*`, `*token*`
  - 선택 코드에서 환경변수 패턴(`process.env.XXX`) 마스킹
- [ ] **11-2** Base64 스크린샷 크기 제한 설정 (최대 10MB)
- [ ] **11-3** MCP 서버 URL XSS/Injection 방지 (URL 유효성 검증)
- [ ] **11-4** 터미널 출력에서 패스워드 패턴 마스킹 (`password:`, `token:`, `secret:`)

### ✅ Phase 11 셀프 테스트
- [ ] `.env` 파일 내용이 수집된 컨텍스트에 포함되지 않음 확인
- [ ] 비정상 URL 입력 시 에러 메시지 표시 확인

---

## Phase 12 — .vsix 패키징

- [ ] **12-1** `README.md` 작성 (설치 방법, 사용법, 설정 옵션)
- [ ] **12-2** `LICENSE` 파일 추가 (MIT 또는 Apache 2.0)
- [ ] **12-3** `.vscodeignore` 파일 설정 (불필요 파일 제외)
  ```
  .vscode/**
  src/**
  node_modules/**
  **/*.ts
  !out/**
  ```
- [ ] **12-4** `npm run compile` 최종 빌드
- [ ] **12-5** `vsce package` 실행 → `debug-screenshot-mcp-x.x.x.vsix` 생성 확인
- [ ] **12-6** 생성된 .vsix 설치 테스트
  ```
  code --install-extension debug-screenshot-mcp-x.x.x.vsix
  ```

### ✅ Phase 12 셀프 테스트
- [ ] .vsix 파일 생성 확인
- [ ] 새 VSCode 창에서 Extension 설치 및 활성화 확인
- [ ] 설치된 Extension에서 `Ctrl+Shift+Alt+D` 동작 확인
- [ ] Extension 목록에서 "Debug Screenshot MCP" 표시 확인

---

## Phase 13 — MCP 클라이언트 통합 테스트 (Claude Desktop 등)

- [ ] **13-1** Claude Desktop 또는 호환 MCP 클라이언트 `mcp_servers` 설정에 서버 등록
- [ ] **13-2** Extension에서 캡처 실행 → MCP 서버 수신 → AI 툴 응답 확인
- [ ] **13-3** AI 에이전트가 스크린샷을 올바르게 해석하는지 확인
- [ ] **13-4** 콜스택 / 변수 / 터미널 정보가 AI 프롬프트에 포함되는지 확인

### ✅ Phase 13 셀프 테스트
- [ ] MCP 툴 호출 로그 확인
- [ ] AI 응답에 디버그 컨텍스트 기반 분석 내용 포함 확인

---

## 전체 진행 현황 요약

| Phase | 내용 | 상태 |
|-------|------|------|
| 0 | 환경 준비 (Node, TS, yo, vsce) | ✅ |
| 1 | 프로젝트 초기화 | ✅ |
| 2 | tsconfig / package.json 설정 | ✅ |
| 3 | utils/encoding.ts | ✅ |
| 4 | capture/screenshot.ts | ✅ |
| 5 | context/vscodeContext.ts (콜스택/변수/Git) | ✅ |
| 6 | mcp/mcpClient.ts | ✅ |
| 7 | server/mcpServer.ts | ✅ |
| 8 | commands/captureDebug.ts | ✅ |
| 9 | extension.ts 메인 진입점 | ✅ |
| 10 | 통합 테스트 | ✅ |
| 11 | 보안 검토 (마스킹/SSRF방지/크기제한) | ✅ |
| 12 | .vsix 패키징 및 설치 | ✅ |
| 13 | MCP 클라이언트 통합 테스트 | ⬜ |
| 14 | Windows 서비스 등록 (node-windows) | ✅ |
| 15 | 서비스 관리 스크립트 (PS1/BAT) | ✅ |
| 16 | 루트 .gitignore | ✅ |
| 17 | 루트 README (EN/KR) | ✅ |

> 상태 범례: ⬜ 미시작 / 🔄 진행중 / ✅ 완료 / ❌ 차단됨

---

## Phase 14 — Windows 서비스 등록 (node-windows)

- [x] **14-1** `node-windows` 패키지 설치 (`server/package.json`)
- [x] **14-2** `server/serviceManager.ts` 구현
  - `install` / `uninstall` / `start` / `stop` / `restart` / `status` CLI 커맨드
  - Windows 서비스 이름: `DebugScreenshotMCP`
  - 실패 시 자동 재시작 (maxRestarts: 10, grow: 0.5s)
  - `MCP_PORT` 환경변수 지원
- [x] **14-3** 서버 빌드 (`npx tsc`) — `dist/serviceManager.js` 생성 확인
- [x] **14-4** `serviceManager.js help` / `status` 동작 확인

### ✅ Phase 14 셀프 테스트
- [x] `node dist/serviceManager.js help` — CLI 도움말 정상 출력
- [x] `node dist/serviceManager.js status` — 미설치 상태 정상 표시
- [x] `server/package.json`에 `service:*` npm 스크립트 등록 확인

---

## Phase 15 — 서비스 관리 스크립트 (PS1 / BAT)

- [x] **15-1** `manage-service.ps1` 파워셸 스크립트 작성
  - `install` / `uninstall` / `start` / `stop` / `restart` / `status` / `health` 지원
  - 관리자 권한 검사
  - 미빌드 시 자동 빌드
  - Health Check (HTTP GET /health)
- [x] **15-2** `manage-service.bat` 배치 스크립트 작성
- [x] **15-3** 서버 포그라운드 기동 동작 테스트 (Health Check 통과)

### ✅ Phase 15 셀프 테스트
- [x] `manage-service.ps1 help` 도움말 출력
- [x] `Invoke-WebRequest http://127.0.0.1:5010/health` → `{"status":"ok","port":5010}`

---

## Phase 16 — 루트 .gitignore

- [x] **16-1** 프로젝트 전용 `.gitignore` 생성 (node_modules, out, dist, .vsix 등)

---

## Phase 17 — 루트 README (영문/한글)

- [x] **17-1** 영문 + 한글 순서로 루트 `README.md` 작성
- [x] **17-2** 서브폴더 README 내용 반영 및 서비스 관리 안내 추가

---

## Phase 18 — 프로젝트 구조 정리

- [x] **18-1** `debug-screenshot-mcp/` 서브폴더 내용을 루트로 이동 (Git 히스토리 보존)
- [x] **18-2** `.vscode/mcp.json`, `.github/copilot-instructions.md` 경로 참조 업데이트
- [x] **18-3** 전역 MCP settings.json 등록 (VS Code User Settings)
- [x] **18-4** README.md 전면 재작성 (MCP 도구 사용법, 연결 확인 방법 추가)
- [x] **18-5** Windows 서비스 이름 수정 (`node-windows`는 소문자+.exe로 등록)
  - `serviceManager.ts` — `sc query` 서비스명을 `SERVICE_NAME.toLowerCase() + '.exe'`로 수정
  - `manage-service.ps1` — `$ServiceName`을 `"debugscreenshotmcp.exe"`로 수정

---

## Phase 19 — 단일 모니터 캡처 딜레이

- [x] **19-1** `debugScreenshotMcp.captureDelay` 설정 추가 (package.json, 기본값 0ms, 최대 10000ms)
- [x] **19-2** 캡처 파이프라인 실행 순서 변경 (`captureDebug.ts`)
  - 기존: 스크린샷 → 컨텍스트 → 마스킹 → 저장 → 전송
  - 변경: **컨텍스트(DAP) → 딜레이(Alt+Tab 시간) → 스크린샷 → 마스킹 → 저장 → 전송**
  - 이유: 디버그 컨텍스트는 VS Code 포커스 상태에서 수집해야 하고, 스크린샷은 대상 앱이 보여야 함
- [x] **19-3** 딜레이 중 알림 메시지 표시 ("N초 후 캡처... 대상 앱으로 전환하세요")
- [x] **19-4** README 영문/한글 "단일 모니터 환경" 섹션 추가, Configuration 테이블에 `captureDelay` 추가
