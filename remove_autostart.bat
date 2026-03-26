@echo off
REM ========================================
REM   AttendPay - Remove Auto-Start
REM   Run as Administrator to disable
REM ========================================

net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: This script must be run as Administrator!
    echo Right-click this file and select "Run as administrator"
    pause
    exit /b 1
)

schtasks /delete /tn "AttendPay-AutoStart" /f

if %errorLevel% equ 0 (
    echo Auto-start has been disabled.
    echo AttendPay will no longer start automatically on boot.
) else (
    echo No auto-start task found to remove.
)

pause
