@echo off
setlocal

powershell.exe -NoExit -ExecutionPolicy Bypass -File "%~dp0scripts\start-local-backend.ps1"
