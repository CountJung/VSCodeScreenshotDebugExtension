import * as http from 'http';
import * as https from 'https';
import * as vscode from 'vscode';
import { DebugContext } from '../context/vscodeContext';

export interface McpPayload {
    type: 'debug_capture';
    screenshot: string;       // Base64 PNG
    file: string;
    line: number;
    code: string;
    terminal: string;
    debugConsole: string;
    context: DebugContext;
    timestamp: string;
}

export interface McpResponse {
    status: string;
    analysisHint?: string;
    error?: string;
}

/**
 * MCP 서버에 디버그 캡처 페이로드 전송
 */
export async function sendDebugCapture(payload: McpPayload): Promise<McpResponse> {
    const config = vscode.workspace.getConfiguration('debugScreenshotMcp');
    const serverUrl = config.get<string>('serverUrl', 'http://localhost:5010');
    const timeoutMs = config.get<number>('captureTimeout', 30000);

    // URL 유효성 검증 (보안: SSRF 방지)
    const parsedUrl = validateServerUrl(serverUrl);
    const endpoint = new URL('/debug-capture', parsedUrl).toString();

    const bodyStr = JSON.stringify(payload);

    return sendHttpRequest(endpoint, bodyStr, timeoutMs);
}

/**
 * MCP 서버 URL 유효성 검증
 * localhost 및 사설 IP만 허용 (외부 서버로의 의도치 않은 전송 방지)
 */
function validateServerUrl(urlStr: string): URL {
    let parsed: URL;
    try {
        parsed = new URL(urlStr);
    } catch {
        throw new Error(`잘못된 MCP 서버 URL 형식: ${urlStr}`);
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error(`MCP 서버 URL은 http 또는 https 프로토콜만 허용됩니다.`);
    }

    // 허용 호스트: localhost, 127.x.x.x, 192.168.x.x, 10.x.x.x, 172.16-31.x.x
    const hostname = parsed.hostname;
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
    const isPrivateIPv4 =
        /^10\./.test(hostname) ||
        /^192\.168\./.test(hostname) ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(hostname);

    if (!isLocalhost && !isPrivateIPv4) {
        throw new Error(
            `MCP 서버 URL은 localhost 또는 사설 네트워크 주소만 허용됩니다. (현재: ${hostname})`
        );
    }

    return parsed;
}

/**
 * HTTP/HTTPS POST 요청 전송
 */
function sendHttpRequest(
    endpoint: string,
    body: string,
    timeoutMs: number
): Promise<McpResponse> {
    return new Promise((resolve, reject) => {
        const url = new URL(endpoint);
        const isHttps = url.protocol === 'https:';
        const transport = isHttps ? https : http;

        const options: http.RequestOptions = {
            hostname: url.hostname,
            port: url.port || (isHttps ? 443 : 80),
            path: url.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body),
                'User-Agent': 'debug-screenshot-mcp-vscode/0.1.0',
            },
            timeout: timeoutMs,
        };

        const req = transport.request(options, res => {
            let data = '';
            res.on('data', chunk => (data += chunk));
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data) as McpResponse;
                    resolve(parsed);
                } catch {
                    resolve({ status: 'received', analysisHint: data });
                }
            });
        });

        req.on('timeout', () => {
            req.destroy();
            reject(new Error(`MCP 서버 응답 타임아웃 (${timeoutMs}ms)`));
        });

        req.on('error', err => {
            if ((err as NodeJS.ErrnoException).code === 'ECONNREFUSED') {
                reject(
                    new Error(
                        `MCP 서버에 연결할 수 없습니다. 서버가 실행 중인지 확인하세요. (${endpoint})`
                    )
                );
            } else {
                reject(err);
            }
        });

        req.write(body);
        req.end();
    });
}
