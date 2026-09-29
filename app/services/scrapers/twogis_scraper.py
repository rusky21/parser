import asyncio
import re
import urllib.parse
import json
import logging
from typing import List, Optional, Callable, Awaitable, Set
import httpx
from playwright.async_api import async_playwright, Page

from app.config import CAPTCHA_TIMEOUT_SECONDS
from app.services.scrapers.base import BaseScraper, ScrapedOrgItem

logger = logging.getLogger("twogis_scraper")

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
DEFAULT_2GIS_KEYS = ["rurbbn3446", "ruedfc3902", "rubnre2444"]

class TwoGisScraper(BaseScraper):
    """
    Гибридный скрейпер 2ГИС:
    - Пробует высокоскоростной API каталог
    - При блокировке ключей / IP переключается на Playwright с обработкой капчи (/museum)
    - Извлекает организации с телефонами, сайтами и адресами
    """

    def __init__(self, headless: bool = False):
        self.headless = headless
        self.api_key = DEFAULT_2GIS_KEYS[0]
        self._captcha_resolved_event = asyncio.Event()

    def signal_captcha_resolved(self):
        """Вызывается через API при подтверждении пользователем прохождения капчи"""
        self._captcha_resolved_event.set()

    def _normalize_phone(self, raw: str) -> Optional[str]:
        digits = re.sub(r"\D", "", raw)
        if len(digits) == 11 and digits[0] in ("7", "8"):
            return f"+7{digits[1:]}"
        elif len(digits) == 10:
            return f"+7{digits}"
        return raw if raw else None

    async def _check_and_handle_captcha(
        self,
        page: Page,
        on_captcha: Callable[[str], Awaitable[None]],
        on_status: Callable[[str], Awaitable[None]]
    ) -> bool:
        """Проверка и ожидание решения капчи 2ГИС (/museum или g-recaptcha)"""
        is_captcha = False
        try:
            curr_url = page.url
            if "museum" in curr_url or "captcha" in curr_url:
                is_captcha = True
            else:
                el = await page.query_selector("form[action*='form'], .g-recaptcha, iframe[src*='recaptcha']")
                if el and await el.is_visible():
                    is_captcha = True
        except Exception:
            pass

        if is_captcha:
            await on_captcha("2ГИС запросил подтверждение (капча / музей). Окно открыто, пройдите капчу!")
            self._captcha_resolved_event.clear()

            wait_time = 0
            while wait_time < CAPTCHA_TIMEOUT_SECONDS:
                await asyncio.sleep(2)
                wait_time += 2

                # Проверяем, ушел ли браузер со страницы капчи
                curr_url = page.url
                if ("museum" not in curr_url and "captcha" not in curr_url) or self._captcha_resolved_event.is_set():
                    await on_status("Капча 2ГИС успешно пройдена! Продолжаем сбор...")
                    await asyncio.sleep(2)
                    return True
            return False

        return True

    async def _scrape_via_browser(
        self,
        niche: str,
        city: str,
        limit: int,
        results: List[ScrapedOrgItem],
        seen_ids: Set[str],
        on_item_scraped: Callable[[ScrapedOrgItem], Awaitable[None]],
        on_status: Callable[[str], Awaitable[None]],
        on_captcha: Callable[[str], Awaitable[None]],
        is_cancelled: Callable[[], bool],
    ):
        """Резервный сбор через браузер Playwright при недоступности API ключей"""
        await on_status(f"Запуск браузерного сбора 2ГИС: «{niche} {city}»...")

        playwright_obj = None
        browser = None
        context = None

        try:
            playwright_obj = await async_playwright().start()
            browser = await playwright_obj.chromium.launch(
                headless=self.headless,
                args=[
                    "--disable-blink-features=AutomationControlled",
                    "--no-sandbox",
                    "--disable-dev-shm-usage",
                ]
            )
            context = await browser.new_context(
                user_agent=USER_AGENT,
                viewport={"width": 1366, "height": 850},
                locale="ru-RU"
            )
            page = await context.new_page()
            await page.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined});")

            # Перехват сетевых JSON ответов 2ГИС
            async def handle_response(resp):
                url = resp.url
                if ("items" in url or "search" in url) and len(results) < limit and not is_cancelled():
                    try:
                        ct = resp.headers.get("content-type", "")
                        if "json" in ct:
                            data = await resp.json()
                            items = data.get("result", {}).get("items", [])
                            for it in items:
                                if len(results) >= limit or is_cancelled():
                                    break
                                it_id = str(it.get("id", ""))
                                if it_id and it_id not in seen_ids:
                                    parsed = self._parse_api_item(it)
                                    if parsed:
                                        seen_ids.add(it_id)
                                        results.append(parsed)
                                        asyncio.create_task(on_item_scraped(parsed))
                    except Exception:
                        pass

            page.on("response", handle_response)

            search_url = f"https://2gis.ru/search/{urllib.parse.quote(f'{niche} {city}')}"
            await page.goto(search_url, timeout=30000, wait_until="domcontentloaded")
            await asyncio.sleep(3)

            # Проверяем капчу
            captcha_ok = await self._check_and_handle_captcha(page, on_captcha, on_status)
            if not captcha_ok or is_cancelled():
                return

            # Парсинг карточек из DOM
            no_new_counter = 0
            while len(results) < limit and not is_cancelled():
                prev_len = len(results)

                # Ищем ссылки на фирмы в левой панели
                firm_links = await page.query_selector_all("a[href*='/firm/']")
                for fl in firm_links:
                    if len(results) >= limit or is_cancelled():
                        break
                    try:
                        href = await fl.get_attribute("href") or ""
                        match = re.search(r"/firm/(\d+)", href)
                        if not match:
                            continue
                        firm_id = match.group(1)
                        if firm_id in seen_ids:
                            continue

                        # Название
                        name_text = (await fl.inner_text()).strip()
                        if not name_text or len(name_text) < 2:
                            continue

                        # Берем первую строку как название
                        name = name_text.split("\n")[0].strip()

                        # Адрес и доп информация из родительского блока
                        card_parent = await fl.evaluate_handle("el => el.closest('div[class*=\"searchBar\"], div[class*=\"miniCard\"], div')")
                        card_text = (await card_parent.inner_text()) if card_parent else ""

                        # Телефоны
                        phones = []
                        raw_phones = re.findall(r"(?:\+7|8)[\s\-\(]*\d{3}[\s\-\)]*\d{3}[\s\-]*\d{2}[\s\-]*\d{2}", card_text)
                        for p in raw_phones:
                            cl = self._normalize_phone(p)
                            if cl and cl not in phones:
                                phones.append(cl)

                        seen_ids.add(firm_id)
                        org_item = ScrapedOrgItem(
                            source="2gis",
                            external_id=firm_id,
                            name=name,
                            category=niche,
                            address=None,
                            rating=0.0,
                            reviews_count=0,
                            phones=phones,
                            website=None,
                            card_url=f"https://2gis.ru/firm/{firm_id}"
                        )
                        results.append(org_item)
                        await on_item_scraped(org_item)
                    except Exception:
                        continue

                # Скроллим список выдачи
                await page.evaluate("""() => {
                    const scrollable = document.querySelector('div[class*=\"scroll\"], div[class*=\"list\"]');
                    if (scrollable) scrollable.scrollTop += 1500;
                    else window.scrollBy(0, 800);
                }""")
                await asyncio.sleep(2.0)

                if len(results) == prev_len:
                    no_new_counter += 1
                else:
                    no_new_counter = 0

                if no_new_counter >= 5:
                    break

        except Exception as e:
            logger.warning(f"2GIS browser scrape error: {e}")
        finally:
            if context:
                try: await context.close()
                except Exception: pass
            if browser:
                try: await browser.close()
                except Exception: pass
            if playwright_obj:
                try: await playwright_obj.stop()
                except Exception: pass

    def _parse_api_item(self, item: dict) -> Optional[ScrapedOrgItem]:
        item_id = str(item.get("id", ""))
        name = item.get("name", "").strip()
        if not item_id or not name:
            return None

        # Рубрика
        rubrics = item.get("rubrics", [])
        category = rubrics[0].get("name") if rubrics else None
        if not category and "name_ex" in item:
            category = item["name_ex"].get("extension")

        address = item.get("address_name")

        # Рейтинг и отзывы
        reviews = item.get("reviews", {})
        rating = float(reviews.get("general_rating", 0.0) or 0.0)
        reviews_count = int(reviews.get("general_review_count", 0) or 0)

        # Контакты
        phones = []
        website = None

        contact_groups = item.get("contact_groups", [])
        for cg in contact_groups:
            for contact in cg.get("contacts", []):
                c_type = contact.get("type", "")
                if c_type == "phone":
                    phone_val = contact.get("text") or contact.get("value")
                    clean_p = self._normalize_phone(phone_val)
                    if clean_p and clean_p not in phones:
                        phones.append(clean_p)
                elif c_type in ("website", "url"):
                    if not website:
                        website = contact.get("url") or contact.get("text")

        return ScrapedOrgItem(
            source="2gis",
            external_id=item_id,
            name=name,
            category=category,
            address=address,
            rating=rating,
            reviews_count=reviews_count,
            phones=phones,
            website=website,
            card_url=f"https://2gis.ru/firm/{item_id}"
        )

    async def scrape(
        self,
        niche: str,
        city: str,
        limit: int,
        on_item_scraped: Callable[[ScrapedOrgItem], Awaitable[None]],
        on_status: Callable[[str], Awaitable[None]],
        on_captcha: Callable[[str], Awaitable[None]],
        is_cancelled: Callable[[], bool],
    ) -> List[ScrapedOrgItem]:
        results: List[ScrapedOrgItem] = []
        seen_ids = set()

        search_query = f"{niche} {city}".strip()
        await on_status(f"Поиск в 2ГИС: «{search_query}»...")

        headers = {
            "User-Agent": USER_AGENT,
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "ru-RU,ru;q=0.9",
            "Origin": "https://2gis.ru",
            "Referer": "https://2gis.ru/",
        }

        # 1. Попытка собрать через быстрый API
        api_blocked = False
        try:
            async with httpx.AsyncClient(headers=headers, timeout=10.0) as client:
                params = {
                    "q": search_query,
                    "page": 1,
                    "page_size": min(limit, 50),
                    "key": self.api_key,
                    "fields": "items.point,items.adm_div,items.contact_groups,items.flags,items.schedule,items.name_ex,items.rubrics,items.reviews,items.external_content,items.org",
                    "locale": "ru_RU",
                }
                resp = await client.get("https://catalog.api.2gis.com/3.0/items", params=params)
                if resp.status_code != 200 or "apiKeyIsBlocked" in resp.text or "forbidden" in resp.text:
                    api_blocked = True
                else:
                    data = resp.json()
                    items = data.get("result", {}).get("items", [])
                    for it in items:
                        if len(results) >= limit or is_cancelled():
                            break
                        parsed = self._parse_api_item(it)
                        if parsed and parsed.external_id not in seen_ids:
                            seen_ids.add(parsed.external_id)
                            results.append(parsed)
                            await on_item_scraped(parsed)
        except Exception:
            api_blocked = True

        # 2. Если API заблокирован, переключаемся на браузерный сбор
        if api_blocked and len(results) < limit and not is_cancelled():
            await on_status("2ГИС API требует валидации, переход на браузерный сбор 2ГИС...")
            await self._scrape_via_browser(
                niche=niche,
                city=city,
                limit=limit,
                results=results,
                seen_ids=seen_ids,
                on_item_scraped=on_item_scraped,
                on_status=on_status,
                on_captcha=on_captcha,
                is_cancelled=is_cancelled
            )

        await on_status(f"2ГИС: собрано {len(results)} организаций")
        return results
