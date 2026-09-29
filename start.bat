@echo off
cd /d "%~dp0"
title LeadHunter Pro

set "VENV_DIR=%~dp0.venv"
set "VENV_PYTHON=%VENV_DIR%\Scripts\python.exe"

REM Check if virtual environment exists and is functional on THIS machine
if exist "%VENV_PYTHON%" (
    "%VENV_PYTHON%" --version >nul 2>&1
    if not errorlevel 1 goto :run_app
    echo [!] Virtual environment is not compatible with this PC or is corrupted.
    echo [*] Re-creating virtual environment for your machine...
    rmdir /s /q "%VENV_DIR%" >nul 2>&1
)

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

echo [*] Installing required packages: FastAPI, Playwright, PyWebView...
"%VENV_PYTHON%" -m pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install requirements. Please check internet connection.
    pause
    exit /b 1
)

echo [*] Downloading Chromium browser for maps scraping...
"%VENV_DIR%\Scripts\playwright.exe" install chromium
echo [OK] Setup completed successfully!
echo ======================================================================

:run_app
"%VENV_PYTHON%" launcher.py

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Process exited with code %errorlevel%
    pause
)
