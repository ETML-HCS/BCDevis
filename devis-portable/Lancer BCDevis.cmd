@echo off
setlocal
set "APP_DIR=%~dp0"
for %%I in ("%APP_DIR%..") do set "PROJECT_DIR=%%~fI"
set "ELECTRON_EXE=%PROJECT_DIR%\node_modules\electron\dist\electron.exe"
set "ELECTRON_RUN_AS_NODE="

if not exist "%ELECTRON_EXE%" (
  echo Le moteur BCDevis est introuvable.
  echo.
  echo Depuis "%PROJECT_DIR%", lancez d'abord : npm install
  echo Ou utilisez directement le fichier BCDevis-*.exe du dossier dist.
  pause
  exit /b 1
)

start "BCDevis" /D "%PROJECT_DIR%" "%ELECTRON_EXE%" "%PROJECT_DIR%"
exit /b 0
