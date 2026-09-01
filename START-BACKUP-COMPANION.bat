@echo off
setlocal
cd /d "%~dp0"
echo Paradise Lawn Care - Backup Companion
node backup-companion\companion.mjs
if errorlevel 1 pause
endlocal
