@echo off
setlocal

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\setup-local-backend.ps1"
if errorlevel 1 (
  echo.
  echo Setup did not finish. Read the message above, then run this file again.
  pause
  exit /b 1
)

echo.
echo Setup is complete. You can now double-click Start-Nearby-Lunch.cmd.
pause
