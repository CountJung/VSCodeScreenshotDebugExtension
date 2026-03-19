<#
.SYNOPSIS
    Debug Screenshot MCP Server - Windows Service Manager
.DESCRIPTION
    Install, uninstall, start, stop, restart, and check status of the MCP Server Windows service.
    Requires Administrator privileges for install/uninstall operations.
.PARAMETER Action
    The action to perform: install, uninstall, start, stop, restart, status, health
.PARAMETER Port
    MCP Server port (default: 5010)
.EXAMPLE
    .\manage-service.ps1 install
    .\manage-service.ps1 status
    .\manage-service.ps1 health
    .\manage-service.ps1 -Action install -Port 5020
#>

param(
    [Parameter(Position = 0)]
    [ValidateSet('install', 'uninstall', 'start', 'stop', 'restart', 'status', 'health', 'help')]
    [string]$Action = 'help',

    [int]$Port = 5010
)

$ErrorActionPreference = 'Stop'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ServerDir = Join-Path $ScriptDir "server"
$ServiceManagerJs = Join-Path $ServerDir "dist" "serviceManager.js"
$McpServerJs = Join-Path $ServerDir "dist" "mcpServer.js"
$ServiceName = "debugscreenshotmcp.exe"

function Write-Header {
    Write-Host ""
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host "  Debug Screenshot MCP - Service Manager" -ForegroundColor Cyan
    Write-Host "============================================" -ForegroundColor Cyan
    Write-Host ""
}

function Test-Admin {
    $currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    return $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Ensure-Built {
    if (-not (Test-Path $McpServerJs)) {
        Write-Host "[Build] 서버가 빌드되지 않았습니다. 빌드를 실행합니다..." -ForegroundColor Yellow
        Push-Location $ServerDir
        npm run build
        Pop-Location
        if (-not (Test-Path $McpServerJs)) {
            Write-Host "[Error] 빌드 실패. 'cd server && npm run build'를 수동으로 실행하세요." -ForegroundColor Red
            exit 1
        }
        Write-Host "[Build] 빌드 완료." -ForegroundColor Green
    }
}

function Do-Install {
    if (-not (Test-Admin)) {
        Write-Host "[Error] 서비스 설치에는 관리자 권한이 필요합니다." -ForegroundColor Red
        Write-Host "        PowerShell을 관리자 권한으로 다시 실행하세요." -ForegroundColor Yellow
        exit 1
    }
    Ensure-Built
    Write-Host "[Install] 서비스를 설치합니다 (포트: $Port)..." -ForegroundColor Green
    $env:MCP_PORT = $Port
    node $ServiceManagerJs install
}

function Do-Uninstall {
    if (-not (Test-Admin)) {
        Write-Host "[Error] 서비스 제거에는 관리자 권한이 필요합니다." -ForegroundColor Red
        exit 1
    }
    Write-Host "[Uninstall] 서비스를 제거합니다..." -ForegroundColor Yellow
    node $ServiceManagerJs uninstall
}

function Do-Start {
    Write-Host "[Start] 서비스를 시작합니다..." -ForegroundColor Green
    node $ServiceManagerJs start
}

function Do-Stop {
    Write-Host "[Stop] 서비스를 중지합니다..." -ForegroundColor Yellow
    node $ServiceManagerJs stop
}

function Do-Restart {
    Write-Host "[Restart] 서비스를 재시작합니다..." -ForegroundColor Yellow
    node $ServiceManagerJs restart
}

function Do-Status {
    Write-Host "[Status] 서비스 상태 확인:" -ForegroundColor Cyan
    try {
        $svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
        if ($svc) {
            Write-Host "  서비스 이름: $($svc.Name)" -ForegroundColor White
            Write-Host "  상태: $($svc.Status)" -ForegroundColor $(if ($svc.Status -eq 'Running') { 'Green' } else { 'Red' })
            Write-Host "  시작 유형: $($svc.StartType)" -ForegroundColor White
        }
        else {
            Write-Host "  서비스가 설치되어 있지 않습니다." -ForegroundColor Yellow
        }
    }
    catch {
        # sc query 로 fallback
        node $ServiceManagerJs status
    }
}

function Do-Health {
    $url = "http://127.0.0.1:$Port/health"
    Write-Host "[Health] $url 에 요청 중..." -ForegroundColor Cyan
    try {
        $response = Invoke-WebRequest -Uri $url -Method GET -TimeoutSec 5
        $json = $response.Content | ConvertFrom-Json
        Write-Host "  상태: $($json.status)" -ForegroundColor Green
        Write-Host "  포트: $($json.port)" -ForegroundColor White
    }
    catch {
        Write-Host "  서버에 연결할 수 없습니다. 서비스가 실행 중인지 확인하세요." -ForegroundColor Red
    }
}

function Show-Help {
    Write-Host @"
사용법: .\manage-service.ps1 <Action> [-Port <포트>]

Actions:
  install     서비스 설치 및 자동 시작 (관리자 권한 필요)
  uninstall   서비스 제거 (관리자 권한 필요)
  start       서비스 시작
  stop        서비스 중지
  restart     서비스 재시작
  status      서비스 상태 확인
  health      HTTP Health Check

옵션:
  -Port       서버 포트 (기본: 5010)

예시:
  .\manage-service.ps1 install
  .\manage-service.ps1 install -Port 5020
  .\manage-service.ps1 status
  .\manage-service.ps1 health
"@
}

# Main
Write-Header

switch ($Action) {
    'install' { Do-Install }
    'uninstall' { Do-Uninstall }
    'start' { Do-Start }
    'stop' { Do-Stop }
    'restart' { Do-Restart }
    'status' { Do-Status }
    'health' { Do-Health }
    'help' { Show-Help }
}

Write-Host ""
