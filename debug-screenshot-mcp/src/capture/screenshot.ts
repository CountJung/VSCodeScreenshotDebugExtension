// eslint-disable-next-line @typescript-eslint/no-var-requires
const screenshot = require('screenshot-desktop') as {
    (options?: { filename?: string; screen?: number; format?: string }): Promise<Buffer>;
    listDisplays(): Promise<Array<{ id: number; name?: string }>>;
};
import { getTempScreenshotPath, imageToBase64, deleteTempFile, getBase64SizeMB } from '../utils/encoding';

const MAX_IMAGE_SIZE_MB = 10;

/**
 * 현재 화면을 캡처하여 Base64 문자열을 반환
 * 임시 파일을 생성 후 Base64 변환, 파일 삭제
 */
export async function captureScreen(): Promise<string> {
    const tempPath = getTempScreenshotPath();

    try {
        // 주 디스플레이 캡처
        await screenshot({ filename: tempPath });

        const base64 = imageToBase64(tempPath);

        // 이미지 크기 제한 검사 (보안: 대용량 데이터 전송 방지)
        const sizeMB = getBase64SizeMB(base64);
        if (sizeMB > MAX_IMAGE_SIZE_MB) {
            throw new Error(
                `스크린샷 크기(${sizeMB.toFixed(1)}MB)가 최대 허용 크기(${MAX_IMAGE_SIZE_MB}MB)를 초과합니다.`
            );
        }

        return base64;
    } finally {
        deleteTempFile(tempPath);
    }
}

/**
 * 사용 가능한 디스플레이 목록 조회
 */
export async function listDisplays(): Promise<Array<{ id: number; name: string }>> {
    try {
        const displays = await screenshot.listDisplays();
        return displays.map(d => ({ id: d.id, name: d.name ?? 'Display' }));
    } catch {
        return [{ id: 0, name: 'Primary Display' }];
    }
}
