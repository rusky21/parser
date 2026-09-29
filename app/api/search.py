import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.db.models import SearchCampaign
from app.schemas.search import (
    SearchStartRequest, SearchStartResponse, 
    SearchStopRequest, SearchStopResponse,
    CaptchaResolvedRequest
)
from app.services.task_manager import task_manager

router = APIRouter(prefix="/api/search", tags=["Поиск и сбор"])

@router.post("/start", response_model=SearchStartResponse, summary="Запустить сбор и аудит лидов")
async def start_search(req: SearchStartRequest, db: AsyncSession = Depends(get_db)):
    """
    Запускает сбор лидов по нише и городу с выбранных геосервисов (Яндекс.Карты / 2ГИС).
    Создает поисковую кампанию и запускает фоновый воркер с отправкой событий через WebSocket.
    """
    # Создаем запись кампании
    campaign = SearchCampaign(
        niche=req.niche.strip(),
        city=req.city.strip(),
        source=req.source,
        target_limit=req.limit,
        status="RUNNING"
    )
    db.add(campaign)
    await db.commit()
    await db.refresh(campaign)

    task_id = str(uuid.uuid4())[:8]

    # Запускаем фоновую задачу
    task_manager.start_campaign(
        campaign_id=campaign.id,
        niche=campaign.niche,
        city=campaign.city,
        source=campaign.source,
        limit=campaign.target_limit
    )

    return SearchStartResponse(
        campaign_id=campaign.id,
        task_id=task_id,
        status="STARTED",
        message=f"Сбор запущен для «{campaign.niche}» в г. {campaign.city}. Подключитесь к WebSocket /ws/{campaign.id} для получения логов."
    )

@router.post("/stop", response_model=SearchStopResponse, summary="Принудительно остановить сбор")
async def stop_search(req: SearchStopRequest):
    """
    Останавливает запущенный процесс парсинга и закрывает браузер.
    """
    stopped = task_manager.stop_campaign(req.campaign_id)
    if not stopped:
        return SearchStopResponse(
            success=False,
            message="Задача не найдена или уже завершена."
        )
    return SearchStopResponse(
        success=True,
        message=f"Кампания {req.campaign_id} успешно остановлена."
    )

@router.post("/captcha/resolved", response_model=SearchStopResponse, summary="Подтвердить ручное прохождение капчи")
async def captcha_resolved(req: CaptchaResolvedRequest):
    """
    Вызывается фронтендом, когда пользователь решил капчу в открывшемся окне браузера.
    """
    task_manager.signal_captcha_resolved(req.campaign_id)
    return SearchStopResponse(
        success=True,
        message="Сигнал о решении капчи передан воркеру."
    )
