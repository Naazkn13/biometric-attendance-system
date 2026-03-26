@echo off
title AttendPay Backend Server
echo ========================================
echo   AttendPay Backend - Starting...
echo ========================================
cd /d "%~dp0backend"
if exist "venv\Scripts\activate.bat" (
    call venv\Scripts\activate.bat
) else if exist ".venv\Scripts\activate.bat" (
    call .venv\Scripts\activate.bat
)
echo Starting FastAPI server on port 8000...
uvicorn app.main:app --host 0.0.0.0 --port 8000
pause
