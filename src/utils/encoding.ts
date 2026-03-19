import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * 파일을 읽어 Base64 문자열로 변환
 */
export function imageToBase64(filePath: string): string {
    const buffer = fs.readFileSync(filePath);
    return buffer.toString('base64');
}

/**
 * OS 임시 디렉터리에 스크린샷 임시 파일 경로 생성
 */
export function getTempScreenshotPath(): string {
    const timestamp = Date.now();
    return path.join(os.tmpdir(), `debug-screenshot-${timestamp}.png`);
}

/**
 * 임시 파일 삭제 (파일이 존재할 경우에만)
 */
export function deleteTempFile(filePath: string): void {
    try {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch {
        // 임시 파일 삭제 실패는 무시
    }
}

/**
 * Base64 이미지를 파일로 저장
 */
export function base64ToFile(base64: string, filePath: string): void {
    const buffer = Buffer.from(base64, 'base64');
    fs.writeFileSync(filePath, buffer);
}

/**
 * Base64 문자열 크기를 MB 단위로 반환
 */
export function getBase64SizeMB(base64: string): number {
    return (base64.length * 3) / 4 / 1024 / 1024;
}
