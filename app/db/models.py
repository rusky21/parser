from datetime import datetime, timezone
from typing import List, Optional, Any
from sqlalchemy import (
    Integer, String, Float, Boolean, DateTime, ForeignKey, 
    Text, UniqueConstraint, JSON
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.database import Base

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

class SearchCampaign(Base):
    """Поисковая кампания (для вкладки 'Отчёты')"""
    __tablename__ = "search_campaigns"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    niche: Mapped[str] = mapped_column(String(255), nullable=False)
    city: Mapped[str] = mapped_column(String(255), nullable=False)
    source: Mapped[str] = mapped_column(String(50), default="all")  # 'yandex', '2gis', 'all'
    target_limit: Mapped[int] = mapped_column(Integer, default=50)
    found_count: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(50), default="PENDING")  # PENDING, RUNNING, PAUSED_CAPTCHA, COMPLETED, STOPPED, FAILED
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Связь с организациями
    organizations: Mapped[List["Organization"]] = relationship(
        "Organization",
        back_populates="campaign",
        cascade="all, delete-orphan",
        order_by="Organization.id"
    )

    def to_summary_dict(self) -> dict:
        """Сводка по кампании для списка в отчётах"""
        no_site = 0
        no_ssl = 0
        not_responsive = 0
        no_analytics = 0
        
        for org in self.organizations:
            if org.audit:
                if org.audit.status in ("NO_SITE", "SITE_DOWN"):
                    no_site += 1
                if not org.audit.has_ssl and org.audit.status not in ("NO_SITE", "ONLY_SOCIAL"):
                    no_ssl += 1
                if not org.audit.is_adaptive and org.audit.status not in ("NO_SITE", "ONLY_SOCIAL"):
                    not_responsive += 1
                if not org.audit.has_analytics and org.audit.status not in ("NO_SITE", "ONLY_SOCIAL"):
                    no_analytics += 1

        return {
            "id": self.id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "finished_at": self.finished_at.isoformat() if self.finished_at else None,
            "niche": self.niche,
            "city": self.city,
            "source": self.source,
            "requested_limit": self.target_limit,
            "found_count": self.found_count,
            "status": self.status,
            "summary": {
                "no_site": no_site,
                "no_ssl": no_ssl,
                "not_responsive": not_responsive,
                "no_analytics": no_analytics
            }
        }


class Organization(Base):
    """Спарсенная организация из геосервиса"""
    __tablename__ = "organizations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    campaign_id: Mapped[int] = mapped_column(Integer, ForeignKey("search_campaigns.id", ondelete="CASCADE"), nullable=False)
    source: Mapped[str] = mapped_column(String(50), nullable=False)  # 'yandex' | '2gis'
    external_id: Mapped[str] = mapped_column(String(255), nullable=False)
    
    name: Mapped[str] = mapped_column(String(500), nullable=False)
    category: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    address: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    rating: Mapped[float] = mapped_column(Float, default=0.0)
    reviews_count: Mapped[int] = mapped_column(Integer, default=0)
    
    phones: Mapped[Any] = mapped_column(JSON, default=list)  # Список телефонов из карточки
    website: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    telegram: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)  # Прямой ник или ссылка t.me
    has_telegram: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    card_url: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    # Связи
    campaign: Mapped["SearchCampaign"] = relationship("SearchCampaign", back_populates="organizations")
    audit: Mapped[Optional["AuditResult"]] = relationship(
        "AuditResult",
        back_populates="organization",
        uselist=False,
        cascade="all, delete-orphan"
    )

    __table_args__ = (
        UniqueConstraint("source", "external_id", "campaign_id", name="uq_source_external_campaign"),
    )


class AuditResult(Base):
    """Результаты аудита сайта и персонализированный оффер"""
    __tablename__ = "audit_results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    org_id: Mapped[int] = mapped_column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), unique=True, nullable=False)
    
    # Статус аудита: 'OK', 'NO_SITE', 'ONLY_SOCIAL', 'SITE_DOWN', 'BROKEN_SOCIAL_LINK'
    status: Mapped[str] = mapped_column(String(50), default="OK")
    has_ssl: Mapped[bool] = mapped_column(Boolean, default=False)
    is_adaptive: Mapped[bool] = mapped_column(Boolean, default=False)
    has_analytics: Mapped[bool] = mapped_column(Boolean, default=False)
    detected_cms: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    last_updated_year: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    final_url: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    
    # Спарсенные контакты с сайта
    extra_phones: Mapped[Any] = mapped_column(JSON, default=list)
    extra_emails: Mapped[Any] = mapped_column(JSON, default=list)
    extra_socials: Mapped[Any] = mapped_column(JSON, default=list)  # tg, vk, wa

    # Бейдж статуса для фронтенда (согласно референсу)
    # 'NO_SSL' | 'NOT_RESPONSIVE' | 'NO_ANALYTICS' | 'HTTPS_OK' | 'NO_WEBSITE' | 'SITE_DOWN'
    status_badge: Mapped[str] = mapped_column(String(50), default="HTTPS_OK")
    lead_score: Mapped[int] = mapped_column(Integer, default=50)  # 0 - 100

    # Скрипт продаж / оффер для менеджера
    pitch_pain: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    pitch_solution: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    pitch_opening_phrase: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    pitch_full_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    audited_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    organization: Mapped["Organization"] = relationship("Organization", back_populates="audit")


class FLOrder(Base):
    """Спарсенный заказ с биржи FL.ru"""
    __tablename__ = "fl_orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)  # ID проекта на FL.ru (например, 5432190)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    price_raw: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)  # Исходная строка (напр. "15 000 ₽" или "По договоренности")
    price_rub: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, index=True)  # Парсированная сумма в рублях для фильтрации
    is_negotiable: Mapped[bool] = mapped_column(Boolean, default=False)  # Флаг "По договоренности"
    category_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    category_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    url: Mapped[str] = mapped_column(String(1000), nullable=False)
    is_pro_only: Mapped[bool] = mapped_column(Boolean, default=False)
    is_urgent: Mapped[bool] = mapped_column(Boolean, default=False)
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    # Взаимодействие (избранное/скрыто)
    interaction: Mapped[Optional["FLOrderInteraction"]] = relationship(
        "FLOrderInteraction",
        back_populates="order",
        uselist=False,
        lazy="selectin",
        cascade="all, delete-orphan"
    )

    def to_dict(self) -> dict:
        is_fav = False
        is_hid = False
        is_rd = False
        # Безопасное чтение без DetachedInstanceError при отделенной сессии
        inter = self.__dict__.get("interaction")
        if inter:
            is_fav = getattr(inter, "is_favorite", False)
            is_hid = getattr(inter, "is_hidden", False)
            is_rd = getattr(inter, "is_read", False)

        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "price_raw": self.price_raw,
            "price_rub": self.price_rub,
            "is_negotiable": self.is_negotiable,
            "category_id": self.category_id,
            "category_name": self.category_name,
            "url": self.url,
            "is_pro_only": self.is_pro_only,
            "is_urgent": self.is_urgent,
            "published_at": self.published_at.isoformat() if self.published_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "is_favorite": is_fav,
            "is_hidden": is_hid,
            "is_read": is_rd,
        }


class FLCategorySync(Base):
    """Фиксация первой синхронизации категории для предотвращения флуда старыми заказами"""
    __tablename__ = "fl_category_sync"

    category_id: Mapped[str] = mapped_column(String(100), primary_key=True)
    category_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    synced_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)


class FLOrderInteraction(Base):
    """Пользовательские метки десктопа: прочитано / избранное / скрыто"""
    __tablename__ = "fl_order_interactions"

    order_id: Mapped[int] = mapped_column(Integer, ForeignKey("fl_orders.id", ondelete="CASCADE"), primary_key=True)
    is_favorite: Mapped[bool] = mapped_column(Boolean, default=False)
    is_hidden: Mapped[bool] = mapped_column(Boolean, default=False)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    order: Mapped["FLOrder"] = relationship("FLOrder", back_populates="interaction")


class TelegramUser(Base):
    """Пользователь Telegram-бота"""
    __tablename__ = "telegram_users"

    chat_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    full_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    settings: Mapped[Optional["TelegramUserSettings"]] = relationship(
        "TelegramUserSettings",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan"
    )


class TelegramUserSettings(Base):
    """Персональные настройки уведомлений и фильтров пользователя Telegram"""
    __tablename__ = "telegram_user_settings"

    chat_id: Mapped[int] = mapped_column(Integer, ForeignKey("telegram_users.chat_id", ondelete="CASCADE"), primary_key=True)
    fl_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    fl_categories: Mapped[Any] = mapped_column(JSON, default=list)  # Список выбранных ID категорий
    fl_min_price: Mapped[int] = mapped_column(Integer, default=0)
    fl_negative_words: Mapped[Any] = mapped_column(JSON, default=list)
    fl_keywords: Mapped[Any] = mapped_column(JSON, default=list)  # Белые ключевые слова для фильтрации
    fl_allow_negotiable: Mapped[bool] = mapped_column(Boolean, default=True)  # Принимать по договоренности
    fl_hide_pro: Mapped[bool] = mapped_column(Boolean, default=False)  # Скрывать только для PRO
    fl_urgent_only: Mapped[bool] = mapped_column(Boolean, default=False)  # Только срочные
    maps_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    maps_only_with_telegram: Mapped[bool] = mapped_column(Boolean, default=False)  # Только с TG
    maps_source_filter: Mapped[str] = mapped_column(String(50), default="all")  # all / yandex / 2gis
    maps_only_without_site: Mapped[bool] = mapped_column(Boolean, default=False)  # Только без сайта
    maps_only_without_ssl: Mapped[bool] = mapped_column(Boolean, default=False)  # Только без SSL
    notify_sound: Mapped[bool] = mapped_column(Boolean, default=True)  # Звуковые уведомления
    notify_captcha: Mapped[bool] = mapped_column(Boolean, default=True)  # Оповещения о капче
    default_limit: Mapped[int] = mapped_column(Integer, default=50)  # Лимит сбора по умолчанию

    user: Mapped["TelegramUser"] = relationship("TelegramUser", back_populates="settings")


class FLOrderDelivery(Base):
    """История отправки заказов конкретным Telegram пользователям"""
    __tablename__ = "fl_order_deliveries"

    order_id: Mapped[int] = mapped_column(Integer, ForeignKey("fl_orders.id", ondelete="CASCADE"), primary_key=True)
    chat_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    is_sent: Mapped[bool] = mapped_column(Boolean, default=False)
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
