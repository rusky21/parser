@echo off
cd /d "%~dp0"
title LeadHunter Pro

set "VENV_DIR=%~dp0.venv"
set "VENV_PYTHON=%VENV_DIR%\Scripts\python.exe"

REM If venv doesn't exist, go to setup
if not exist "%VENV_PYTHON%" goto :setup_venv

REM 1. Check if all required packages are present and working
"%VENV_PYTHON%" -c "import uvicorn, fastapi, playwright" >nul 2>&1
if not errorlevel 1 goto :run_app

REM 2. If pip inside venv is alive, just install packages
"%VENV_PYTHON%" -m pip --version >nul 2>&1
if not errorlevel 1 goto :install_deps

REM 3. If pip is corrupted, delete broken .venv and rebuild
echo [!] Virtual environment .venv is corrupted.
echo [*] Automatically re-creating virtual environment from scratch...
rmdir /s /q "%VENV_DIR%" >nul 2>&1
goto :setup_venv

:setup_venv
echo ======================================================================
echo   Initial setup of LeadHunter for your PC
echo ======================================================================

set "SYS_PYTHON="
python --version >nul 2>&1
if %errorlevel% equ 0 set "SYS_PYTHON=python"
if "%SYS_PYTHON%"=="" (
    py --version >nul 2>&1
    if %errorlevel% equ 0 set "SYS_PYTHON=py"
)

if "%SYS_PYTHON%"=="" (
    echo.
    echo [ERROR] Python not found in system!
    echo Please install Python 3.10+ from https://www.python.org/
    echo Make sure to check the box: Add Python to PATH during installation.
    echo.
    pause
    exit /b 1
)

echo [*] Creating local virtual environment .venv...
%SYS_PYTHON% -m venv "%VENV_DIR%"
if %errorlevel% neq 0 (
    echo [ERROR] Failed to create virtual environment.
    pause
    exit /b 1
)

:install_deps
echo [*] Installing required packages: FastAPI, Playwright, PyWebView...
"%VENV_PYTHON%" -m pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo [!] Initial pip install failed. Repairing pip and retrying...
    "%VENV_PYTHON%" -m ensurepip --default-pip >nul 2>&1
    "%VENV_PYTHON%" -m pip install -r requirements.txt
)
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Failed to install requirements.
    echo Please delete the .venv folder manually and run start.bat again.
    pause
    exit /b 1
)

echo [*] Downloading Chromium browser for maps scraping...
"%VENV_PYTHON%" -m playwright install chromium
echo [OK] Setup completed successfully!
echo ======================================================================

:run_app
"%VENV_PYTHON%" launcher.py

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Process exited with code %errorlevel%
    pause
)
