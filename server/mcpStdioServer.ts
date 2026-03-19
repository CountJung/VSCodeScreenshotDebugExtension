#!/usr/bin/env node
/**
 * Debug Screenshot MCP Server (stdio transport)
 *
 * VS Code Copilot Chat 등 AI 도구에서 MCP 프로토콜로 접근 가능한 서버.
 * 스크린샷 캡처, 디버그 컨텍스트 조회 등의 도구를 제공한다.
 *
 * 등록 방법: .vscode/mcp.json 또는 VS Code settings.json 에서 MCP 서버로 등록
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod/v4';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const screenshot = require('screenshot-desktop') as {
    (options?: { filename?: string; screen?: string | number; format?: string }): Promise<Buffer>;
    listDisplays(): Promise<Array<{ id: string | number; name?: string; width?: number; height?: number }>>;
};

// 캡처 데이터 저장 경로
const CAPTURE_DIR = path.join(os.homedir(), '.debug-screenshot-mcp', 'captures');
const SCREENSHOT_FILE_PATTERN = /^capture-\d+$/;
const MAX_CAPTURES = 20;

function ensureCaptureDir(): void {
    if (!fs.existsSync(CAPTURE_DIR)) {
        fs.mkdirSync(CAPTURE_DIR, { recursive: true });
    }
}

/**
 * 오래된 캡처 디렉터리 정리 (최대 보관 수 초과 시)
 */
function cleanupCaptures(): void {
    ensureCaptureDir();
    const dirs = fs.readdirSync(CAPTURE_DIR)
        .filter(d => SCREENSHOT_FILE_PATTERN.test(d))
        .map(d => ({ name: d, path: path.join(CAPTURE_DIR, d), time: parseInt(d.replace('capture-', ''), 10) }))
        .sort((a, b) => b.time - a.time);

    if (dirs.length > MAX_CAPTURES) {
        for (const dir of dirs.slice(MAX_CAPTURES)) {
            try {
                fs.rmSync(dir.path, { recursive: true, force: true });
            } catch { /* ignore */ }
        }
    }
}

// --- MCP Server 생성 ---
const server = new McpServer(
    { name: 'debug-screenshot-mcp', version: '0.1.0' },
    {
        capabilities: { tools: {} },
        instructions: '디버깅 지원을 위한 스크린샷 캡처 및 디버그 컨텍스트를 제공하는 MCP 서버입니다. ' +
            'capture_all_screens: 전체 모니터 스크린샷 캡처, ' +
            'get_debug_context: 최근 저장된 디버그 컨텍스트 조회, ' +
            'list_displays: 연결된 디스플레이 목록 조회',
    }
);

// --- Tool: capture_all_screens ---
server.tool(
    'capture_all_screens',
    'Capture screenshots from all connected monitors. Returns images as base64 PNG for each display.',
    {
        includeContext: z.boolean().optional().describe('If true, also include the latest debug context from VS Code extension'),
    },
    async ({ includeContext }) => {
        try {
            const displays = await screenshot.listDisplays();
            const content: Array<{ type: 'image'; data: string; mimeType: string } | { type: 'text'; text: string }> = [];

            content.push({
                type: 'text' as const,
                text: `=== 전체 모니터 스크린샷 (${displays.length}개 디스플레이) ===\n캡처 시각: ${new Date().toISOString()}`,
            });

            for (const display of displays) {
                try {
                    const buffer = await screenshot({ screen: display.id }) as Buffer;
                    const base64 = buffer.toString('base64');

                    content.push({
                        type: 'text' as const,
                        text: `\n--- Display: ${display.name ?? display.id} (${display.width ?? '?'}x${display.height ?? '?'}) ---`,
                    });

                    content.push({
                        type: 'image' as const,
                        data: base64,
                        mimeType: 'image/png',
                    });
                } catch (err) {
                    content.push({
                        type: 'text' as const,
                        text: `[오류] Display ${display.name ?? display.id} 캡처 실패: ${err instanceof Error ? err.message : String(err)}`,
                    });
                }
            }

            // 디버그 컨텍스트 포함 옵션
            if (includeContext) {
                const ctx = loadLatestContext();
                if (ctx) {
                    content.push({
                        type: 'text' as const,
                        text: `\n=== VS Code Debug Context ===\n${ctx}`,
                    });
                } else {
                    content.push({
                        type: 'text' as const,
                        text: '\n[정보] 저장된 디버그 컨텍스트가 없습니다. VS Code에서 Ctrl+Shift+Alt+D를 눌러 컨텍스트를 저장하세요.',
                    });
                }
            }

            return { content };
        } catch (err) {
            return {
                content: [{ type: 'text' as const, text: `스크린샷 캡처 실패: ${err instanceof Error ? err.message : String(err)}` }],
                isError: true,
            };
        }
    }
);

// --- Tool: get_debug_context ---
server.tool(
    'get_debug_context',
    'Get the latest debug context captured by the VS Code extension (file, line, call stack, local variables, debug console output, etc.).',
    {
        captureId: z.string().optional().describe('Specific capture ID. If omitted, returns the latest capture.'),
    },
    async ({ captureId }) => {
        try {
            if (captureId) {
                const capturePath = path.join(CAPTURE_DIR, captureId, 'context.json');
                // 경로 조작 방지
                const resolved = path.resolve(capturePath);
                if (!resolved.startsWith(CAPTURE_DIR)) {
                    return { content: [{ type: 'text' as const, text: '잘못된 캡처 ID입니다.' }], isError: true };
                }
                if (!fs.existsSync(capturePath)) {
                    return { content: [{ type: 'text' as const, text: `캡처 ID '${captureId}'를 찾을 수 없습니다.` }], isError: true };
                }
                const raw = fs.readFileSync(capturePath, 'utf-8');
                return { content: [{ type: 'text' as const, text: raw }] };
            }

            const ctx = loadLatestContext();
            if (!ctx) {
                return {
                    content: [{
                        type: 'text' as const,
                        text: '저장된 디버그 컨텍스트가 없습니다.\nVS Code에서 Ctrl+Shift+Alt+D를 눌러 캡처해주세요.',
                    }],
                };
            }
            return { content: [{ type: 'text' as const, text: ctx }] };
        } catch (err) {
            return {
                content: [{ type: 'text' as const, text: `컨텍스트 조회 실패: ${err instanceof Error ? err.message : String(err)}` }],
                isError: true,
            };
        }
    }
);

// --- Tool: list_displays ---
server.tool(
    'list_displays',
    'List all connected display monitors with their IDs, names, and resolutions.',
    {},
    async () => {
        try {
            const displays = await screenshot.listDisplays();
            const text = displays.map((d, i) =>
                `[${i}] ${d.name ?? d.id} - ${d.width ?? '?'}x${d.height ?? '?'}`
            ).join('\n');
            return {
                content: [{
                    type: 'text' as const,
                    text: `연결된 디스플레이 (${displays.length}개):\n${text}`,
                }],
            };
        } catch (err) {
            return {
                content: [{ type: 'text' as const, text: `디스플레이 조회 실패: ${err instanceof Error ? err.message : String(err)}` }],
                isError: true,
            };
        }
    }
);

// --- Tool: list_captures ---
server.tool(
    'list_captures',
    'List recent debug captures saved by the VS Code extension.',
    {},
    async () => {
        try {
            ensureCaptureDir();
            const dirs = fs.readdirSync(CAPTURE_DIR)
                .filter(d => SCREENSHOT_FILE_PATTERN.test(d))
                .sort()
                .reverse()
                .slice(0, 20);

            if (dirs.length === 0) {
                return { content: [{ type: 'text' as const, text: '저장된 캡처가 없습니다.' }] };
            }

            const lines = dirs.map(d => {
                const ts = parseInt(d.replace('capture-', ''), 10);
                const date = new Date(ts).toISOString();
                const ctxFile = path.join(CAPTURE_DIR, d, 'context.json');
                const hasContext = fs.existsSync(ctxFile);
                const screenshots = fs.readdirSync(path.join(CAPTURE_DIR, d)).filter(f => f.endsWith('.png')).length;
                return `${d} | ${date} | 스크린샷: ${screenshots}개 | 컨텍스트: ${hasContext ? '있음' : '없음'}`;
            });

            return {
                content: [{
                    type: 'text' as const,
                    text: `최근 캡처 목록 (${dirs.length}개):\n${lines.join('\n')}`,
                }],
            };
        } catch (err) {
            return {
                content: [{ type: 'text' as const, text: `캡처 목록 조회 실패: ${err instanceof Error ? err.message : String(err)}` }],
                isError: true,
            };
        }
    }
);

// --- Tool: get_capture_screenshot ---
server.tool(
    'get_capture_screenshot',
    'Get screenshot images from a specific capture. Returns the screenshots as inline images.',
    {
        captureId: z.string().optional().describe('Capture ID (e.g. capture-1234567890). If omitted, uses the latest.'),
    },
    async ({ captureId }) => {
        try {
            ensureCaptureDir();
            let targetDir: string;

            if (captureId) {
                targetDir = path.join(CAPTURE_DIR, captureId);
                const resolved = path.resolve(targetDir);
                if (!resolved.startsWith(CAPTURE_DIR)) {
                    return { content: [{ type: 'text' as const, text: '잘못된 캡처 ID입니다.' }], isError: true };
                }
            } else {
                const dirs = fs.readdirSync(CAPTURE_DIR)
                    .filter(d => SCREENSHOT_FILE_PATTERN.test(d))
                    .sort()
                    .reverse();
                if (dirs.length === 0) {
                    return { content: [{ type: 'text' as const, text: '저장된 캡처가 없습니다.' }] };
                }
                targetDir = path.join(CAPTURE_DIR, dirs[0]);
            }

            if (!fs.existsSync(targetDir)) {
                return { content: [{ type: 'text' as const, text: '해당 캡처를 찾을 수 없습니다.' }], isError: true };
            }

            const pngFiles = fs.readdirSync(targetDir).filter(f => f.endsWith('.png')).sort();
            const content: Array<{ type: 'image'; data: string; mimeType: string } | { type: 'text'; text: string }> = [];

            for (const png of pngFiles) {
                const data = fs.readFileSync(path.join(targetDir, png)).toString('base64');
                content.push({
                    type: 'text' as const,
                    text: `--- ${png} ---`,
                });
                content.push({
                    type: 'image' as const,
                    data,
                    mimeType: 'image/png',
                });
            }

            if (content.length === 0) {
                return { content: [{ type: 'text' as const, text: '해당 캡처에 스크린샷 파일이 없습니다.' }] };
            }

            return { content };
        } catch (err) {
            return {
                content: [{ type: 'text' as const, text: `스크린샷 조회 실패: ${err instanceof Error ? err.message : String(err)}` }],
                isError: true,
            };
        }
    }
);

/**
 * 최신 캡처의 context.json 로드
 */
function loadLatestContext(): string | null {
    try {
        ensureCaptureDir();
        const dirs = fs.readdirSync(CAPTURE_DIR)
            .filter(d => SCREENSHOT_FILE_PATTERN.test(d))
            .sort()
            .reverse();

        for (const d of dirs) {
            const ctxFile = path.join(CAPTURE_DIR, d, 'context.json');
            if (fs.existsSync(ctxFile)) {
                return fs.readFileSync(ctxFile, 'utf-8');
            }
        }
        return null;
    } catch {
        return null;
    }
}

// --- 서버 시작 ---
async function main(): Promise<void> {
    // 기존 캡처 정리
    cleanupCaptures();

    const transport = new StdioServerTransport();
    await server.connect(transport);
    // stderr로 출력 (stdout은 MCP 프로토콜 전용)
    console.error('[MCP Stdio Server] Debug Screenshot MCP 서버 시작됨');
    console.error(`[MCP Stdio Server] 캡처 디렉터리: ${CAPTURE_DIR}`);
}

main().catch(err => {
    console.error('[MCP Stdio Server] 서버 시작 실패:', err);
    process.exit(1);
});
