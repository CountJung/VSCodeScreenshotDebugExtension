import { DebugContext } from '../context/vscodeContext';

// 민감 데이터 마스킹 패턴
const SENSITIVE_PATTERNS: RegExp[] = [
    /password\s*[=:]\s*\S+/gi,
    /token\s*[=:]\s*\S+/gi,
    /secret\s*[=:]\s*\S+/gi,
    /api[_-]?key\s*[=:]\s*\S+/gi,
    /auth\s*[=:]\s*\S+/gi,
    /bearer\s+\S+/gi,
    /-----BEGIN [A-Z ]+-----[\s\S]+?-----END [A-Z ]+-----/g,
];

const SENSITIVE_FILENAMES: RegExp[] = [
    /\.env$/i,
    /\.pem$/i,
    /\.key$/i,
    /\.pfx$/i,
    /\.p12$/i,
    /secret/i,
    /credentials/i,
];

/**
 * 컨텍스트에서 민감 정보 마스킹
 */
export function maskSensitiveData(context: DebugContext): DebugContext {
    // 민감 파일명 감지 시 선택 코드 차단
    const isSensitiveFile = SENSITIVE_FILENAMES.some(p => p.test(context.filePath));

    return {
        ...context,
        selectedCode: isSensitiveFile ? '[보안: 민감 파일 내용 차단됨]' : maskText(context.selectedCode),
        debugConsoleOutput: maskText(context.debugConsoleOutput),
        terminalOutput: maskText(context.terminalOutput),
        localVariables: context.localVariables.map(v => ({
            ...v,
            value: maskText(v.value),
        })),
    };
}

/**
 * 텍스트에서 민감 패턴을 [MASKED]로 치환
 */
export function maskText(text: string): string {
    let result = text;
    for (const pattern of SENSITIVE_PATTERNS) {
        result = result.replace(pattern, match => {
            const eqIdx = match.search(/[=:]/);
            if (eqIdx !== -1) {
                return match.substring(0, eqIdx + 1) + ' [MASKED]';
            }
            return '[MASKED]';
        });
    }
    return result;
}
