import sys
import asyncio

if sys.platform == "win32" and sys.version_info < (3, 14):
    try:
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    except Exception:
        pass

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.db.database import init_db
from app.api.search import router as search_router
from app.api.leads import router as leads_router
from app.api.reports import router as reports_router
from app.api.export import router as export_router
from app.api.geo import router as geo_router
from app.api.fl import router as fl_router
from app.api.settings import router as settings_router
from app.api.websocket import ws_manager
from app.services.fl.fl_worker import fl_worker
from app.services.telegram.bot_service import tg_bot_service

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("leadhunter")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Старт: автоматическая инициализация базы данных SQLite
    logger.info("Initializing SQLite database...")
    await init_db()
    logger.info("Database initialized successfully.")

    # Запуск фонового парсера FL.ru
    fl_worker.start()

    # Запуск Telegram-бота (если указан токен)
    await tg_bot_service.start()

    yield

    # Остановка
    logger.info("Application shutting down...")
    fl_worker.stop()
    await tg_bot_service.stop()
    logger.info("Application shutdown complete.")

app = FastAPI(
    title="LeadHunter & Audit API",
    description="Асинхронный бэкенд парсинга Яндекс.Карт и 2ГИС, глубокого аудита сайтов и генерации офферов",
    version="1.0.0",
    lifespan=lifespan
)

# Настройка CORS для беспрепятственного подключения фронтенда с любого порта
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Подключение роутеров
app.include_router(search_router)
app.include_router(leads_router)
app.include_router(reports_router)
app.include_router(export_router)
app.include_router(geo_router)
app.include_router(fl_router)
app.include_router(settings_router)

# Глобальный WebSocket для всех событий (FL заказы, смена статусов)
@app.websocket("/ws/events")
async def websocket_global_endpoint(websocket: WebSocket):
    await ws_manager.connect_global(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect_global(websocket)
    except Exception as e:
        logger.warning(f"Global WebSocket error: {e}")
        ws_manager.disconnect_global(websocket)

# WebSocket для стриминга прогресса конкретной кампании
@app.websocket("/ws/{campaign_id}")
async def websocket_endpoint(websocket: WebSocket, campaign_id: int):
    await ws_manager.connect(campaign_id, websocket)
    try:
        while True:
            # Слушаем сообщения от клиента (например, ping/keepalive)
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect(campaign_id, websocket)
    except Exception as e:
        logger.warning(f"WebSocket connection error: {e}")
        ws_manager.disconnect(campaign_id, websocket)

@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "ok", "service": "LeadHunter API"}

# Раздача фронтенда из собранной папки фронт/dist
from pathlib import Path
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse

_candidates = [
    Path(__file__).resolve().parent.parent / "фронт" / "dist",
    Path(__file__).resolve().parent.parent / "frontend" / "dist",
    Path(__file__).resolve().parent.parent / "dist",
]
FRONTEND_DIST = next((d for d in _candidates if d.exists()), _candidates[0])

if FRONTEND_DIST.exists():
    if (FRONTEND_DIST / "assets").exists():
        app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        # Исключаем API и Swagger роуты
        if full_path.startswith(("api", "docs", "openapi.json", "ws")):
            raise HTTPException(status_code=404, detail="Not found")
        file_candidate = FRONTEND_DIST / full_path
        if full_path and file_candidate.is_file():
            return FileResponse(file_candidate)
        return FileResponse(FRONTEND_DIST / "index.html")
else:
    @app.get("/")
    async def fallback_no_frontend():
        return HTMLResponse("""
        <!DOCTYPE html>
        <html lang="ru">
        <head>
            <meta charset="UTF-8">
            <title>LeadHunter Pro — API Backend</title>
            <style>
                body { background: #0B0F19; color: #f1f5f9; font-family: system-ui, -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
                .card { background: #131B2E; border: 1px solid #1E293B; border-radius: 16px; padding: 40px; max-width: 600px; text-align: center; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
                h1 { color: #38BDF8; font-size: 24px; margin-bottom: 12px; }
                p { color: #94A3B8; font-size: 15px; line-height: 1.6; }
                a.btn { display: inline-block; background: #2563EB; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; margin-top: 16px; transition: background 0.2s; }
                a.btn:hover { background: #1D4ED8; }
                code { background: #0F172A; padding: 4px 8px; border-radius: 6px; color: #38BDF8; font-size: 13px; }
            </style>
        </head>
        <body>
            <div class="card">
                <h1>🎯 LeadHunter Pro — Бэкенд запущен</h1>
                <p>Бэкенд-сервер и API работают в штатном режиме.<br>Статический бандл фронтенда еще не был собран.</p>
                <a class="btn" href="/docs">Открыть Swagger API документацию</a>
                <p style="margin-top: 24px; font-size: 13px;">Для сборки веб-интерфейса выполните в терминале:<br><code>cd фронт && npm install && npm run build</code></p>
            </div>
        </body>
        </html>
        """)


