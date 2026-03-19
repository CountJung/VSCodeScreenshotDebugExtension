# Project Guidelines

## Overview

VS Code 확장 + MCP 서버로 구성된 **디버깅 스크린샷 캡처** 도구.  
다중 모니터 스크린샷, 콜스택, 로컬 변수, 디버그 콘솔 출력을 캡처하여 AI 에이전트에 전달한다.

## Architecture

```
debug-screenshot-mcp/
├── src/           ← VS Code 확장 (TypeScript → out/)
│   ├── extension.ts        # 진입점 (activate/deactivate)
│   ├── capture/             # screenshot-desktop 기반 다중 모니터 캡처
│   ├── commands/            # captureDebug.ts — 메인 커맨드 파이프라인
│   ├── context/             # DAP 기반 디버그 컨텍스트 수집
│   ├── mcp/                 # HTTP 클라이언트 (→ mcpServer.ts)
│   └── utils/               # Base64, 보안 마스킹
└── server/        ← MCP 서버 (TypeScript → dist/)
    ├── mcpServer.ts         # HTTP 서버 (포트 5010)
    ├── mcpStdioServer.ts    # MCP stdio 프로토콜 서버 (AI 도구 연동)
    └── serviceManager.ts    # Windows 서비스 등록 (node-windows)
```

**데이터 흐름**: `Ctrl+Shift+Alt+D` → 전체 모니터 캡처 → 디버그 컨텍스트 수집 → 민감정보 마스킹 → 디스크 저장(`~/.debug-screenshot-mcp/captures/`) + HTTP 전송

확장과 서버는 **별도 tsconfig.json**, **별도 package.json**으로 독립 빌드된다.

## Build and Test

```bash
# 확장 빌드
cd debug-screenshot-mcp
npm run compile          # tsc -p ./ → out/

# 서버 빌드
cd debug-screenshot-mcp/server
npm run build            # tsc -p tsconfig.json → dist/

# 확장 패키징 (.vsix)
cd debug-screenshot-mcp
vsce package             # --no-dependencies 사용 금지 (런타임 의존성 필요)

# 서버 실행
cd debug-screenshot-mcp/server
npm start                # node dist/mcpServer.js (HTTP)
node dist/mcpStdioServer.js  # MCP stdio (AI 도구용)
```

**주의**: `vsce package` 시 `--no-dependencies` 플래그를 사용하면 `screenshot-desktop` 등 런타임 의존성이 누락되어 확장 활성화가 실패한다.

## Conventions

- **TypeScript strict 모드**: 양쪽 tsconfig 모두 `"strict": true`, target `ES2020`, module `commonjs`
- **screenshot-desktop**: ESM 미지원 → `const screenshot = require('screenshot-desktop')` 패턴 사용
- **보안**: `utils/security.ts`의 `maskSensitiveData()`로 민감정보(비밀번호, 토큰, 키, 인증서) 마스킹 필수
- **SSRF 방지**: `mcpClient.ts`의 `validateServerUrl()`에서 localhost/사설IP만 허용
- **MCP 프로토콜**: `@modelcontextprotocol/sdk` 사용, stdio transport, `McpServer` 고수준 API + `zod/v4`로 스키마 정의
- **확장 패키징**: `.vscodeignore`에서 `server/**`, 빌드 도구(`@modelcontextprotocol`, `zod`)는 제외하되 런타임 의존성(`screenshot-desktop`, `temp` 등)은 반드시 포함
- **자동 정리**: 서버는 스크린샷 1시간/50개 제한, MCP stdio 서버는 캡처 20개 제한으로 디스크 누적 방지
- **로그**: 확장은 `Debug Screenshot MCP` Output Channel, 서버는 `console.log`/`console.error` 사용

## Code Style

- 한국어 사용자 대상 — UI 메시지, 주석은 한국어, 코드 식별자 및 MCP tool name/description은 영문
- 함수 단위 JSDoc 주석 (`/** */`)
- 인터페이스는 사용처 파일에 정의 (`DebugContext` → `vscodeContext.ts`, `McpPayload` → `mcpClient.ts`)
- 에러 핸들링: `catch` 블록에서 `err instanceof Error ? err.message : String(err)` 패턴

## Key Files

| 역할 | 파일 |
|------|------|
| 확장 진입점 | `src/extension.ts` |
| 캡처 파이프라인 | `src/commands/captureDebug.ts` |
| 스크린샷 로직 | `src/capture/screenshot.ts` |
| MCP stdio 서버 | `server/mcpStdioServer.ts` |
| MCP 등록 설정 | `.vscode/mcp.json` |
| 프로젝트 로드맵 | `MasterPlan.md`, `TODO.md` |
