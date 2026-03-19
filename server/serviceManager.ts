/**
 * Windows Service wrapper for Debug Screenshot MCP Server
 * node-windows를 사용하여 Windows 서비스로 등록/해제/관리
 */
import * as path from 'path';

// node-windows는 CommonJS 모듈로만 제공
// eslint-disable-next-line @typescript-eslint/no-var-requires
const nodeWindows = require('node-windows');
const Service = nodeWindows.Service;

const SERVICE_NAME = 'DebugScreenshotMCP';
const DESCRIPTION = 'Debug Screenshot MCP Server - AI 디버그 지원 스크린샷 및 컨텍스트 수집 서버';
const SERVER_SCRIPT = path.join(__dirname, 'mcpServer.js');

function createService(): InstanceType<typeof Service> {
    const svc = new Service({
        name: SERVICE_NAME,
        description: DESCRIPTION,
        script: SERVER_SCRIPT,
        env: [
            {
                name: 'MCP_PORT',
                value: process.env.MCP_PORT || '5010',
            },
        ],
        // 서비스 복구 정책: 실패 시 자동 재시작
        wait: 2,       // 재시작 전 대기(초)
        grow: 0.5,     // 재시작 대기시간 증가율
        maxRestarts: 10,
    });
    return svc;
}

function install(): void {
    const svc = createService();

    svc.on('install', () => {
        console.log(`[Service] '${SERVICE_NAME}' 서비스가 설치되었습니다.`);
        console.log('[Service] 서비스를 시작합니다...');
        svc.start();
    });

    svc.on('alreadyinstalled', () => {
        console.log(`[Service] '${SERVICE_NAME}' 서비스가 이미 설치되어 있습니다.`);
    });

    svc.on('start', () => {
        console.log(`[Service] '${SERVICE_NAME}' 서비스가 시작되었습니다.`);
        console.log(`[Service] http://127.0.0.1:${process.env.MCP_PORT || '5010'}/health 로 확인 가능`);
    });

    svc.on('error', (err: Error) => {
        console.error('[Service] 오류:', err.message);
    });

    console.log(`[Service] '${SERVICE_NAME}' 서비스를 설치합니다...`);
    console.log(`[Service] 스크립트: ${SERVER_SCRIPT}`);
    svc.install();
}

function uninstall(): void {
    const svc = createService();

    svc.on('uninstall', () => {
        console.log(`[Service] '${SERVICE_NAME}' 서비스가 제거되었습니다.`);
    });

    svc.on('alreadyuninstalled', () => {
        console.log(`[Service] '${SERVICE_NAME}' 서비스가 이미 제거되어 있습니다.`);
    });

    console.log(`[Service] '${SERVICE_NAME}' 서비스를 제거합니다...`);
    svc.uninstall();
}

function start(): void {
    const svc = createService();

    svc.on('start', () => {
        console.log(`[Service] '${SERVICE_NAME}' 서비스가 시작되었습니다.`);
    });

    svc.start();
}

function stop(): void {
    const svc = createService();

    svc.on('stop', () => {
        console.log(`[Service] '${SERVICE_NAME}' 서비스가 중지되었습니다.`);
    });

    svc.stop();
}

function status(): void {
    // sc query로 서비스 상태 확인
    // node-windows는 서비스명을 소문자 + .exe 형태로 등록한다
    const actualServiceName = SERVICE_NAME.toLowerCase() + '.exe';
    const { execSync } = require('child_process');
    try {
        const output = execSync(`sc query "${actualServiceName}"`, { encoding: 'utf8' });
        console.log(output);
    } catch {
        console.log(`[Service] '${SERVICE_NAME}' 서비스를 찾을 수 없습니다. (미설치)`);
    }
}

// CLI 인터페이스
const command = process.argv[2];

switch (command) {
    case 'install':
        install();
        break;
    case 'uninstall':
    case 'remove':
        uninstall();
        break;
    case 'start':
        start();
        break;
    case 'stop':
        stop();
        break;
    case 'restart':
        stop();
        setTimeout(() => start(), 3000);
        break;
    case 'status':
        status();
        break;
    default:
        console.log(`
Debug Screenshot MCP Server - Windows 서비스 관리

사용법: node serviceManager.js <command>

Commands:
  install     서비스 설치 및 시작 (관리자 권한 필요)
  uninstall   서비스 제거 (관리자 권한 필요)
  start       서비스 시작
  stop        서비스 중지
  restart     서비스 재시작
  status      서비스 상태 확인

환경변수:
  MCP_PORT    서버 포트 (기본: 5010)

예시:
  node serviceManager.js install
  node serviceManager.js status
  node serviceManager.js stop
  node serviceManager.js uninstall
`);
        break;
}
