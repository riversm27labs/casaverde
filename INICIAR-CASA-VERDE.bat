@echo off
cd /d "%~dp0"
node --version >nul 2>&1
if errorlevel 1 (
 echo Instale o Node.js 22.13 ou superior e abra este arquivo novamente.
 pause
 exit /b 1
)
start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 3; Start-Process http://localhost:5173"
node --env-file-if-exists=.env server/local.mjs
pause
