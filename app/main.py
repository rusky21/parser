import sys
import asyncio

if sys.platform == "win32":
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
from app.api.websocket import ws_manager

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
    yield
    # Остановка
    logger.info("Application shutting down.")

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

# WebSocket для стриминга прогресса и лидов в реальном времени
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
from fastapi.responses import FileResponse

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

