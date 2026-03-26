@echo off
REM ========================================
REM   AttendPay - Setup Auto-Start Service
REM   Run this ONCE as Administrator
REM   Creates Windows Task Scheduler task
REM   to auto-start on machine boot
REM ========================================

echo ========================================
echo   AttendPay Auto-Start Setup
echo ========================================
echo.

REM Check for admin privileges
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: This script must be run as Administrator!
    echo Right-click this file and select "Run as administrator"
    pause
    exit /b 1
)

set "SCRIPT_DIR=%~dp0"
set "START_ALL=%SCRIPT_DIR%start_all.bat"
set "TASK_NAME=AttendPay-AutoStart"

REM Remove existing task if it exists
schtasks /delete /tn "%TASK_NAME%" /f >nul 2>&1

REM Create scheduled task that runs at system startup
REM   /sc ONSTART  = runs when the computer starts (before any user logs in)
REM   /rl HIGHEST  = run with highest privileges
REM   /delay 0000:30 = 30 second delay after boot to let network initialize
schtasks /create ^
    /tn "%TASK_NAME%" ^
    /tr "\"%START_ALL%\"" ^
    /sc ONLOGON ^
    /rl HIGHEST ^
    /delay 0000:30 ^
    /f

if %errorLevel% equ 0 (
    echo.
    echo =============================================
    echo   SUCCESS! Auto-start configured.
    echo =============================================
    echo.
    echo   Task Name: %TASK_NAME%
    echo   Trigger:   On user logon (30s delay)
    echo   Action:    Starts all AttendPay services
    echo.
    echo   Services will now auto-start every time
    echo   this Windows user logs in. No click needed.
    echo.
    echo   To disable: Run "remove_autostart.bat"
    echo   To check:   Open Task Scheduler ^> %TASK_NAME%
    echo =============================================
) else (
    echo.
    echo ERROR: Failed to create scheduled task.
    echo Please try running as Administrator.
)

pause
