import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

# Директория для данных и БД (папка data/ для Docker или локального запуска)
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

# База данных SQLite: поддержка data/leadhunter.db и обратная совместимость с leadhunter.db
if (DATA_DIR / "leadhunter.db").exists():
    DB_PATH = (DATA_DIR / "leadhunter.db").resolve()
elif (BASE_DIR / "leadhunter.db").is_file():
    DB_PATH = (BASE_DIR / "leadhunter.db").resolve()
else:
    DB_PATH = (DATA_DIR / "leadhunter.db").resolve()

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

