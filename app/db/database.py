from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from app.config import DATABASE_URL

# SQLite aiosqlite engine
engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    connect_args={"check_same_thread": False},
)

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

async def init_db():
    """Инициализация таблиц базы данных при старте приложения"""
    async with engine.begin() as conn:
        from app.db import models  # noqa
        await conn.run_sync(Base.metadata.create_all)
