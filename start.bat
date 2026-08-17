@echo off
REM ============================================================
REM  FirstStep - one-click launcher (Windows)
REM  Double-click this file to install deps, start the engine's
REM  interface, and open it in your browser.
REM ============================================================
title FirstStep - Job Engine
cd /d "%~dp0"

where bun >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Bun is not installed. Install it from https://bun.sh then run this file again.
  echo.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installing dependencies...
  call bun install
  if errorlevel 1 (
    echo.
    echo  Dependency install failed. Check the error above.
    echo.
    pause
    exit /b 1
  )
)

echo.
echo  Starting FirstStep... the interface will open in your browser.
echo  (If the page loads slowly, refresh once the server is up.)
echo.
start "" http://localhost:5173
call bun run dev
pause
