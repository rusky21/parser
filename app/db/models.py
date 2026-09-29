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
