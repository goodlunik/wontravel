@echo off
cd /d "%~dp0"

echo.
echo ========================================
echo   WonTravel - Auto Deploy
echo ========================================
echo.

REM Check changes
echo [1/4] Checking changes...
echo.
git status --short
echo.

REM No changes? Exit
git diff-index --quiet HEAD --
if %errorlevel% equ 0 (
    echo No changes to deploy.
    echo.
    pause
    exit /b 0
)

REM Get commit message
echo ----------------------------------------
set /p MESSAGE="Commit message (Enter for auto): "

if "%MESSAGE%"=="" (
    for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value ^| find "="') do set DT=%%I
    set MESSAGE=Update !DT:~0,4!-!DT:~4,2!-!DT:~6,2!
)

echo.
echo [2/4] git add .
git add .
if %errorlevel% neq 0 (
    echo ERROR: git add failed
    pause
    exit /b 1
)

echo.
echo [3/4] git commit -m "%MESSAGE%"
git commit -m "%MESSAGE%"
if %errorlevel% neq 0 (
    echo.
    echo ERROR: commit failed.
    echo If you see "Author identity unknown", run setup.bat first.
    echo.
    pause
    exit /b 1
)

echo.
echo [4/4] git push
git push
if %errorlevel% neq 0 (
    echo ERROR: push failed
    pause
    exit /b 1
)

echo.
echo ========================================
echo  SUCCESS! Vercel will auto-build.
echo ========================================
echo.
echo  GitHub:  https://github.com/goodlunik/wontravel
echo  Vercel:  https://vercel.com/dashboard
echo  Live:    https://wontravel.vercel.app
echo.
echo  Build takes about 2-3 minutes.
echo.
pause
