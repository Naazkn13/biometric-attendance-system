@echo off
REM ========================================
REM   Andheri PC - ADMS Relay Auto-Start
REM   Run this ONCE as Administrator
REM ========================================

echo ========================================
echo   Andheri ADMS Relay - Auto-Start Setup
echo ========================================
echo.

net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: Must be run as Administrator!
    echo Right-click and select "Run as administrator"
    pause
    exit /b 1
)

set "SCRIPT_DIR=%~dp0"
set "TASK_NAME=AttendPay-AndheriRelay"

schtasks /delete /tn "%TASK_NAME%" /f >nul 2>&1

schtasks /create ^
    /tn "%TASK_NAME%" ^
    /tr "wscript.exe \"%SCRIPT_DIR%run_relay_silent.vbs\"" ^
    /sc ONLOGON ^
    /rl HIGHEST ^
    /delay 0000:30 ^
    /f

if %errorLevel% equ 0 (
    echo.
    echo =============================================
    echo   SUCCESS! Relay will auto-start on login.
    echo   No window. Logs in andheri_relay.log
    echo =============================================
) else (
    echo ERROR: Failed. Try running as Administrator.
)

pause
