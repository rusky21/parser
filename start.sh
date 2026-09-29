#!/usr/bin/env bash
# ======================================================================
#  LeadHunter Pro — Universal Launcher for Linux, macOS & WSL
# ======================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "======================================================================"
echo "  🎯 LeadHunter Pro — Universal Startup (Linux / macOS / WSL)"
echo "======================================================================"

VENV_DIR="$SCRIPT_DIR/.venv"
VENV_PYTHON="$VENV_DIR/bin/python"

# 1. Check if virtual environment already exists and works
if [ -f "$VENV_PYTHON" ]; then
    if "$VENV_PYTHON" --version >/dev/null 2>&1; then
        echo "[✓] Using existing virtual environment in .venv"
        exec "$VENV_PYTHON" launcher.py "$@"
    else
        echo "[!] Existing virtual environment is invalid or incompatible. Recreating..."
        rm -rf "$VENV_DIR"
    fi
fi

# 2. Find system Python (3.10+)
SYS_PYTHON=""
for cmd in python3.12 python3.11 python3.10 python3 python; do
    if command -v "$cmd" >/dev/null 2>&1; then
        SYS_PYTHON="$cmd"
        break
    fi
done

if [ -z "$SYS_PYTHON" ]; then
    echo ""
    echo "[ERROR] Python 3 not found in system PATH!"
    echo "Please install Python 3.10+ (e.g. sudo apt install python3 python3-venv python3-pip)"
    exit 1
fi

echo "[*] Using Python: $($SYS_PYTHON --version) ($SYS_PYTHON)"

# 3. Create virtual environment
echo "[*] Creating virtual environment in .venv..."
$SYS_PYTHON -m venv "$VENV_DIR"

# 4. Upgrade pip and install requirements
echo "[*] Installing dependencies from requirements.txt..."
"$VENV_PYTHON" -m pip install --upgrade pip
"$VENV_PYTHON" -m pip install -r requirements.txt

# 5. Install Playwright Chromium browser
echo "[*] Installing Chromium for Playwright scraper..."
"$VENV_DIR/bin/playwright" install chromium || true

# If running on Linux without display, advise on headless or system dependencies
if [ "$(uname)" = "Linux" ]; then
    if [ -z "$DISPLAY" ] && [ -z "$WAYLAND_DISPLAY" ]; then
        echo "[*] Headless Linux environment detected (HEADLESS=1 enabled)"
        export HEADLESS=1
    fi
fi

echo "[OK] Setup completed successfully!"
echo "======================================================================"

# 6. Run launcher
exec "$VENV_PYTHON" launcher.py "$@"
