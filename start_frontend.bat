@echo off
title AttendPay Frontend Server
echo ========================================
echo   AttendPay Frontend - Starting...
echo ========================================
cd /d "%~dp0frontend"
echo Starting Next.js dev server on port 3000...
npm run dev
pause
