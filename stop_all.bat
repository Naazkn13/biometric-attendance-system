@echo off
echo ========================================
echo   AttendPay - Stopping All Services
echo ========================================

REM Kill uvicorn (backend)
taskkill /fi "WINDOWTITLE eq AttendPay-Backend*" /f >nul 2>&1
taskkill /im uvicorn.exe /f >nul 2>&1

REM Kill node (frontend)
taskkill /fi "WINDOWTITLE eq AttendPay-Frontend*" /f >nul 2>&1

REM Kill python agent
taskkill /fi "WINDOWTITLE eq AttendPay-Agent*" /f >nul 2>&1

echo All AttendPay services stopped.
echo [%date% %time%] AttendPay services stopped >> "%~dp0attendpay_startup.log"
pause
