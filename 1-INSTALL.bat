@echo off
cd /d "%~dp0"
echo Installing PCW (MERN)...
if not exist server\.env copy server\.env.example server\.env >nul
call npm run setup
call npm run fetch-images
echo.
echo Done! Now double-click 2-RUN.bat or 3-SHARE.bat
pause
