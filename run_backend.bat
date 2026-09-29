@echo off
cd /d "%~dp0"
title LeadHunter Backend API

set "VENV_DIR=%~dp0.venv"
set "VENV_PYTHON=%VENV_DIR%\Scripts\python.exe"

REM Check if virtual environment exists and has required packages installed
if exist "%VENV_PYTHON%" (
    "%VENV_PYTHON%" -c "import uvicorn, fastapi, playwright" >nul 2>&1
    if not errorlevel 1 goto :run_app

    REM Check if pip inside .venv is functional
    "%VENV_PYTHON%" -m pip --version >nul 2>&1
    if not errorlevel 1 (
        echo [*] Virtual environment found. Installing missing packages...
        goto :install_deps
    )

    echo [!] Virtual environment .venv is corrupted (pip is damaged).
    echo [*] Automatically re-creating virtual environment from scratch...
    rmdir /s /q "%VENV_DIR%" >nul 2>&1
)

:setup_venv
echo ======================================================================
echo   Initial setup of LeadHunter Backend for your PC
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
echo [*] Installing required packages from requirements.txt...
"%VENV_PYTHON%" -m pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo [!] Initial pip install failed. Repairing pip and retrying...
    "%VENV_PYTHON%" -m ensurepip --default-pip >nul 2>&1
    "%VENV_PYTHON%" -m pip install -r requirements.txt
)
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Failed to install requirements.
    echo Please delete the .venv folder manually and run run_backend.bat again.
    pause
    exit /b 1
)

echo [*] Downloading Chromium browser for maps scraping...
"%VENV_PYTHON%" -m playwright install chromium
echo [OK] Setup completed successfully!
echo ======================================================================

:run_app
"%VENV_PYTHON%" run.py

if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Server exited with code %errorlevel%
    pause
)
