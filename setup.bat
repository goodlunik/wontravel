@echo off
cd /d "%~dp0"

echo.
echo ========================================
echo   Tobi App - Git Setup
echo ========================================
echo.
echo Auto-configuring Git identity:
echo   Email: goodlunik@gmail.com
echo   Name:  lunik
echo.

git config --global user.email "goodlunik@gmail.com"
git config --global user.name "lunik"

echo.
echo Done!
echo ----------------------------------------
echo Email:
git config --global user.email
echo Name:
git config --global user.name
echo ----------------------------------------
echo.
pause
