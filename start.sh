#!/usr/bin/env bash
# ======================================================================
#  🎯 LeadHunter Pro — Автоматический установщик и лаунчер для Ubuntu
#  Поддержка: Ubuntu 22.04 / 24.04 / 26.04 LTS, Debian 12+
# ======================================================================

set -e

# Цветовая палитра для вывода в терминал
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
PURPLE='\033[0;35m'
BOLD='\033[1m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Определение прав sudo
SUDO=""
if [ "$EUID" -ne 0 ]; then
    if command -v sudo >/dev/null 2>&1; then
        SUDO="sudo"
    else
        echo -e "${RED}[!] Этот скрипт требует прав root или установленной утилиты sudo.${NC}"
        exit 1
    fi
fi

# Вспомогательные функции вывода
log_info()    { echo -e "${CYAN}[*]${NC} $1"; }
log_success() { echo -e "${GREEN}[✓]${NC} $1"; }
log_warn()    { echo -e "${YELLOW}[!]${NC} $1"; }
log_error()   { echo -e "${RED}[✗]${NC} $1"; }
log_header()  {
    echo -e "${PURPLE}${BOLD}"
    echo "======================================================================"
    echo "  $1"
    echo "======================================================================"
    echo -e "${NC}"
}

# ----------------------------------------------------------------------
# 1. Проверка системных пакетов и установка зависимостей
# ----------------------------------------------------------------------
check_and_install_dependencies() {
    log_info "Проверка системного окружения Ubuntu..."

    local NEED_APT_UPDATE=0
    local PACKAGES_TO_INSTALL=()

    for pkg in curl openssl ufw sed grep; do
        if ! command -v "$pkg" >/dev/null 2>&1; then
            PACKAGES_TO_INSTALL+=("$pkg")
        fi
    done

    if [ ${#PACKAGES_TO_INSTALL[@]} -gt 0 ]; then
        log_info "Установка базовых утилит: ${PACKAGES_TO_INSTALL[*]}..."
        $SUDO apt-get update -qq
        $SUDO apt-get install -y -qq "${PACKAGES_TO_INSTALL[@]}"
        log_success "Базовые утилиты установлены."
    fi

    # Проверка Docker
    if ! command -v docker >/dev/null 2>&1; then
        log_warn "Docker не найден. Запуск официальной автоматической установки Docker..."
        curl -fsSL https://get.docker.com | $SUDO sh
        $SUDO systemctl enable --now docker
        if [ -n "$SUDO_USER" ]; then
            $SUDO usermod -aG docker "$SUDO_USER" || true
        else
            $SUDO usermod -aG docker "$USER" || true
        fi
        log_success "Docker успешно установлен и запущен."
    else
        log_success "Docker уже установлен: $(docker --version)"
    fi

    # Проверка Docker Compose (v2 плагин)
    if ! docker compose version >/dev/null 2>&1; then
        log_info "Установка плагина docker-compose-plugin..."
        $SUDO apt-get update -qq
        $SUDO apt-get install -y -qq docker-compose-plugin
        log_success "Docker Compose plugin установлен."
    fi

    # Проверка Nginx
    if ! command -v nginx >/dev/null 2>&1; then
        log_warn "Веб-сервер Nginx не найден. Установка Nginx..."
        $SUDO apt-get update -qq
        $SUDO apt-get install -y -qq nginx
        $SUDO systemctl enable --now nginx
        log_success "Nginx успешно установлен и запущен."
    else
        log_success "Nginx обнаружен: $(nginx -v 2>&1)"
    fi
}

# ----------------------------------------------------------------------
# 2. Интерактивный мастер первоначальной настройки (.env)
# ----------------------------------------------------------------------
configure_environment() {
    log_header "⚙️  МАСТЕР НАСТРОЙКИ ПАРАМЕТРОВ СЕРВЕРА (LEADHUNTER PRO)"
    echo -e "Скрипт запросит необходимые данные для запуска защищенного веб-сервиса."
    echo -e "Значения в квадратных скобках [по умолчанию] принимаются нажатием ${BOLD}Enter${NC}.\n"

    # Получаем внешний IP сервера в качестве подсказки
    SERVER_IP=$(curl -s -4 ifconfig.me || curl -s -4 icanhazip.com || echo "127.0.0.1")

    # 1. Доменное имя
    echo -e "${CYAN}${BOLD}[1/5] Домен или поддомен:${NC}"
    echo -e "Укажите домен, направленный через Cloudflare Proxy на IP этого сервера ($SERVER_IP)."
    read -rp "Доменное имя [например: lead.mydomain.ru или $SERVER_IP]: " INPUT_DOMAIN
    DOMAIN="${INPUT_DOMAIN:-$SERVER_IP}"
    DOMAIN="$(echo "$DOMAIN" | tr -d ' ' | tr '[:upper:]' '[:lower:]')"
    echo -e "  ➜ Домен: ${GREEN}${BOLD}$DOMAIN${NC}\n"

    # 2. Токен Telegram-бота
    echo -e "${CYAN}${BOLD}[2/5] Telegram-бот (@BotFather):${NC}"
    echo -e "Бот управляет парсингом, присылает лиды и заказы с биржи FL.ru в реальном времени."
    echo -e "Если у вас еще нет бота, создайте его в Telegram через ${BOLD}@BotFather${NC} и скопируйте токен."
    read -rp "Токен бота (нажмите Enter, чтобы пропустить): " INPUT_TG_TOKEN
    TG_TOKEN="$(echo "$INPUT_TG_TOKEN" | tr -d ' ')"

    TG_API_SERVER=""
    if [ -n "$TG_TOKEN" ]; then
        echo -e "  ➜ Токен бота: ${GREEN}${BOLD}Установлен (${TG_TOKEN:0:9}...)${NC}"
        echo -e "Опционально: реверс-прокси (Cloudflare Worker) для обхода блокировок Telegram API без VPN:"
        read -rp "Telegram API Proxy URL [Enter для прямого подключения]: " INPUT_TG_API
        TG_API_SERVER="$(echo "$INPUT_TG_API" | tr -d ' ')"
    else
        echo -e "  ➜ Telegram-бот: ${YELLOW}Пропущен (можно добавить позже в .env)${NC}"
    fi
    echo ""

    # 3. Email администратора
    echo -e "${CYAN}${BOLD}[3/5] Учетная запись: Email администратора:${NC}"
    read -rp "Email администратора [admin@lead.pro]: " INPUT_ADMIN_EMAIL
    ADMIN_EMAIL="${INPUT_ADMIN_EMAIL:-admin@lead.pro}"
    ADMIN_EMAIL="$(echo "$ADMIN_EMAIL" | tr -d ' ' | tr '[:upper:]' '[:lower:]')"
    echo -e "  ➜ Логин: ${GREEN}${BOLD}$ADMIN_EMAIL${NC}\n"

    # 4. Пароль администратора
    AUTO_PASS=$(openssl rand -base64 12 | tr -dc 'a-zA-Z0-9!@#%')
    echo -e "${CYAN}${BOLD}[4/5] Учетная запись: Пароль администратора:${NC}"
    echo -e "Сгенерирован надежный пароль по умолчанию: ${YELLOW}${BOLD}$AUTO_PASS${NC}"
    read -rp "Введите свой пароль [или Enter для использования сгенерированного]: " INPUT_ADMIN_PASS
    ADMIN_PASSWORD="${INPUT_ADMIN_PASS:-$AUTO_PASS}"
    echo -e "  ➜ Пароль: ${GREEN}${BOLD}$ADMIN_PASSWORD${NC}\n"

    # 5. Секретный ключ JWT (генерируется строго автоматически)
    echo -e "${CYAN}${BOLD}[5/5] Криптографический ключ безопасности (JWT):${NC}"
    SECRET_KEY=$(openssl rand -hex 32)
    echo -e "  ➜ SECRET_KEY автоматически сгенерирован (32 байта криптостойкой энтропии).\n"

    # Запись в .env
    cat <<EOF > .env
# ====================================================================
# LeadHunter Pro — Автоматически сгенерированная конфигурация окружения
# Дата создания: $(date '+%Y-%m-%d %H:%M:%S')
# ====================================================================

# Сетевые параметры
HOST=0.0.0.0
PORT=8000
DOMAIN=$DOMAIN

# Telegram-бот
TELEGRAM_BOT_TOKEN=$TG_TOKEN
TELEGRAM_API_SERVER=$TG_API_SERVER

# Безопасность и Cookie-авторизация за Cloudflare
SECRET_KEY=$SECRET_KEY
COOKIE_SECURE=true

# Учетные данные первого администратора
INITIAL_ADMIN_EMAIL=$ADMIN_EMAIL
INITIAL_ADMIN_PASSWORD=$ADMIN_PASSWORD
EOF

    chmod 600 .env
    log_success "Файл конфигурации .env успешно сформирован и защищен (права 600)."
}

# ----------------------------------------------------------------------
# 3. Настройка и активация Nginx для Cloudflare Proxy
# ----------------------------------------------------------------------
configure_nginx() {
    log_info "Конфигурация веб-сервера Nginx..."

    local DOMAIN
    DOMAIN=$(grep -E '^DOMAIN=' .env 2>/dev/null | cut -d '=' -f2- | tr -d ' ' || echo "localhost")
    if [ -z "$DOMAIN" ]; then
        DOMAIN="localhost"
    fi

    local NGINX_CONF_DEST="/etc/nginx/sites-available/leadhunter.conf"
    local NGINX_LINK="/etc/nginx/sites-enabled/leadhunter.conf"

    # Создание конфигурации на основе готового шаблона nginx.conf
    $SUDO sed "s/server_name your-domain.com;/server_name $DOMAIN;/" nginx.conf > /tmp/leadhunter.nginx.tmp
    $SUDO mv /tmp/leadhunter.nginx.tmp "$NGINX_CONF_DEST"
    $SUDO chmod 644 "$NGINX_CONF_DEST"

    # Активация симлинка
    if [ ! -L "$NGINX_LINK" ]; then
        $SUDO ln -sf "$NGINX_CONF_DEST" "$NGINX_LINK"
    fi

    # Отключение default страницы Nginx, если она занимает 80 порт
    if [ -L "/etc/nginx/sites-enabled/default" ]; then
        $SUDO rm -f "/etc/nginx/sites-enabled/default"
        log_info "Отключен стандартный сайт Nginx (default)."
    fi

    # Тестирование синтаксиса
    if $SUDO nginx -t >/dev/null 2>&1; then
        $SUDO systemctl reload nginx
        log_success "Конфигурация Nginx валидна и успешно перезагружена."
    else
        log_error "Ошибка проверки конфигурации Nginx!"
        $SUDO nginx -t
        exit 1
    fi
}

# ----------------------------------------------------------------------
# 4. Настройка UFW Firewall (Защита локального порта)
# ----------------------------------------------------------------------
configure_firewall() {
    if command -v ufw >/dev/null 2>&1; then
        if $SUDO ufw status | grep -q "Status: active"; then
            log_info "Настройка правил фаервола UFW..."
            $SUDO ufw allow 22/tcp >/dev/null 2>&1 || true
            $SUDO ufw allow 80/tcp >/dev/null 2>&1 || true
            $SUDO ufw allow 443/tcp >/dev/null 2>&1 || true
            # Порт 8000 закрыт от внешнего мира, доступен только локально
            log_success "Фаервол UFW настроен (порты 80, 443, 22 открыты; порт 8000 изолирован)."
        fi
    fi
}

# ----------------------------------------------------------------------
# 5. Сборка и запуск приложения через Docker Compose
# ----------------------------------------------------------------------
launch_application() {
    log_info "Сборка и запуск контейнеров LeadHunter Pro..."

    # Остановка старой ревизии если была
    docker compose down --remove-orphans >/dev/null 2>&1 || true

    # Сборка и старт в фоне
    docker compose up -d --build

    log_info "Ожидание инициализации сервиса и базы данных..."
    local HEALTHY=0
    for i in {1..20}; do
        if curl -s -f http://127.0.0.1:8000/health >/dev/null 2>&1; then
            HEALTHY=1
            break
        fi
        sleep 1
    done

    if [ $HEALTHY -eq 1 ]; then
        log_success "Бэкенд LeadHunter успешно запущен и отвечает на http://127.0.0.1:8000/health"
    else
        log_warn "Контейнер стартовал, но healthcheck еще не ответил. Проверьте статус через: docker compose logs -f"
    fi
}

# ----------------------------------------------------------------------
# 6. Финальный баннер с реквизитами доступа
# ----------------------------------------------------------------------
show_final_banner() {
    local DOMAIN ADMIN_EMAIL ADMIN_PASS TG_TOKEN
    DOMAIN=$(grep -E '^DOMAIN=' .env | cut -d '=' -f2- | tr -d ' ')
    ADMIN_EMAIL=$(grep -E '^INITIAL_ADMIN_EMAIL=' .env | cut -d '=' -f2- | tr -d ' ')
    ADMIN_PASS=$(grep -E '^INITIAL_ADMIN_PASSWORD=' .env | cut -d '=' -f2- | tr -d ' ')
    TG_TOKEN=$(grep -E '^TELEGRAM_BOT_TOKEN=' .env | cut -d '=' -f2- | tr -d ' ')

    echo ""
    echo -e "${GREEN}${BOLD}======================================================================${NC}"
    echo -e "${GREEN}${BOLD}  🚀 УСТАНОВКА И РАЗВЕРТЫВАНИЕ УСПЕШНО ЗАВЕРШЕНЫ!${NC}"
    echo -e "${GREEN}${BOLD}======================================================================${NC}"
    echo ""
    echo -e "  🌐 ${BOLD}Веб-интерфейс:${NC}         https://${DOMAIN} (или http://${DOMAIN})"
    echo -e "  🔐 ${BOLD}Страница входа:${NC}        https://${DOMAIN}/login"
    echo -e "  📧 ${BOLD}Email администратора:${NC}  ${CYAN}${ADMIN_EMAIL}${NC}"
    echo -e "  🔑 ${BOLD}Пароль:${NC}                ${YELLOW}${ADMIN_PASS}${NC}"
    echo ""
    if [ -n "$TG_TOKEN" ]; then
        echo -e "  🤖 ${BOLD}Telegram-бот:${NC}          ${GREEN}Подключен и запущен${NC}"
    else
        echo -e "  🤖 ${BOLD}Telegram-бот:${NC}          ${YELLOW}Не настроен (добавьте TELEGRAM_BOT_TOKEN в .env)${NC}"
    fi
    echo ""
    echo -e "${PURPLE}${BOLD}--- ВАЖНО: Настройка Cloudflare Dashboard ---${NC}"
    echo -e " 1. В разделе ${BOLD}DNS${NC} включите оранжевое облако (${BOLD}Proxied${NC}) для ${DOMAIN}."
    echo -e " 2. В разделе ${BOLD}SSL/TLS${NC} выберите режим ${BOLD}Full${NC} или ${BOLD}Flexible${NC} и включите ${BOLD}Always Use HTTPS${NC}."
    echo -e " 3. В разделе ${BOLD}Network${NC} убедитесь, что включен параметр ${BOLD}WebSockets${NC}."
    echo ""
    echo -e "${CYAN}${BOLD}--- Полезные команды управления ---${NC}"
    echo -e " • Просмотр логов в реальном времени:  ${BOLD}docker compose logs -f${NC}"
    echo -e " • Перезапуск приложения:             ${BOLD}docker compose restart${NC}"
    echo -e " • Остановка приложения:               ${BOLD}docker compose down${NC}"
    echo -e " • Повторный запуск скрипта:           ${BOLD}./start.sh${NC}"
    echo -e "${GREEN}${BOLD}======================================================================${NC}"
    echo ""
}

# ----------------------------------------------------------------------
# Главная логика
# ----------------------------------------------------------------------
main() {
    clear || true
    echo -e "${CYAN}${BOLD}======================================================================${NC}"
    echo -e "${CYAN}${BOLD}     🎯 LEADHUNTER PRO — АВТОМАТИЧЕСКОЕ РАЗВЕРТЫВАНИЕ (UBUNTU)         ${NC}"
    echo -e "${CYAN}${BOLD}======================================================================${NC}"
    echo ""

    # Проверка существующей конфигурации
    if [ -f ".env" ]; then
        log_info "Обнаружен существующий файл .env."
        echo ""
        echo -e "  ${BOLD}[1]${NC} 🚀 Запустить / Перезапустить сервис (Docker)"
        echo -e "  ${BOLD}[2]${NC} 👥 Управление пользователями (добавить, список, пароль)"
        echo -e "  ${BOLD}[3]${NC} 📋 Просмотр логов в реальном времени (docker compose logs -f)"
        echo -e "  ${BOLD}[4]${NC} 🛑 Остановить приложение (docker compose down)"
        echo -e "  ${BOLD}[5]${NC} ⚙️  Мастер полной перенастройки (.env, домен, пароль)"
        echo -e "  ${BOLD}[0]${NC} ❌ Выход"
        echo ""
        read -rp "Выберите действие [1/2/3/4/5/0, Enter=1]: " ACTION
        ACTION="${ACTION:-1}"

        case "$ACTION" in
            1)
                check_and_install_dependencies
                configure_nginx
                configure_firewall
                launch_application
                show_final_banner
                exit 0
                ;;
            2)
                # Вызов утилиты управления пользователями
                if docker compose ps 2>/dev/null | grep -q "leadhunter-pro"; then
                    docker compose exec leadhunter python manage_users.py
                elif [ -f ".venv/bin/python" ]; then
                    .venv/bin/python manage_users.py
                else
                    python3 manage_users.py
                fi
                exit 0
                ;;
            3)
                log_info "Подключение к потоку логов (Ctrl+C для выхода)..."
                docker compose logs -f
                exit 0
                ;;
            4)
                log_info "Остановка сервисов LeadHunter Pro..."
                docker compose down
                log_success "Контейнеры остановлены."
                exit 0
                ;;
            5)
                check_and_install_dependencies
                configure_environment
                configure_nginx
                configure_firewall
                launch_application
                show_final_banner
                exit 0
                ;;
            0)
                exit 0
                ;;
            *)
                log_error "Неверный выбор."
                exit 1
                ;;
        esac
    else
        check_and_install_dependencies
        configure_environment
        configure_nginx
        configure_firewall
        launch_application
        show_final_banner
        exit 0
    fi
}

main "$@"
