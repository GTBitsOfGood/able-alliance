@echo off
echo.
echo ============================================
echo   Testing CAS SSO Authentication Flow
echo ============================================
echo.

REM Check CAS server health
echo [1/5] Checking CAS server...
curl -s http://localhost:8443/health | findstr "ok" >nul 2>&1
if %errorlevel% equ 0 (
    echo       ✓ CAS server is healthy
) else (
    echo       ✗ CAS server is down
    echo       Run: docker-compose up -d
    pause
    exit /b 1
)
echo.

REM Check app server
echo [2/5] Checking Next.js app...
curl -s http://localhost:3000 >nul 2>&1
if %errorlevel% equ 0 (
    echo       ✓ App server is running
) else (
    echo       ✗ App server is down
    pause
    exit /b 1
)
echo.

REM Clear test user (optional - uncomment to start fresh)
echo [3/5] Clearing test user from database...
docker exec able-alliance-mongo-1 mongosh mongodb://localhost:27017/able-alliance --quiet --eval "db.users.deleteOne({ email: 'gburdell3@gatech.edu' })"
echo       ✓ Test user cleared
echo.

REM Prompt for manual login
echo [4/5] Manual Login Required
echo ============================================
echo.
echo   ^> Open browser: http://localhost:3000
echo   ^> Click "Sign in with Georgia Tech"
echo   ^> Login with: gburdell3 / password
echo.
echo   Press any key AFTER you have logged in...
pause >nul
echo.

REM Check session endpoint
echo [5/5] Verifying session data...
echo ============================================
echo.
echo   Checking /api/auth/session endpoint:
echo   (Note: This won't show the cookie-based session without browser cookies)
echo.
curl -s http://localhost:3000/api/auth/session
echo.
echo.

REM Check database for created user
echo   Checking MongoDB for user record:
echo   -----------------------------------
docker exec able-alliance-mongo-1 mongosh mongodb://localhost:27017/able-alliance --quiet --eval "printjson(db.users.findOne({ email: 'gburdell3@gatech.edu' }))"
echo.

echo ============================================
echo   Verification Complete!
echo ============================================
echo.
echo   Expected Results:
echo   - User record exists in MongoDB
echo   - type: "Student"
echo   - email: "gburdell3@gatech.edu"
echo   - studentInfo.GTID: "903123456"
echo.
echo   To test session with cookies, use browser DevTools:
echo   fetch('/api/auth/session').then(r =^> r.json()).then(console.log)
echo.
echo   To verify getUserByEmail behavior:
echo   1. Check app logs: docker logs able-alliance-app --tail 30
echo      - First login: "[UserAction] User not found, creating new user..."
echo      - Second login: "[UserAction] User found: [ObjectId]"
echo.
pause