import * as vscode from 'vscode';
import { captureAndSend, initOutputChannel } from './commands/captureDebug';
import { registerDebugOutputListener } from './context/vscodeContext';

export function activate(context: vscode.ExtensionContext): void {
    // Output Channel 초기화
    const channel = initOutputChannel();
    channel.appendLine('Debug Screenshot MCP Extension 활성화됨');

    // 디버그 콘솔 출력 리스너 등록
    registerDebugOutputListener(context);

    // 커맨드 등록
    const disposable = vscode.commands.registerCommand(
        'debugScreenshot.capture',
        captureAndSend
    );

    context.subscriptions.push(disposable);

    channel.appendLine('커맨드 등록 완료: debugScreenshot.capture (Ctrl+Shift+Alt+D)');
}

export function deactivate(): void {
    // 리소스 해제는 subscriptions에서 자동 처리
}
