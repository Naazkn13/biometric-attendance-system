@echo off
echo ============================================
echo   Opening Port 8000 for AttendPay Backend
echo ============================================
echo.

:: Delete any existing rule with same name first
netsh advfirewall firewall delete rule name="AttendPay Backend Port 8000" >nul 2>&1

:: Add inbound rule for TCP port 8000
netsh advfirewall firewall add rule name="AttendPay Backend Port 8000" dir=in action=allow protocol=TCP localport=8000

if %ERRORLEVEL%==0 (
    echo.
    echo ✅ SUCCESS! Port 8000 is now open for incoming connections.
    echo    The eSSL device can now reach your backend.
) else (
    echo.
    echo ❌ FAILED! Make sure you ran this as Administrator.
)
echo.
pause
