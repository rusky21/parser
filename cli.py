import asyncio
import os
import sys
from pathlib import Path
from datetime import datetime

from app.db.database import async_session_factory, init_db
from app.db.models import SearchCampaign, Organization, AuditResult, utc_now
from app.services.scrapers.yandex_scraper import YandexScraper
from app.services.scrapers.twogis_scraper import TwoGisScraper
from app.services.scrapers.base import ScrapedOrgItem
from app.services.site_auditor import SiteAuditor
from app.services.excel_exporter import ExcelExporter
from app.config import EXPORTS_DIR

# Принудительная установка UTF-8 для консоли Windows и ProactorEventLoop
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
GREEN = "\033[92m"
YELLOW = "\033[93m"
RED = "\033[91m"
CYAN = "\033[96m"
BOLD = "\033[1m"
RESET = "\033[0m"

async def run_cli():
    os.system("cls" if os.name == "nt" else "clear")
    print(f"{CYAN}{BOLD}======================================================================{RESET}")
    print(f"{CYAN}{BOLD}          🎯 LEADHUNTER — ИНТЕРАКТИВНЫЙ CLI ПАРСЕР И АУДИТОР          {RESET}")
    print(f"{CYAN}{BOLD}======================================================================{RESET}\n")

    await init_db()

    # Ввод параметров
    niche = input(f"{BOLD}1. Введите нишу (например, Стоматология, Ремонт квартир): {RESET}").strip()
    if not niche:
        niche = "Стоматология"
        print(f"   {YELLOW}Используется по умолчанию: {niche}{RESET}")

    city = input(f"{BOLD}2. Введите город (например, Казань, Москва): {RESET}").strip()
    if not city:
        city = "Казань"
        print(f"   {YELLOW}Используется по умолчанию: {city}{RESET}")

    print(f"\n{BOLD}3. Выберите источник карт:{RESET}")
    print("   [1] 2ГИС (Высокая скорость через API)")
    print("   [2] Яндекс.Карты (Playwright с поддержкой капчи)")
    print("   [3] Оба геосервиса (Рекомендуется)")
    source_choice = input(f"{BOLD}   Ваш выбор [1/2/3, Enter=3]: {RESET}").strip()
    
    source_map = {"1": "2gis", "2": "yandex", "3": "all"}
    source = source_map.get(source_choice, "all")

    limit_input = input(f"\n{BOLD}4. Лимит количества лидов [по умолчанию 20]: {RESET}").strip()
    try:
        limit = int(limit_input) if limit_input else 20
    except ValueError:
        limit = 20

    print(f"\n{GREEN}{BOLD}[*] Запуск сбора: «{niche}» в г. «{city}» (Лимит: {limit}, Источник: {source}){RESET}\n")
    print("-" * 70)

    # Создаем кампанию в БД
    campaign = SearchCampaign(
        niche=niche,
        city=city,
        source=source,
        target_limit=limit,
        status="RUNNING"
    )
    async with async_session_factory() as db:
        db.add(campaign)
        await db.commit()
        await db.refresh(campaign)

    auditor = SiteAuditor()
    collected = []
    collected_count = 0

    async def on_status(msg: str):
        print(f"{CYAN}[ИНФО]{RESET} {msg}")

    async def on_captcha(msg: str):
        print(f"\n{YELLOW}{BOLD}[⚠️ ВНИМАНИЕ КАПЧА]{RESET} {msg}")

    async def on_item_scraped(item: ScrapedOrgItem):
        nonlocal collected_count
        collected_count += 1
        print(f"\n{BOLD}[{collected_count}/{limit}] Найдена организация:{RESET} {item.name}")
        print(f"   Адрес: {item.address or 'Не указан'}")
        print(f"   Телефон из карт: {item.phones[0] if item.phones else 'Не указан'}")
        print(f"   Сайт: {item.website or 'НЕТ САЙТА'}")

        # Глубокий аудит сайта
        print(f"   {CYAN}⚡ Запуск глубокого аудита сайта...{RESET}")
        audit_res = await auditor.audit_url(
            url=item.website,
            org_name=item.name,
            category=item.category or niche,
            city=city
        )

        badge = audit_res["status_badge"]
        score = audit_res["lead_score"]
        pitch = audit_res["pitch"]

        # Вывод статуса цветным бейджем
        if badge in ("NO_SSL", "NO_WEBSITE", "SITE_DOWN"):
            badge_color = RED
        elif badge == "NOT_RESPONSIVE":
            badge_color = YELLOW
        elif badge == "NO_ANALYTICS":
            badge_color = YELLOW
        else:
            badge_color = GREEN

        print(f"   Статус: {badge_color}{BOLD}[{badge}]{RESET} | Горячесть лида: {BOLD}{score}/100{RESET}")
        if audit_res["extra_emails"]:
            print(f"   Найден Email: {audit_res['extra_emails'][0]}")

        print(f"   {BOLD}Скрипт звонка:{RESET} {pitch.get('opening_phrase', '')[:120]}...")

        # Сохранение в SQLite
        async with async_session_factory() as db:
            org = Organization(
                campaign_id=campaign.id,
                source=item.source,
                external_id=item.external_id,
                name=item.name,
                category=item.category or niche,
                address=item.address,
                rating=item.rating,
                reviews_count=item.reviews_count,
                phones=item.phones,
                website=item.website,
                card_url=item.card_url
            )
            db.add(org)
            await db.flush()

            audit_rec = AuditResult(
                org_id=org.id,
                status=audit_res["status"],
                has_ssl=audit_res["has_ssl"],
                is_adaptive=audit_res["is_adaptive"],
                has_analytics=audit_res["has_analytics"],
                detected_cms=audit_res["detected_cms"],
                last_updated_year=audit_res["last_updated_year"],
                final_url=audit_res["final_url"],
                extra_phones=audit_res["extra_phones"],
                extra_emails=audit_res["extra_emails"],
                extra_socials=audit_res["extra_socials"],
                status_badge=audit_res["status_badge"],
                lead_score=audit_res["lead_score"],
                pitch_pain=pitch.get("pain"),
                pitch_solution=pitch.get("solution"),
                pitch_opening_phrase=pitch.get("opening_phrase"),
                pitch_full_text=pitch.get("full_text")
            )
            db.add(audit_rec)
            await db.commit()

            # Добавляем в локальный список для Excel
            org.audit = audit_rec
            collected.append(org)

    # Запуск скрейперов
    if source == "2gis":
        scraper = TwoGisScraper()
        await scraper.scrape(
            niche=niche,
            city=city,
            limit=limit,
            on_item_scraped=on_item_scraped,
            on_status=on_status,
            on_captcha=on_captcha,
            is_cancelled=lambda: collected_count >= limit
        )
    elif source == "yandex":
        scraper = YandexScraper(headless=False)
        await scraper.scrape(
            niche=niche,
            city=city,
            limit=limit,
            on_item_scraped=on_item_scraped,
            on_status=on_status,
            on_captcha=on_captcha,
            is_cancelled=lambda: collected_count >= limit
        )
    else:  # "all"
        half = (limit + 1) // 2
        twogis = TwoGisScraper()
        await twogis.scrape(
            niche=niche,
            city=city,
            limit=half,
            on_item_scraped=on_item_scraped,
            on_status=on_status,
            on_captcha=on_captcha,
            is_cancelled=lambda: collected_count >= limit
        )
        remaining = limit - collected_count
        if remaining > 0:
            yandex = YandexScraper(headless=False)
            await yandex.scrape(
                niche=niche,
                city=city,
                limit=remaining,
                on_item_scraped=on_item_scraped,
                on_status=on_status,
                on_captcha=on_captcha,
                is_cancelled=lambda: collected_count >= limit
            )

    # Генерация отчета Excel
    print(f"\n{BOLD}----------------------------------------------------------------------{RESET}")
    print(f"{GREEN}{BOLD}✅ СБОР ЗАВЕРШЕН! Собрано лидов: {len(collected)}{RESET}")

    if collected:
        excel_stream = ExcelExporter.generate_campaign_excel(campaign, collected)
        timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S")
        excel_filename = f"leads_{niche}_{city}_{timestamp_str}.xlsx".replace(" ", "_")
        excel_path = EXPORTS_DIR / excel_filename

        with open(excel_path, "wb") as f:
            f.write(excel_stream.getvalue())

        print(f"\n{GREEN}{BOLD}[📊 EXCEL СОЗДАН]{RESET} Файл сохранен:")
        print(f"👉 {excel_path.resolve()}")

        # Открываем Excel файл в Windows
        try:
            os.startfile(excel_path)
            print(f"{CYAN}[*] Файл Excel автоматически открыт в системе.{RESET}")
        except Exception:
            pass

    print(f"\nДанные также сохранены в SQLite базе (leadhunter.db) и доступны через API.")
    input(f"\n{BOLD}Нажмите Enter для возврата в меню...{RESET}")

if __name__ == "__main__":
    asyncio.run(run_cli())
