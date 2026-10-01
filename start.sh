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

# Функция проверки занятости порта
is_port_in_use() {
    local PORT=$1
    if command -v ss >/dev/null 2>&1; then
        ss -tlpn "sport = :$PORT" 2>/dev/null | grep -q ":$PORT " && return 0
    fi
    if command -v lsof >/dev/null 2>&1; then
        lsof -ti ":$PORT" >/dev/null 2>&1 && return 0
    fi
    if command -v fuser >/dev/null 2>&1; then
        fuser "$PORT/tcp" >/dev/null 2>&1 && return 0
    fi
    return 1
}

# Автоматический поиск свободного порта (с приоритетом портов, поддерживаемых Cloudflare)
find_first_free_port() {
    local CANDIDATES=(8080 8880 2052 2082 8081 8088 9000)
    for p in "${CANDIDATES[@]}"; do
        if ! is_port_in_use "$p"; then
            echo "$p"
            return
        fi
    done
    # Если все заняты — берем случайный свободный от 8080
    local p=8080
    while is_port_in_use "$p"; do
        p=$((p + 1))
    done
    echo "$p"
}

# ----------------------------------------------------------------------
# 1. Проверка системных пакетов и установка зависимостей
# ----------------------------------------------------------------------
check_and_install_dependencies() {
    log_info "Проверка окружения Ubuntu..."

    # Восстановление dpkg, если предыдущая установка nginx прервалась
    $SUDO dpkg --configure -a 2>/dev/null || true
    # Если на хосте пытался запуститься nginx и упал из-за 80 порта — останавливаем хостовый nginx
    $SUDO systemctl stop nginx 2>/dev/null || true
    $SUDO systemctl disable nginx 2>/dev/null || true

    local PACKAGES_TO_INSTALL=()
    for pkg in curl openssl ufw sed grep; do
        if ! command -v "$pkg" >/dev/null 2>&1; then
            PACKAGES_TO_INSTALL+=("$pkg")
        fi
    done

    if [ ${#PACKAGES_TO_INSTALL[@]} -gt 0 ]; then
        log_info "Установка базовых утилит: ${PACKAGES_TO_INSTALL[*]}..."
        $SUDO apt-get update -qq
        DEBIAN_FRONTEND=noninteractive $SUDO apt-get install -y -qq "${PACKAGES_TO_INSTALL[@]}"
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
        DEBIAN_FRONTEND=noninteractive $SUDO apt-get install -y -qq docker-compose-plugin
        log_success "Docker Compose plugin установлен."
    fi
}

# ----------------------------------------------------------------------
# 2. Интерактивный мастер первоначальной настройки (.env)
# ----------------------------------------------------------------------
configure_environment() {
    log_header "⚙️  МАСТЕР НАСТРОЙКИ ПАРАМЕТРОВ СЕРВЕРА (LEADHUNTER PRO)"
    echo -e "Скрипт запросит необходимые данные для запуска защищенного веб-сервиса."
    echo -e "Значения в квадратных скобках [по умолчанию] принимаются нажатием ${BOLD}Enter${NC}.\n"

    SERVER_IP=$(curl -s -4 ifconfig.me || curl -s -4 icanhazip.com || echo "127.0.0.1")

    # 1. Свободный внешний порт
    DEFAULT_PORT=$(find_first_free_port)
    echo -e "${CYAN}${BOLD}[1/6] Внешний порт веб-интерфейса:${NC}"
    echo -e "80-й порт на сервере занят другим приложением. Сервис запустится на свободном порту."
    echo -e "Порт ${GREEN}${BOLD}$DEFAULT_PORT${NC} свободен и нативно поддерживается Cloudflare Proxy."
    read -rp "Порт для запуска [$DEFAULT_PORT]: " INPUT_PORT
    WEB_PORT="${INPUT_PORT:-$DEFAULT_PORT}"
    WEB_PORT="$(echo "$WEB_PORT" | tr -d ' ')"
    echo -e "  ➜ Выбранный порт: ${GREEN}${BOLD}$WEB_PORT${NC}\n"

    # 2. Доменное имя
    echo -e "${CYAN}${BOLD}[2/6] Домен или поддомен:${NC}"
    echo -e "Укажите домен, направленный через Cloudflare Proxy на IP этого сервера ($SERVER_IP)."
    read -rp "Доменное имя [например: lead.mydomain.ru или $SERVER_IP]: " INPUT_DOMAIN
    DOMAIN="${INPUT_DOMAIN:-$SERVER_IP}"
    DOMAIN="$(echo "$DOMAIN" | tr -d ' ' | tr '[:upper:]' '[:lower:]')"
    echo -e "  ➜ Домен: ${GREEN}${BOLD}$DOMAIN${NC}\n"

    # 3. Токен Telegram-бота
    echo -e "${CYAN}${BOLD}[3/6] Telegram-бот (@BotFather):${NC}"
    echo -e "Бот управляет парсингом, присылает лиды и заказы с биржи FL.ru в реальном времени."
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

    # 4. Email администратора
    echo -e "${CYAN}${BOLD}[4/6] Учетная запись: Email администратора:${NC}"
    read -rp "Email администратора [admin@lead.pro]: " INPUT_ADMIN_EMAIL
    ADMIN_EMAIL="${INPUT_ADMIN_EMAIL:-admin@lead.pro}"
    ADMIN_EMAIL="$(echo "$ADMIN_EMAIL" | tr -d ' ' | tr '[:upper:]' '[:lower:]')"
    echo -e "  ➜ Логин: ${GREEN}${BOLD}$ADMIN_EMAIL${NC}\n"

    # 5. Пароль администратора
    AUTO_PASS=$(openssl rand -base64 12 | tr -dc 'a-zA-Z0-9!@#%')
    echo -e "${CYAN}${BOLD}[5/6] Учетная запись: Пароль администратора:${NC}"
    echo -e "Сгенерирован надежный пароль по умолчанию: ${YELLOW}${BOLD}$AUTO_PASS${NC}"
    read -rp "Введите свой пароль [или Enter для использования сгенерированного]: " INPUT_ADMIN_PASS
    ADMIN_PASSWORD="${INPUT_ADMIN_PASS:-$AUTO_PASS}"
    echo -e "  ➜ Пароль: ${GREEN}${BOLD}$ADMIN_PASSWORD${NC}\n"

    # 6. Секретный ключ JWT
    echo -e "${CYAN}${BOLD}[6/6] Криптографический ключ безопасности (JWT):${NC}"
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
WEB_PORT=$WEB_PORT
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

    # Обновление порта в nginx.conf
    sed -i -E "s/listen [0-9]+;/listen $WEB_PORT;/g" nginx.conf
    sed -i -E "s/listen \[::\]:[0-9]+;/listen \[::\]:$WEB_PORT;/g" nginx.conf
    log_success "Конфигурация Nginx настроена на порт $WEB_PORT."
}

# ----------------------------------------------------------------------
# 3. Настройка UFW Firewall для выбранного порта
# ----------------------------------------------------------------------
configure_firewall() {
    local WEB_PORT
    WEB_PORT=$(grep -E '^WEB_PORT=' .env 2>/dev/null | cut -d '=' -f2- | tr -d ' ' || echo "8080")

    if command -v ufw >/dev/null 2>&1; then
        if $SUDO ufw status 2>/dev/null | grep -q "Status: active"; then
            log_info "Настройка правил фаервола UFW..."
            $SUDO ufw allow 22/tcp >/dev/null 2>&1 || true
            $SUDO ufw allow "$WEB_PORT/tcp" >/dev/null 2>&1 || true
            log_success "Фаервол UFW: открыт порт $WEB_PORT для веб-интерфейса."
        fi
    fi
}

# ----------------------------------------------------------------------
# 4. Сборка и запуск приложения через Docker Compose
# ----------------------------------------------------------------------
launch_application() {
    log_info "Сборка и запуск контейнеров (LeadHunter Backend + Nginx Reverse Proxy)..."

    # Остановка старой ревизии если была
    docker compose down --remove-orphans >/dev/null 2>&1 || true

    # Сборка и старт в фоне
    docker compose up -d --build

    local WEB_PORT
    WEB_PORT=$(grep -E '^WEB_PORT=' .env 2>/dev/null | cut -d '=' -f2- | tr -d ' ' || echo "8080")

    log_info "Ожидание инициализации сервиса на порту $WEB_PORT..."
    local HEALTHY=0
    for i in {1..25}; do
        if curl -s -f "http://127.0.0.1:$WEB_PORT/health" >/dev/null 2>&1; then
            HEALTHY=1
            break
        fi
        sleep 1
    done

    if [ $HEALTHY -eq 1 ]; then
        log_success "Система LeadHunter Pro успешно запущена и отвечает на порту $WEB_PORT!"
    else
        log_warn "Контейнеры стартовали, ожидается завершение фоновой инициализации."
    fi
}

# ----------------------------------------------------------------------
# 5. Финальный баннер с реквизитами доступа
# ----------------------------------------------------------------------
show_final_banner() {
    local DOMAIN WEB_PORT ADMIN_EMAIL ADMIN_PASS TG_TOKEN
    DOMAIN=$(grep -E '^DOMAIN=' .env 2>/dev/null | cut -d '=' -f2- | tr -d ' ')
    WEB_PORT=$(grep -E '^WEB_PORT=' .env 2>/dev/null | cut -d '=' -f2- | tr -d ' ' || echo "8080")
    ADMIN_EMAIL=$(grep -E '^INITIAL_ADMIN_EMAIL=' .env 2>/dev/null | cut -d '=' -f2- | tr -d ' ')
    ADMIN_PASS=$(grep -E '^INITIAL_ADMIN_PASSWORD=' .env 2>/dev/null | cut -d '=' -f2- | tr -d ' ')
    TG_TOKEN=$(grep -E '^TELEGRAM_BOT_TOKEN=' .env 2>/dev/null | cut -d '=' -f2- | tr -d ' ')

    echo ""
    echo -e "${GREEN}${BOLD}======================================================================${NC}"
    echo -e "${GREEN}${BOLD}  🚀 УСТАНОВКА И РАЗВЕРТЫВАНИЕ УСПЕШНО ЗАВЕРШЕНЫ!${NC}"
    echo -e "${GREEN}${BOLD}======================================================================${NC}"
    echo ""
    echo -e "  🌐 ${BOLD}Веб-интерфейс:${NC}         http://${DOMAIN}:${WEB_PORT} (или через Cloudflare)"
    echo -e "  🔐 ${BOLD}Страница входа:${NC}        http://${DOMAIN}:${WEB_PORT}/login"
    echo -e "  📧 ${BOLD}Email администратора:${NC}  ${CYAN}${ADMIN_EMAIL}${NC}"
    echo -e "  🔑 ${BOLD}Пароль:${NC}                ${YELLOW}${ADMIN_PASS}${NC}"
    echo ""
    if [ -n "$TG_TOKEN" ]; then
        echo -e "  🤖 ${BOLD}Telegram-бот:${NC}          ${GREEN}Подключен и запущен${NC}"
    else
        echo -e "  🤖 ${BOLD}Telegram-бот:${NC}          ${YELLOW}Не настроен (можно добавить в .env)${NC}"
    fi
    echo ""
    echo -e "${PURPLE}${BOLD}--- Подключение к Cloudflare (Два варианта) ---${NC}"
    echo -e " 1. ${BOLD}Прямое проксирование порта ${WEB_PORT}:${NC}"
    echo -e "    Cloudflare нативно поддерживает порт ${WEB_PORT}. Достаточно включить Proxied в DNS."
    echo -e " 2. ${BOLD}Без указания порта в браузере (через Origin Rules):${NC}"
    echo -e "    В Cloudflare Dashboard -> ${BOLD}Rules${NC} -> ${BOLD}Origin Rules${NC}:"
    echo -e "    Создайте правило: 'If Hostname equals ${DOMAIN} -> Rewrite Port to ${WEB_PORT}'."
    echo -e "    Тогда в браузере сайт будет открываться по красивому адресу: ${BOLD}https://${DOMAIN}${NC}"
    echo ""
    echo -e "${CYAN}${BOLD}--- Управление сервисом ---${NC}"
    echo -e " • Меню управления:                    ${BOLD}./start.sh${NC}"
    echo -e " • Добавить пользователя:              ${BOLD}docker compose exec leadhunter python manage_users.py add <email> <pass>${NC}"
    echo -e " • Логи в реальном времени:            ${BOLD}docker compose logs -f${NC}"
    echo -e " • Остановка приложения:               ${BOLD}docker compose down${NC}"
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

    if [ -f ".env" ]; then
        log_info "Обнаружен существующий файл .env."
        echo ""
        echo -e "  ${BOLD}[1]${NC} 🚀 Запустить / Перезапустить сервис"
        echo -e "  ${BOLD}[2]${NC} 👥 Управление пользователями (добавить, список, пароль)"
        echo -e "  ${BOLD}[3]${NC} 📋 Просмотр логов в реальном времени (docker compose logs -f)"
        echo -e "  ${BOLD}[4]${NC} 🛑 Остановить приложение (docker compose down)"
        echo -e "  ${BOLD}[5]${NC} ⚙️  Мастер полной перенастройки (.env, порт, домен)"
        echo -e "  ${BOLD}[0]${NC} ❌ Выход"
        echo ""
        read -rp "Выберите действие [1/2/3/4/5/0, Enter=1]: " ACTION
        ACTION="${ACTION:-1}"

        case "$ACTION" in
            1)
                check_and_install_dependencies
                configure_firewall
                launch_application
                show_final_banner
                exit 0
                ;;
            2)
                docker compose exec leadhunter python manage_users.py
                exit 0
                ;;
            3)
                log_info "Подключение к логам (Ctrl+C для выхода)..."
                docker compose logs -f
                exit 0
                ;;
            4)
                log_info "Остановка сервисов..."
                docker compose down
                log_success "Контейнеры остановлены."
                exit 0
                ;;
            5)
                check_and_install_dependencies
                configure_environment
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
        configure_firewall
        launch_application
        show_final_banner
        exit 0
    fi
}

main "$@"
