@echo off
title AttendPay Device Sync Agent
echo ========================================
echo   AttendPay Device Agent - Starting...
echo ========================================
cd /d "%~dp0"
if exist "backend\venv\Scripts\activate.bat" (
    call backend\venv\Scripts\activate.bat
) else if exist "backend\.venv\Scripts\activate.bat" (
    call backend\.venv\Scripts\activate.bat
)
echo Starting ZK Device Sync Agent...
python cloud_local_agent.py
pause
