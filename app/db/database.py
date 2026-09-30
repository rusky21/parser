from sqlalchemy import event
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from app.config import DATABASE_URL

# SQLite aiosqlite engine
engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    connect_args={"check_same_thread": False},
)

@event.listens_for(engine.sync_engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL;")
    cursor.execute("PRAGMA busy_timeout=10000;")
    cursor.execute("PRAGMA synchronous=NORMAL;")
    cursor.close()

async_session_factory = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

class Base(DeclarativeBase):
    pass

async def get_db():
    """Dependency для получения асинхронной сессии БД в FastAPI эндпоинтах"""
    async with async_session_factory() as session:
        try:
            yield session
        finally:
            await session.close()

from sqlalchemy import text

async def init_db():
    """Инициализация таблиц базы данных при старте приложения"""
    async with engine.begin() as conn:
        from app.db import models  # noqa
        await conn.run_sync(Base.metadata.create_all)

        # Безопасная миграция для существующих БД
        migrations = [
            "ALTER TABLE organizations ADD COLUMN telegram VARCHAR(255)",
            "ALTER TABLE organizations ADD COLUMN has_telegram BOOLEAN DEFAULT 0",
            "ALTER TABLE telegram_user_settings ADD COLUMN fl_keywords TEXT DEFAULT '[]'",
            "ALTER TABLE telegram_user_settings ADD COLUMN fl_allow_negotiable BOOLEAN DEFAULT 1",
            "ALTER TABLE telegram_user_settings ADD COLUMN fl_hide_pro BOOLEAN DEFAULT 0",
            "ALTER TABLE telegram_user_settings ADD COLUMN fl_urgent_only BOOLEAN DEFAULT 0",
            "ALTER TABLE telegram_user_settings ADD COLUMN maps_source_filter VARCHAR(50) DEFAULT 'all'",
            "ALTER TABLE telegram_user_settings ADD COLUMN maps_only_without_site BOOLEAN DEFAULT 0",
            "ALTER TABLE telegram_user_settings ADD COLUMN maps_only_without_ssl BOOLEAN DEFAULT 0",
            "ALTER TABLE telegram_user_settings ADD COLUMN notify_sound BOOLEAN DEFAULT 1",
            "ALTER TABLE telegram_user_settings ADD COLUMN notify_captcha BOOLEAN DEFAULT 1",
            "ALTER TABLE telegram_user_settings ADD COLUMN default_limit INTEGER DEFAULT 50",
        ]
        for mig in migrations:
            try:
                await conn.execute(text(mig))
            except Exception:
                pass
