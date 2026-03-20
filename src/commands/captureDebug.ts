import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { captureAllScreens, DisplayScreenshot } from '../capture/screenshot';
import { collectDebugContext } from '../context/vscodeContext';
import { sendDebugCapture, McpPayload } from '../mcp/mcpClient';
import { maskSensitiveData } from '../utils/security';

const CAPTURE_DIR = path.join(os.homedir(), '.debug-screenshot-mcp', 'captures');

let outputChannel: vscode.OutputChannel;

export function initOutputChannel(): vscode.OutputChannel {
    if (!outputChannel) {
        outputChannel = vscode.window.createOutputChannel('Debug Screenshot MCP');
    }
    return outputChannel;
}

/**
 * 메인 커맨드 핸들러: 스크린샷 + 컨텍스트 수집 → MCP 서버 전송
 *
 * 실행 순서:
 * 1. 디버그 컨텍스트 수집 (VS Code 포커스 상태에서 DAP 접근 필요)
 * 2. 딜레이 대기 (captureDelay > 0이면 사용자가 대상 앱으로 전환할 시간 제공)
 * 3. 스크린샷 캡처 (딜레이 후 대상 앱이 전면에 노출된 상태)
 * 4. MCP 서버 전송
 */
export async function captureAndSend(): Promise<void> {
    const channel = initOutputChannel();
    const config = vscode.workspace.getConfiguration('debugScreenshotMcp');
    const captureDelay = config.get<number>('captureDelay', 3000);

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: 'Debug Screenshot MCP',
            cancellable: false,
        },
        async progress => {
            try {
                // Step 1: 디버그 컨텍스트 수집 (VS Code 포커스 상태에서 먼저 수집)
                progress.report({ message: '디버그 컨텍스트 수집 중...', increment: 10 });
                channel.appendLine(`[${new Date().toISOString()}] 컨텍스트 수집 시작`);
                const context = await collectDebugContext();

                // Step 2: 딜레이 (단일 모니터 환경에서 대상 앱 전환 시간 확보)
                if (captureDelay > 0) {
                    const delaySec = (captureDelay / 1000).toFixed(1);
                    channel.appendLine(`캡처 딜레이: ${delaySec}초 후 스크린샷 촬영 — 대상 앱으로 전환하세요`);
                    progress.report({ message: `${delaySec}초 후 캡처... 대상 앱으로 전환하세요`, increment: 20 });
                    await delay(captureDelay);
                }

                // Step 3: 전체 모니터 스크린샷 캡처
                progress.report({ message: '전체 모니터 스크린샷 캡처 중...', increment: 30 });
                channel.appendLine(`전체 모니터 스크린샷 캡처 시작`);
                const screenshots = await captureAllScreens();
                const totalKB = screenshots.reduce((s, sc) => s + sc.base64.length, 0) / 1024;
                channel.appendLine(`스크린샷 캡처 완료 (${screenshots.length}개 모니터, ${totalKB.toFixed(1)} KB)`);
                // 주 모니터 스크린샷 (HTTP 전송용 하위호환)
                const screenshotBase64 = screenshots[0]?.base64 ?? '';

                // 민감 정보 마스킹 (보안)
                const maskedContext = maskSensitiveData(context);
                logContext(channel, maskedContext);

                // Step 4: 캡처 결과를 디스크에 저장 (MCP 도구 연동용)
                progress.report({ message: '캡처 저장 중...', increment: 50 });
                saveCaptureToDisc(screenshots, maskedContext);
                channel.appendLine(`캡처 디스크 저장 완료: ${CAPTURE_DIR}`);

                // Step 5: MCP HTTP 서버로 전송 (기존 호환)
                progress.report({ message: 'MCP 서버로 전송 중...', increment: 60 });
                const payload: McpPayload = {
                    type: 'debug_capture',
                    screenshot: screenshotBase64,
                    screenshots: screenshots.map(s => ({ displayId: s.displayId, displayName: s.displayName, base64: s.base64 })),
                    file: maskedContext.filePath,
                    line: maskedContext.lineNumber,
                    code: maskedContext.selectedCode,
                    terminal: maskedContext.terminalOutput,
                    debugConsole: maskedContext.debugConsoleOutput,
                    context: maskedContext,
                    timestamp: maskedContext.timestamp,
                };

                // Step 6: 전송
                const response = await sendDebugCapture(payload);
                progress.report({ message: '완료!', increment: 100 });

                channel.appendLine(`전송 완료: ${JSON.stringify(response)}`);
                channel.show(true);

                const hint = response.analysisHint
                    ? `\n분석 힌트: ${response.analysisHint}`
                    : '';
                vscode.window.showInformationMessage(
                    `Debug Screenshot MCP: 전송 완료${hint}`
                );
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                channel.appendLine(`[ERROR] ${message}`);
                channel.show(true);
                vscode.window.showErrorMessage(`Debug Screenshot MCP 오류: ${message}`);
            }
        }
    );
}

function logContext(channel: vscode.OutputChannel, ctx: ReturnType<typeof maskSensitiveData>): void {
    channel.appendLine('--- 수집된 컨텍스트 ---');
    channel.appendLine(`파일: ${ctx.filePath}`);
    channel.appendLine(`라인: ${ctx.lineNumber}`);
    channel.appendLine(`언어: ${ctx.languageId}`);
    channel.appendLine(`워크스페이스: ${ctx.workspacePath}`);
    channel.appendLine(`디버그 세션: ${ctx.debugSessionName} (${ctx.debugSessionType})`);
    if (ctx.gitBranch) {
        channel.appendLine(`Git: ${ctx.gitBranch} @ ${ctx.gitCommitHash ?? 'unknown'}`);
    }
    if (ctx.callStack.length > 0) {
        channel.appendLine(`콜스택 (${ctx.callStack.length}개 프레임):`);
        ctx.callStack.forEach((f, i) => {
            channel.appendLine(`  [${i}] ${f.name} (${f.source ?? '?'}:${f.line ?? '?'})`);
        });
    }
    if (ctx.localVariables.length > 0) {
        channel.appendLine(`로컬 변수 (${ctx.localVariables.length}개):`);
        ctx.localVariables.slice(0, 10).forEach(v => {
            channel.appendLine(`  ${v.name} = ${v.value} (${v.type ?? '?'})`);
        });
    }
    channel.appendLine('--- 컨텍스트 끝 ---');
}

/**
 * 캡처 결과를 디스크에 저장하여 MCP stdio 서버에서 접근 가능하게 함
 */
function saveCaptureToDisc(screenshots: DisplayScreenshot[], context: ReturnType<typeof maskSensitiveData>): void {
    const timestamp = Date.now();
    const captureDir = path.join(CAPTURE_DIR, `capture-${timestamp}`);

    if (!fs.existsSync(captureDir)) {
        fs.mkdirSync(captureDir, { recursive: true });
    }

    // 스크린샷 저장
    for (let i = 0; i < screenshots.length; i++) {
        const sc = screenshots[i];
        const filePath = path.join(captureDir, `screen-${i}-${sc.displayId.replace(/[\\/.]/g, '_')}.png`);
        const buffer = Buffer.from(sc.base64, 'base64');
        fs.writeFileSync(filePath, buffer);
    }

    // 컨텍스트 JSON 저장
    const contextData = {
        ...context,
        captureTimestamp: new Date(timestamp).toISOString(),
        displayCount: screenshots.length,
        displays: screenshots.map(s => ({ displayId: s.displayId, displayName: s.displayName, sizeMB: s.sizeMB })),
    };
    fs.writeFileSync(path.join(captureDir, 'context.json'), JSON.stringify(contextData, null, 2));
}

/**
 * 지정된 밀리초만큼 대기
 */
function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
