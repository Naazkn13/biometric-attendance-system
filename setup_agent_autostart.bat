@echo off
REM ========================================
REM   Yari Road PC - Agent Only Auto-Start
REM   Run this ONCE as Administrator
REM ========================================

echo ========================================
echo   Device Sync Agent - Auto-Start Setup
echo ========================================
echo.

REM Check for admin privileges
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: Must be run as Administrator!
    echo Right-click this file and select "Run as administrator"
    pause
    exit /b 1
)

set "SCRIPT_DIR=%~dp0"
set "TASK_NAME=AttendPay-DeviceAgent"

REM Remove existing task if it exists
schtasks /delete /tn "%TASK_NAME%" /f >nul 2>&1

REM Run silently via VBScript (no window, no taskbar icon)
schtasks /create ^
    /tn "%TASK_NAME%" ^
    /tr "wscript.exe \"%SCRIPT_DIR%run_agent_silent.vbs\"" ^
    /sc ONLOGON ^
    /rl HIGHEST ^
    /delay 0000:30 ^
    /f

if %errorLevel% equ 0 (
    echo.
    echo =============================================
    echo   SUCCESS! Agent will auto-start silently.
    echo =============================================
    echo   No window. No taskbar icon.
    echo   Logs written to: agent.log
    echo   To check status: open agent.log
    echo   To stop: Task Manager > Details > pythonw.exe > End Task
    echo =============================================
) else (
    echo ERROR: Failed. Try running as Administrator.
)

pause
