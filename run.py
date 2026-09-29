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
    import os
    host = os.environ.get("HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", 8000))

    print("=" * 60)
    print(" 🚀 LeadHunter & Audit Backend API")
    print("=" * 60)
    print(f" • Сервер запускается на: http://{host}:{port}")
    print(f" • Документация Swagger UI: http://{host}:{port}/docs")
    print(f" • WebSocket поток событий: ws://{host}:{port}/ws/{{campaign_id}}")
    print("=" * 60)

    uvicorn.run(
        "app.main:app",
        host=host,
        port=port,
        reload=False,
        loop="asyncio.windows_events:ProactorEventLoop" if sys.platform == "win32" else "auto"
    )

if __name__ == "__main__":
    main()
