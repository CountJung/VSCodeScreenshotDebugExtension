import * as vscode from 'vscode';

export interface StackFrame {
    frameId: number;
    name: string;
    source?: string;
    line?: number;
    column?: number;
}

export interface Variable {
    name: string;
    value: string;
    type?: string;
}

export interface DebugContext {
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

// 디버그 콘솔 출력 버퍼 (Extension 생명주기 동안 유지)
const debugConsoleBuffer: string[] = [];

/**
 * 디버그 콘솔 출력 이벤트 리스너 등록
 * extension.ts activate()에서 호출
 */
export function registerDebugOutputListener(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
        vscode.debug.onDidReceiveDebugSessionCustomEvent(event => {
            if (event.event === 'output' || event.event === 'console') {
                const output = event.body?.output as string | undefined;
                if (output) {
                    debugConsoleBuffer.push(output);
                    const config = vscode.workspace.getConfiguration('debugScreenshotMcp');
                    const maxLines = config.get<number>('maxConsoleLines', 100);
                    if (debugConsoleBuffer.length > maxLines) {
                        debugConsoleBuffer.splice(0, debugConsoleBuffer.length - maxLines);
                    }
                }
            }
        })
    );
}

/**
 * VSCode 편집기 및 디버그 컨텍스트 수집
 */
export async function collectDebugContext(): Promise<DebugContext> {
    const editor = vscode.window.activeTextEditor;
    const timestamp = new Date().toISOString();

    // 기본 편집기 정보
    const filePath = editor?.document.fileName ?? '';
    const lineNumber = editor ? editor.selection.active.line + 1 : 0;
    const selectedCode = editor?.document.getText(editor.selection) ?? '';
    const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
    const languageId = editor?.document.languageId ?? '';

    // 디버그 세션 정보
    const debugSession = vscode.debug.activeDebugSession;
    const debugSessionName = debugSession?.name ?? '';
    const debugSessionType = debugSession?.type ?? '';

    // 콜스택 + 로컬 변수 수집
    const { callStack, localVariables } = await collectCallStackAndVariables(debugSession);

    // 터미널 출력 수집
    const terminalOutput = await collectTerminalOutput();

    // Git 정보 수집
    const { gitBranch, gitCommitHash } = await collectGitInfo();

    // 디버그 콘솔 버퍼
    const debugConsoleOutput = debugConsoleBuffer.join('');

    return {
        filePath,
        lineNumber,
        selectedCode,
        workspacePath,
        languageId,
        debugSessionName,
        debugSessionType,
        callStack,
        localVariables,
        debugConsoleOutput,
        terminalOutput,
        gitBranch,
        gitCommitHash,
        timestamp,
    };
}

/**
 * DAP(Debug Adapter Protocol)를 통해 콜스택과 로컬 변수 수집
 */
async function collectCallStackAndVariables(
    session: vscode.DebugSession | undefined
): Promise<{ callStack: StackFrame[]; localVariables: Variable[] }> {
    if (!session) {
        return { callStack: [], localVariables: [] };
    }

    try {
        // 현재 스레드 목록 조회
        const threadsResponse = await session.customRequest('threads');
        const threads: Array<{ id: number }> = threadsResponse?.threads ?? [];
        if (threads.length === 0) {
            return { callStack: [], localVariables: [] };
        }

        const threadId = threads[0].id;

        // 스택 트레이스 조회
        const stackResponse = await session.customRequest('stackTrace', {
            threadId,
            startFrame: 0,
            levels: 20,
        });

        const frames: Array<{
            id: number;
            name: string;
            source?: { path?: string; name?: string };
            line?: number;
            column?: number;
        }> = stackResponse?.stackFrames ?? [];

        const callStack: StackFrame[] = frames.map(f => ({
            frameId: f.id,
            name: f.name,
            source: f.source?.path ?? f.source?.name,
            line: f.line,
            column: f.column,
        }));

        // 최상위 프레임의 로컬 변수 수집
        const localVariables: Variable[] = [];
        if (frames.length > 0) {
            try {
                const scopeResponse = await session.customRequest('scopes', {
                    frameId: frames[0].id,
                });
                const scopes: Array<{ name: string; variablesReference: number }> =
                    scopeResponse?.scopes ?? [];

                const localScope = scopes.find(s =>
                    s.name.toLowerCase() === 'locals' || s.name.toLowerCase() === 'local'
                ) ?? scopes[0];

                if (localScope && localScope.variablesReference > 0) {
                    const varResponse = await session.customRequest('variables', {
                        variablesReference: localScope.variablesReference,
                    });
                    const vars: Array<{ name: string; value: string; type?: string }> =
                        varResponse?.variables ?? [];

                    for (const v of vars.slice(0, 30)) {
                        // 최대 30개 변수
                        localVariables.push({
                            name: v.name,
                            value: v.value,
                            type: v.type,
                        });
                    }
                }
            } catch {
                // 변수 수집 실패는 무시
            }
        }

        return { callStack, localVariables };
    } catch {
        return { callStack: [], localVariables: [] };
    }
}

/**
 * 활성 터미널의 최근 출력 수집 (Shell Integration API)
 */
async function collectTerminalOutput(): Promise<string> {
    const terminal = vscode.window.activeTerminal;
    if (!terminal) {
        return '';
    }

    try {
        // VSCode Shell Integration API (1.85+)
        // shellIntegration은 현재 VSCode API 타입에서 experimental이므로 any 캐스팅
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const shellIntegration = (terminal as any).shellIntegration;
        if (shellIntegration) {
            const lastCommand = shellIntegration.cwd;
            return lastCommand ? `CWD: ${lastCommand.toString()}` : '';
        }
    } catch {
        // Shell Integration 미지원 환경
    }

    return `Terminal: ${terminal.name}`;
}

/**
 * VSCode Git Extension을 통해 브랜치 및 커밋 해시 수집
 */
async function collectGitInfo(): Promise<{ gitBranch?: string; gitCommitHash?: string }> {
    try {
        const gitExtension = vscode.extensions.getExtension<{
            getAPI(version: number): {
                repositories: Array<{
                    state: {
                        HEAD?: { name?: string; commit?: string };
                    };
                }>;
            };
        }>('vscode.git');

        if (!gitExtension) {
            return {};
        }

        const git = gitExtension.isActive
            ? gitExtension.exports.getAPI(1)
            : await gitExtension.activate().then(() => gitExtension.exports.getAPI(1));

        const repo = git.repositories[0];
        if (!repo) {
            return {};
        }

        return {
            gitBranch: repo.state.HEAD?.name,
            gitCommitHash: repo.state.HEAD?.commit?.substring(0, 8),
        };
    } catch {
        return {};
    }
}
