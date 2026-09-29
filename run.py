import uvicorn
import sys
import asyncio
import subprocess

if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass
    try:
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    except Exception:
        pass

def check_playwright():
    """Проверка и доустановка браузера Playwright Chromium при первом запуске"""
    try:
        import playwright
    except ImportError:
        print("[!] Библиотека playwright не установлена. Установите зависимости: pip install -r requirements.txt")

def main():
    print("=" * 60)
    print(" 🚀 LeadHunter & Audit Backend API")
    print("=" * 60)
    print(" • Сервер запускается на: http://127.0.0.1:8000")
    print(" • Документация Swagger UI: http://127.0.0.1:8000/docs")
    print(" • WebSocket поток событий: ws://127.0.0.1:8000/ws/{campaign_id}")
    print("=" * 60)

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=False,
        loop="asyncio.windows_events:ProactorEventLoop" if sys.platform == "win32" else "auto"
    )

if __name__ == "__main__":
    main()
