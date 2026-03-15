@echo off
REM ================================================================
REM  setup_backend.bat
REM  Run this ONCE to install all backend dependencies including
REM  firebase-admin. Then follow the instructions printed at the end.
REM ================================================================

echo.
echo ========================================================
echo   LinkedAI Backend Setup
echo ========================================================
echo.

cd /d "%~dp0"

echo [1/3] Installing backend npm packages (including firebase-admin)...
cd backend
call npm install
echo.

echo [2/3] Installing Playwright browser (Chromium)...
call npx playwright install chromium
echo.

echo [3/3] Done!
echo.
echo ============================================================
echo   NEXT STEP — Firebase Service Account (REQUIRED)
echo ============================================================
echo.
echo  1. Open: https://console.firebase.google.com
echo  2. Select project: linkedin-6fea9
echo  3. Go to: Project Settings ^> Service Accounts
echo  4. Click "Generate new private key"
echo  5. Save the downloaded file as:
echo.
echo     backend\firebase\serviceAccountKey.json
echo.
echo  Once you do that, the backend can write stats directly
echo  to Firestore — even if the browser tab is closed.
echo.
echo ============================================================
echo   TO START THE BACKEND:
echo     cd backend
echo     node server.js
echo ============================================================
echo.
pause
