# Руководство по интеграции Frontend с LeadHunter Backend API

Данное руководство предназначено для фронтенд-разработчика. Бэкенд реализован на **FastAPI**, поддерживает **CORS** для любого порта разработки (`localhost:5173`, `localhost:3000` и др.) и предоставляет интерактивную документацию Swagger по адресу:
👉 **`http://localhost:8000/docs`**

Готовые TypeScript-типы находятся в файле: [`frontend_contracts.ts`](frontend_contracts.ts).

---

## 1. Запуск бэкенда

В корне проекта выполните двойной клик по [`run_backend.bat`](run_backend.bat) (или в терминале `python run.py`).  
Сервер поднимется на: `http://localhost:8000`.

---

## 2. Экран 1: Стартовый поиск (Hero с пиксель-артом)

### 2.1. Получение списка городов для выпадающего списка
* **Метод**: `GET /api/geo/cities`
* **Ответ**: `["Москва", "Санкт-Петербург", "Казань", "Новосибирск", ...]`

### 2.2. Запуск поиска и аудита (Кнопка «Поиск ->»)
* **Метод**: `POST /api/search/start`
* **Тело запроса**:
  ```json
  {
    "niche": "Стоматология",
    "city": "Казань",
    "source": "all",
    "limit": 50
  }
  ```
  *(источники `source`: `"yandex"`, `"2gis"`, `"all"`)*
* **Ответ**:
  ```json
  {
    "campaign_id": 1,
    "task_id": "a1b2c3d4",
    "status": "STARTED",
    "message": "Сбор запущен..."
  }
  ```
* **Действие фронтенда**: сохранить `campaign_id`, переключить экран на рабочий стол (Дашборд) и открыть WebSocket соединение.

---

## 3. Экран 2: Рабочий стол (Дашборд с таблицей и прогрессом)

### 3.1. Подключение к WebSocket для Live-стриминга
* **URL**: `ws://localhost:8000/ws/{campaign_id}`

#### Обработка событий WebSocket:

1. **`PROGRESS` (Полоса прогресса `34 / 50 leads - 68%`)**:
   ```json
   {
     "type": "PROGRESS",
     "data": {
       "found": 34,
       "limit": 50,
       "percent": 68
     }
   }
   ```
2. **`AUDIT_STATUS` (Радар активности над таблицей)**:
   ```json
   {
     "type": "AUDIT_STATUS",
     "data": {
       "domain": "art-dent.ru",
       "step": "AUDITING_SITE",
       "message": "Аудит: Art-Dent (art-dent.ru)..."
     }
   }
   ```
3. **`NEW_LEAD` (Мгновенное добавление строки в таблицу на лету)**:
   ```json
   {
     "type": "NEW_LEAD",
     "data": {
       "id": 12,
       "campaign_id": 1,
       "name": "Art-Dent",
       "category": "Стоматологическая клиника",
       "address": "Казань, ул. Баумана, 10",
       "rating": 4.8,
       "reviews_count": 124,
       "primary_phone": "+7 843 123-4567",
       "email": "info@art-dent.ru",
       "telegram": "@artdent_kazan",
       "website": "https://art-dent.ru",
       "status_badge": "NO_SSL",
       "lead_score": 95,
       "has_ssl": false,
       "is_adaptive": true,
       "has_analytics": false,
       "pitch": {
         "pain": "Браузеры помечают сайт как Опасный...",
         "solution": "Установка SSL-сертификата...",
         "opening_phrase": "Здравствуйте! Заметил, что при переходе с карт на ваш сайт..."
       }
     }
   }
   ```
4. **`CAPTCHA_REQUIRED` (Баннер оповещения о капче)**:
   ```json
   {
     "type": "CAPTCHA_REQUIRED",
     "data": {
       "service": "yandex",
       "message": "Яндекс запросил прохождение капчи",
       "hint": "Пройдите проверку в окне браузера и нажмите кнопку 'Готово'"
     }
   }
   ```
   *Пользователь проходит капчу в открытом окне браузера и жмет кнопку на фронте, которая отправляет:*  
   `POST /api/search/captcha/resolved` с телом `{"campaign_id": 1}`.
5. **`COMPLETED` / `STOPPED`**:
   Завершение сбора.

### 3.2. Дополнительные действия на дашборде
* **Принудительная остановка (Кнопка «Остановить»)**:
  `POST /api/search/stop` с телом `{"campaign_id": 1}`.
* **Экспорт в Excel (Кнопка «Export to Excel»)**:
  Переход по ссылке: `http://localhost:8000/api/export/excel?campaign_id={campaign_id}` — браузер автоматически скачает отформатированный `.xlsx` файл.
* **Скрипт звонка для боковой шторки (по клику на стрелочку `->`)**:
  `GET /api/leads/{lead_id}/pitch` — возвращает полный текст оффера.

---

## 4. Экран 3: Вкладка «Отчёты» (История поисков)

### 4.1. Список всех прошлых поисков
* **Метод**: `GET /api/reports`
* **Ответ**:
  ```json
  [
    {
      "id": 1,
      "created_at": "2026-09-28T21:40:00Z",
      "finished_at": "2026-09-28T21:42:30Z",
      "niche": "Стоматология",
      "city": "Казань",
      "source": "all",
      "requested_limit": 50,
      "found_count": 50,
      "status": "COMPLETED",
      "summary": {
        "no_site": 8,
        "no_ssl": 14,
        "not_responsive": 9,
        "no_analytics": 22
      }
    }
  ]
  ```

### 4.2. Открытие старого отчета (просмотр без повторного сбора)
* **Метод**: `GET /api/reports/{campaign_id}`
* **Ответ**: объект кампании и полный массив собранных лидов `leads: LeadItem[]` для отображения в таблице дашборда.

### 4.3. Скачивание Excel старого отчета
* Ссылка: `http://localhost:8000/api/export/excel?campaign_id={campaign_id}`.

### 4.4. Удаление старого отчета
* **Метод**: `DELETE /api/reports/{campaign_id}`.
