import asyncio
import logging
from datetime import datetime, timezone
from typing import List, Set, Optional
from sqlalchemy import select, insert

from app.db.database import async_session_factory
from app.db.models import FLOrder, FLCategorySync, FLOrderInteraction, TelegramUserSettings, utc_now
from app.services.fl.fl_fetcher import FLFetcher
from app.services.fl.constants import CATEGORY_BY_ID, FL_CATEGORIES
from app.services.connection_manager import ws_manager

logger = logging.getLogger("fl_worker")

class FLWorker:
    """
    Фоновый воркер опроса биржи FL.ru:
    - Периодический опрос ленты каждые 35-50 сек
    - Защита от спама старыми заказами при первом старте категории (per-category sync)
    - Дедупликация через SQLite
    - Мгновенный пуш в десктоп через WebSocket
    - Передача новых релевантных заказов в Telegram-диспетчер
    """

    def __init__(self, poll_interval: int = 40):
        self.poll_interval = poll_interval
        self._task: Optional[asyncio.Task] = None
        self._is_running: bool = False
        self.fetcher = FLFetcher()

    @property
    def is_running(self) -> bool:
        return self._is_running

    def start(self):
        if self._is_running:
            return
        self._is_running = True
        self._task = asyncio.create_task(self._run_loop())
        logger.info("FLWorker запущен.")

    def stop(self):
        self._is_running = False
        if self._task and not self._task.done():
            self._task.cancel()
        logger.info("FLWorker остановлен.")

    async def _get_active_categories(self) -> List[str]:
        """Получает список всех категорий, на которые подписаны пользователи или десктоп"""
        category_ids: Set[str] = set()

        # Категории по умолчанию для десктопа
        default_cats = {"2", "5", "7"}
        category_ids.update(default_cats)

        # Категории из настроек пользователей Telegram
        try:
            async with async_session_factory() as db:
                res = await db.execute(
                    select(TelegramUserSettings.fl_categories).where(TelegramUserSettings.fl_enabled == True)
                )
                for (cats,) in res.all():
                    if isinstance(cats, list):
                        for c in cats:
                            if str(c).strip():
                                category_ids.add(str(c).strip())
        except Exception as e:
            logger.error(f"Ошибка получения категорий из настроек: {e}")

        return list(category_ids)

    async def _run_loop(self):
        logger.info(f"FLWorker: запущен цикл с интервалом {self.poll_interval} сек.")
        while self._is_running:
            try:
                await self.poll_cycle()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"FLWorker непредвиденная ошибка в цикле: {e}", exc_info=True)

            try:
                await asyncio.sleep(self.poll_interval)
            except asyncio.CancelledError:
                break

    async def poll_cycle(self, force: bool = False):
        """Один шаг опроса всех активных категорий"""
        categories = await self._get_active_categories()
        # Также всегда проверяем общую ленту (None)
        all_targets = [None] + categories

        # Отложенный импорт tg_dispatcher во избежание циклических зависимостей
        from app.services.telegram.dispatcher import tg_dispatcher

        for cat_id in all_targets:
            if not self._is_running and not force:
                break

            cat_name = CATEGORY_BY_ID.get(cat_id, {}).get("name", "Все категории" if not cat_id else f"Категория {cat_id}")
            sync_key = str(cat_id or "all")

            # 1. Проверяем, опрашивалась ли эта категория ранее
            is_first_sync = False
            async with async_session_factory() as db:
                sync_record = await db.get(FLCategorySync, sync_key)
                if not sync_record:
                    is_first_sync = True
                    db.add(FLCategorySync(
                        category_id=sync_key,
                        category_name=cat_name,
                        synced_at=utc_now()
                    ))
                    await db.commit()

            # 2. Скачиваем проекты
            projects = await self.fetcher.fetch_projects(category_id=cat_id)
            if not projects:
                continue

            # 3. Сохранение и дедупликация
            new_orders_saved = []
            async with async_session_factory() as db:
                for proj in projects:
                    proj_id = proj["id"]
                    existing = await db.get(FLOrder, proj_id)
                    if existing:
                        continue

                    # Создаем запись заказа
                    order = FLOrder(
                        id=proj_id,
                        title=proj["title"],
                        description=proj["description"],
                        price_raw=proj["price_raw"],
                        price_rub=proj["price_rub"],
                        is_negotiable=proj["is_negotiable"],
                        category_id=str(proj.get("category_id") or cat_id or "all"),
                        category_name=proj.get("category_name") or cat_name,
                        url=proj["url"],
                        is_pro_only=proj["is_pro_only"],
                        is_urgent=proj["is_urgent"],
                        published_at=proj["published_at"],
                        created_at=utc_now()
                    )
                    db.add(order)
                    await db.flush()

                    interaction = FLOrderInteraction(
                        order_id=order.id,
                        is_favorite=False,
                        is_hidden=False,
                        is_read=False,
                        updated_at=utc_now()
                    )
                    order.interaction = interaction
                    db.add(interaction)
                    new_orders_saved.append(order)

                await db.commit()

            # 4. Логика первого запуска vs Новые заказы
            if is_first_sync:
                logger.info(
                    f"FLWorker: [Первый запуск] Для «{cat_name}» сохранено {len(new_orders_saved)} исторических заказов без отправки в Telegram."
                )
            else:
                for order in new_orders_saved:
                    # А. Отправляем в десктоп через WebSocket
                    order_dict = order.to_dict()
                    await ws_manager.broadcast_all({
                        "type": "NEW_FL_ORDER",
                        "data": order_dict
                    })

                    # Б. Отправляем в Telegram подписчикам с фильтрацией
                    await tg_dispatcher.dispatch_fl_order(order)

            # Небольшая пауза между запросами к разным категориям
            await asyncio.sleep(2.0)

fl_worker = FLWorker()
