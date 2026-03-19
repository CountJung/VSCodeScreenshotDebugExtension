@echo off
REM Debug Screenshot MCP Server - Windows Service Manager (Batch)
REM 관리자 권한으로 실행하세요 (install/uninstall)

setlocal enabledelayedexpansion

set "SCRIPT_DIR=%~dp0"
set "SERVER_DIR=%SCRIPT_DIR%server"
set "SERVICE_MANAGER=%SERVER_DIR%\dist\serviceManager.js"
set "ACTION=%1"

if "%ACTION%"=="" goto :help
if "%ACTION%"=="help" goto :help
if "%ACTION%"=="install" goto :install
if "%ACTION%"=="uninstall" goto :uninstall
if "%ACTION%"=="start" goto :start
if "%ACTION%"=="stop" goto :stop
if "%ACTION%"=="restart" goto :restart
if "%ACTION%"=="status" goto :status
goto :help

:install
echo [Install] Checking build...
if not exist "%SERVICE_MANAGER%" (
    echo [Build] Building server...
    pushd "%SERVER_DIR%"
    call npm run build
    popd
)
echo [Install] Installing service...
node "%SERVICE_MANAGER%" install
goto :end

:uninstall
echo [Uninstall] Removing service...
node "%SERVICE_MANAGER%" uninstall
goto :end

:start
echo [Start] Starting service...
node "%SERVICE_MANAGER%" start
goto :end

:stop
echo [Stop] Stopping service...
node "%SERVICE_MANAGER%" stop
goto :end

:restart
echo [Restart] Restarting service...
node "%SERVICE_MANAGER%" restart
goto :end

:status
echo [Status] Checking service status...
node "%SERVICE_MANAGER%" status
goto :end

:help
echo.
echo ============================================
echo   Debug Screenshot MCP - Service Manager
echo ============================================
echo.
echo Usage: manage-service.bat ^<command^>
echo.
echo Commands:
echo   install     Install and start service (requires admin)
echo   uninstall   Remove service (requires admin)
echo   start       Start service
echo   stop        Stop service
echo   restart     Restart service
echo   status      Check service status
echo   help        Show this help
echo.
echo Run as Administrator for install/uninstall.
echo.
goto :end

:end
endlocal
