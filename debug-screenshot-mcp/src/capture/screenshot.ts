// eslint-disable-next-line @typescript-eslint/no-var-requires
const screenshot = require('screenshot-desktop') as {
    (options?: { filename?: string; screen?: number | string; format?: string }): Promise<Buffer>;
    listDisplays(): Promise<Array<{ id: string | number; name?: string; width?: number; height?: number }>>;
    all(): Promise<Buffer[]>;
};
import { getTempScreenshotPath, imageToBase64, deleteTempFile, getBase64SizeMB } from '../utils/encoding';

const MAX_IMAGE_SIZE_MB = 10;
const MAX_TOTAL_SIZE_MB = 30; // 전체 모니터 합산 최대 크기

export interface DisplayScreenshot {
    displayId: string;
    displayName: string;
    base64: string;
    sizeMB: number;
}

/**
 * 전체 모니터를 캡처하여 각 모니터별 Base64 문자열 배열을 반환
 */
export async function captureAllScreens(): Promise<DisplayScreenshot[]> {
    const displays = await screenshot.listDisplays();
    const results: DisplayScreenshot[] = [];
    const tempPaths: string[] = [];

    try {
        for (const display of displays) {
            const tempPath = getTempScreenshotPath();
            tempPaths.push(tempPath);

            await screenshot({ filename: tempPath, screen: display.id });

            const base64 = imageToBase64(tempPath);
            const sizeMB = getBase64SizeMB(base64);

            if (sizeMB > MAX_IMAGE_SIZE_MB) {
                console.warn(`디스플레이 ${display.name ?? display.id} 스크린샷이 ${sizeMB.toFixed(1)}MB로 개별 제한 초과, 건너뜀`);
                continue;
            }

            results.push({
                displayId: String(display.id),
                displayName: display.name ?? `Display ${display.id}`,
                base64,
                sizeMB,
            });
        }

        // 전체 합산 크기 검사
        const totalSizeMB = results.reduce((sum, r) => sum + r.sizeMB, 0);
        if (totalSizeMB > MAX_TOTAL_SIZE_MB) {
            throw new Error(
                `전체 스크린샷 크기(${totalSizeMB.toFixed(1)}MB)가 최대 허용 크기(${MAX_TOTAL_SIZE_MB}MB)를 초과합니다.`
            );
        }

        return results;
    } finally {
        for (const p of tempPaths) {
            deleteTempFile(p);
        }
    }
}

/**
 * 현재 화면을 캡처하여 Base64 문자열을 반환 (주 모니터만, 하위호환)
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
export async function listDisplays(): Promise<Array<{ id: string; name: string }>> {
    try {
        const displays = await screenshot.listDisplays();
        return displays.map(d => ({ id: String(d.id), name: d.name ?? 'Display' }));
    } catch {
        return [{ id: '0', name: 'Primary Display' }];
    }
}
