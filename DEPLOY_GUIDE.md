# 🚀 Инструкция по развертыванию LeadHunter Pro на Linux-сервере за Cloudflare Proxy

Данное руководство описывает быстрый запуск изолированного контейнера с базой данных и обратным прокси Nginx.

---

## ⚡ Развертывание в 4 шага (Команды на сервере)

### 1. Подготовка конфигурации `.env`
Склонируйте проект или перейдите в его директорию и создайте файл `.env`:
```bash
cp .env.example .env
nano .env
```
Заполните обязательные переменные:
* `SECRET_KEY` — сгенерируйте надежный ключ: `openssl rand -hex 32`
* `INITIAL_ADMIN_EMAIL` — ваш email для входа
* `INITIAL_ADMIN_PASSWORD` — надежный пароль
* `COOKIE_SECURE=true` (так как Cloudflare работает по HTTPS)

---

### 2. Сборка и запуск контейнера (Docker)
```bash
docker compose up -d --build
```
> Контейнер скомпилирует бэкенд, установит Playwright Chromium, инициализирует базу данных SQLite и автоматически создаст учетную запись администратора.  
> Сервер слушает только локальный адрес: `127.0.0.1:8000` (защищен от прямого доступа извне).

---

### 3. Настройка Nginx
Скопируйте подготовленный конфигурационный файл в директорию Nginx:
```bash
sudo cp nginx.conf /etc/nginx/sites-available/leadhunter.conf
sudo nano /etc/nginx/sites-available/leadhunter.conf # укажите ваш server_name (домен)
sudo ln -sf /etc/nginx/sites-available/leadhunter.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

---

### 4. Настройка Cloudflare (SSL / Proxy)
1. В панели Cloudflare в разделе **DNS** включите оранжевое облако (Proxy status: **Proxied**) для вашего домена/поддомена.
2. В разделе **SSL/TLS**:
   * Выберите режим **Full** (или **Flexible**, если на сервере пока нет Origin-сертификата).
   * Включите **Always Use HTTPS**.
   * В разделе **Network** убедитесь, что включен переключатель **WebSockets**.

---

## 🔒 Проверка работоспособности

1. Откройте в браузере: `https://your-domain.com`
2. Система автоматически выполнит редирект на: `https://your-domain.com/login?returnUrl=/`
3. Введите ваш email и пароль администратора.
4. После входа будет установлена защищенная `HttpOnly; Secure; SameSite=Lax` Cookie `access_token`, и откроется рабочий дашборд лидогенерации и аудита сайтов.
5. Для выхода нажмите «Выйти» или перейдите по адресу: `https://your-domain.com/logout`.

---

## 🛠️ Полезные команды управления

* **Просмотр логов бэкенда и парсера:**
  ```bash
  docker compose logs -f leadhunter
  ```
* **Перезапуск контейнера:**
  ```bash
  docker compose restart leadhunter
  ```
* **Остановка приложения:**
  ```bash
  docker compose down
  ```
* **Резервная копия базы данных и лидов:**
  ```bash
  cp leadhunter.db backup_$(date +%F).db
  ```
