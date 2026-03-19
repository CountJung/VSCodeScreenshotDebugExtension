import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const PORT = process.env.MCP_PORT ? parseInt(process.env.MCP_PORT, 10) : 5010;

// 스크린샷 자동 정리 설정
const SCREENSHOT_MAX_AGE_MS = 60 * 60 * 1000;           // 1시간
const SCREENSHOT_MAX_COUNT = 50;                          // 최대 보관 개수
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;              // 10분마다 정리
const SCREENSHOT_FILE_PATTERN = /^mcp-debug-capture-\d+\.png$/;

interface StackFrame {
    frameId: number;
    name: string;
    source?: string;
    line?: number;
    column?: number;
}

interface Variable {
    name: string;
    value: string;
    type?: string;
}

interface DebugContext {
    filePath: string;
    lineNumber: number;
    selectedCode: string;
    workspacePath: string;
    languageId: string;
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

interface DebugCapturePayload {
    type: 'debug_capture';
    screenshot: string;
    screenshots?: Array<{ displayId: string; displayName: string; base64: string }>;
    file: string;
    line: number;
    code: string;
    terminal: string;
    debugConsole: string;
    context: DebugContext;
    timestamp: string;
}

/**
 * 수신된 디버그 캡처 페이로드를 분석하여 AI 힌트 텍스트 생성
 */
function generateAnalysisHint(payload: DebugCapturePayload): string {
    const lines: string[] = [];

    lines.push(`=== Debug Capture Analysis ===`);
    lines.push(`Timestamp: ${payload.timestamp}`);
    lines.push(`File: ${payload.file}:${payload.line}`);
    lines.push(`Language: ${payload.context.languageId}`);
    lines.push(`Workspace: ${payload.context.workspacePath}`);

    if (payload.context.debugSessionName) {
        lines.push(`\nDebug Session: ${payload.context.debugSessionName} (${payload.context.debugSessionType})`);
    }

    if (payload.context.gitBranch) {
        lines.push(`Git: ${payload.context.gitBranch} @ ${payload.context.gitCommitHash ?? 'unknown'}`);
    }

    if (payload.code) {
        lines.push(`\nSelected Code:\n${payload.code}`);
    }

    if (payload.context.callStack.length > 0) {
        lines.push(`\nCall Stack (${payload.context.callStack.length} frames):`);
        payload.context.callStack.forEach((f, i) => {
            lines.push(`  [${i}] ${f.name} at ${f.source ?? '?'}:${f.line ?? '?'}`);
        });
    }

    if (payload.context.localVariables.length > 0) {
        lines.push(`\nLocal Variables:`);
        payload.context.localVariables.forEach(v => {
            lines.push(`  ${v.name}: ${v.type ?? '?'} = ${v.value}`);
        });
    }

    if (payload.debugConsole) {
        const consoleLines = payload.debugConsole.split('\n').slice(-20);
        lines.push(`\nDebug Console (last 20 lines):\n${consoleLines.join('\n')}`);
    }

    if (payload.terminal) {
        lines.push(`\nTerminal: ${payload.terminal}`);
    }

    return lines.join('\n');
}

/**
 * Base64 스크린샷을 임시 파일로 저장 후 경로 반환
 */
function saveScreenshot(base64: string): string {
    const timestamp = Date.now();
    const filePath = path.join(os.tmpdir(), `mcp-debug-capture-${timestamp}.png`);
    const buffer = Buffer.from(base64, 'base64');
    fs.writeFileSync(filePath, buffer);
    return filePath;
}

/**
 * 오래된 스크린샷 파일 정리
 * - maxAge보다 오래된 파일 삭제
 * - 파일 수가 maxCount를 초과하면 오래된 순서로 삭제
 */
function cleanupScreenshots(): { deleted: number; remaining: number } {
    const tmpDir = os.tmpdir();
    let deleted = 0;

    try {
        const files = fs.readdirSync(tmpDir)
            .filter(f => SCREENSHOT_FILE_PATTERN.test(f))
            .map(f => {
                const fullPath = path.join(tmpDir, f);
                const stat = fs.statSync(fullPath);
                return { name: f, path: fullPath, mtimeMs: stat.mtimeMs };
            })
            .sort((a, b) => b.mtimeMs - a.mtimeMs); // 최신순 정렬

        const now = Date.now();

        for (const file of files) {
            const age = now - file.mtimeMs;
            if (age > SCREENSHOT_MAX_AGE_MS) {
                try {
                    fs.unlinkSync(file.path);
                    deleted++;
                } catch { /* 삭제 실패 무시 */ }
            }
        }

        // maxAge로 삭제 후에도 개수 초과 시 오래된 것부터 추가 삭제
        const remaining = files.filter(f => {
            try { return fs.existsSync(f.path); } catch { return false; }
        });

        if (remaining.length > SCREENSHOT_MAX_COUNT) {
            const toRemove = remaining.slice(SCREENSHOT_MAX_COUNT);
            for (const file of toRemove) {
                try {
                    fs.unlinkSync(file.path);
                    deleted++;
                } catch { /* 삭제 실패 무시 */ }
            }
        }

        const finalCount = remaining.length - (remaining.length > SCREENSHOT_MAX_COUNT ? remaining.length - SCREENSHOT_MAX_COUNT : 0);
        if (deleted > 0) {
            console.log(`[MCP Server] 스크린샷 정리: ${deleted}개 삭제, ${finalCount}개 남음`);
        }
        return { deleted, remaining: finalCount };
    } catch (err) {
        console.error('[MCP Server] 스크린샷 정리 오류:', err);
        return { deleted: 0, remaining: -1 };
    }
}

// 주기적 정리 타이머
setInterval(() => {
    cleanupScreenshots();
}, CLEANUP_INTERVAL_MS);

/**
 * HTTP 서버 생성 및 시작
 */
const server = http.createServer((req, res) => {
    // CORS 헤더 (로컬 개발 환경)
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    if (req.method === 'POST' && req.url === '/debug-capture') {
        let body = '';
        req.on('data', chunk => (body += chunk));
        req.on('end', () => {
            try {
                const payload = JSON.parse(body) as DebugCapturePayload;

                if (payload.type !== 'debug_capture') {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ status: 'error', error: 'Invalid payload type' }));
                    return;
                }

                // 스크린샷 저장 (다중 모니터 지원)
                const screenshotPaths: string[] = [];
                if (payload.screenshots && payload.screenshots.length > 0) {
                    for (const sc of payload.screenshots) {
                        const p = saveScreenshot(sc.base64);
                        screenshotPaths.push(p);
                        console.log(`[MCP Server] 스크린샷 저장 (${sc.displayName}): ${p}`);
                    }
                } else if (payload.screenshot) {
                    const p = saveScreenshot(payload.screenshot);
                    screenshotPaths.push(p);
                    console.log(`[MCP Server] 스크린샷 저장: ${p}`);
                }
                if (screenshotPaths.length > 0) {
                    cleanupScreenshots();
                }

                // 분석 힌트 생성
                const analysisHint = generateAnalysisHint(payload);
                console.log(analysisHint);

                // 응답
                const response = {
                    status: 'received',
                    screenshotPath: screenshotPaths[0] ?? '',
                    screenshotPaths,
                    screenshotCount: screenshotPaths.length,
                    analysisHint,
                    receivedAt: new Date().toISOString(),
                };

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(response));
            } catch (err) {
                console.error('[MCP Server] 파싱 오류:', err);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'error', error: 'Invalid JSON payload' }));
            }
        });
        return;
    }

    if (req.method === 'GET' && req.url === '/health') {
        const stats = cleanupScreenshots();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'ok',
            port: PORT,
            screenshots: stats.remaining,
            cleanupPolicy: {
                maxAgeMinutes: SCREENSHOT_MAX_AGE_MS / 60000,
                maxCount: SCREENSHOT_MAX_COUNT,
                cleanupIntervalMinutes: CLEANUP_INTERVAL_MS / 60000,
            },
        }));
        return;
    }

    res.writeHead(404);
    res.end();
});

server.listen(PORT, '127.0.0.1', () => {
    console.log(`[MCP Server] Debug Screenshot MCP 서버 시작`);
    console.log(`[MCP Server] 수신 주소: http://127.0.0.1:${PORT}`);
    console.log(`[MCP Server] 엔드포인트: POST /debug-capture`);
    console.log(`[MCP Server] 스크린샷 정리 정책: ${SCREENSHOT_MAX_AGE_MS / 60000}분 초과 또는 ${SCREENSHOT_MAX_COUNT}개 초과 시 자동 삭제`);
    // 서버 시작 시 기존 잔여 파일 정리
    cleanupScreenshots();
});

server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`[MCP Server] 포트 ${PORT}이 이미 사용 중입니다. 다른 포트를 지정하세요. (MCP_PORT 환경변수)`);
    } else {
        console.error('[MCP Server] 서버 오류:', err);
    }
    process.exit(1);
});
