@echo off
REM ========================================
REM   AttendPay - Master Launcher
REM   Starts all services in background
REM ========================================

REM Start Backend (minimized / hidden)
start /min "AttendPay-Backend" cmd /c "%~dp0start_backend.bat"

REM Wait 5 seconds for backend to initialize
timeout /t 5 /nobreak >nul

REM Start Frontend (minimized / hidden)
start /min "AttendPay-Frontend" cmd /c "%~dp0start_frontend.bat"

REM Start Device Sync Agent (minimized / hidden)
start /min "AttendPay-Agent" cmd /c "%~dp0start_agent.bat"

REM Log startup
echo [%date% %time%] AttendPay services started >> "%~dp0attendpay_startup.log"
