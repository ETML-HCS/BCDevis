@echo off
setlocal
set "APP_DIR=%~dp0"
set "PROFILE_DIR=%APP_DIR%data\browser-profile"
set "BROWSER=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"

if not exist "%BROWSER%" set "BROWSER=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if not exist "%BROWSER%" set "BROWSER=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not exist "%BROWSER%" (
  echo Edge ou Chrome est necessaire pour lancer BCDevis.
  pause
  exit /b 1
)

if not exist "%PROFILE_DIR%" mkdir "%PROFILE_DIR%"
set "APP_URL=file:///%APP_DIR:\=/%index.html"
start "BCDevis" "%BROWSER%" --user-data-dir="%PROFILE_DIR%" --no-first-run --no-default-browser-check --app="%APP_URL%"
exit /b 0
