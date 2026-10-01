import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

# База данных SQLite (с защитой от создания директории Docker bind mount)
DB_PATH = (BASE_DIR / "leadhunter.db").resolve()
if DB_PATH.is_dir():
    DB_PATH = DB_PATH / "leadhunter.sqlite3"
DATABASE_URL = f"sqlite+aiosqlite:///{DB_PATH.as_posix()}"

# Директория для профилей браузера и экспорта
EXPORTS_DIR = BASE_DIR / "exports"
EXPORTS_DIR.mkdir(parents=True, exist_ok=True)

BROWSER_DATA_DIR = BASE_DIR / "browser_profile"
BROWSER_DATA_DIR.mkdir(parents=True, exist_ok=True)

# Настройки парсинга и аудита
DEFAULT_TIMEOUT_CONNECT = 5.0
DEFAULT_TIMEOUT_READ = 7.0
MAX_AUDIT_WORKERS = 8
CAPTCHA_TIMEOUT_SECONDS = 180  # 3 минуты ожидания ручного прохождения капчи

# Режим headless для браузера Playwright (автоматически True для Linux без GUI и серверов/Docker)
import sys
HEADLESS = os.environ.get("HEADLESS", "").lower() in ("true", "1")
if sys.platform != "win32" and not os.environ.get("DISPLAY") and not os.environ.get("WAYLAND_DISPLAY"):
    HEADLESS = True

