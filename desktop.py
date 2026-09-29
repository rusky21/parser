import os
import sys
import time
import subprocess
import urllib.request
import webbrowser
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

# Принудительная установка UTF-8 для консоли Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

PORT = 8000
SERVER_URL = f"http://127.0.0.1:{PORT}"
HEALTH_URL = f"{SERVER_URL}/health"
APP_TITLE = "🎯 LeadHunter Pro — Аудит сайтов и Лидогенератор"
ICON_PATH = str(BASE_DIR / "app_icon.ico")

def is_server_running(url: str = HEALTH_URL, timeout: float = 1.0) -> bool:
    try:
        # Обход системных прокси (VPN/прокси не должны влиять на 127.0.0.1)
        proxy_handler = urllib.request.ProxyHandler({})
        opener = urllib.request.build_opener(proxy_handler)
        req = urllib.request.Request(url, headers={"User-Agent": "LeadHunterDesktop"})
        with opener.open(req, timeout=timeout) as resp:
            return resp.status == 200
    except Exception:
        return False

def wait_for_server(proc: subprocess.Popen = None, timeout: float = 15.0) -> bool:
    start_time = time.time()
    while time.time() - start_time < timeout:
        if is_server_running():
            return True
        if proc and proc.poll() is not None:
            return False
        time.sleep(0.3)
    return False

def launch_backend_process() -> subprocess.Popen:
    """Запускает backend сервер run.py в отдельном процессе с приоритетом .venv"""
    venv_py = BASE_DIR / ".venv" / ("Scripts" if sys.platform == "win32" else "bin") / ("python.exe" if sys.platform == "win32" else "python")
    if venv_py.exists():
        python_exe = str(venv_py)
    else:
        python_exe = sys.executable
    
    run_py = str(BASE_DIR / "run.py")
    
    proc = subprocess.Popen(
        [python_exe, run_py],
        cwd=str(BASE_DIR)
    )
    return proc

def run_desktop_app():
    print("=" * 65)
    print(" 🎯 LeadHunter Pro — Запуск десктопного приложения")
    print("=" * 65)
    
    server_process = None
    if is_server_running():
        print(f" [✓] Бэкенд-сервер уже запущен на {SERVER_URL}")
    else:
        print(" [*] Инициализация локального сервера LeadHunter...")
        server_process = launch_backend_process()
        if not wait_for_server(proc=server_process, timeout=15.0):
            print("\n [!] Ошибка: Сервер не ответил за 15 секунд.")
            if server_process and server_process.poll() is not None:
                print(f" [!] Процесс сервера завершился с кодом ошибки: {server_process.poll()}")
            print(" [!] Подсказка: запустите run_backend.bat, чтобы увидеть точный текст ошибки.")
            if server_process:
                server_process.kill()
            return
        print(f" [✓] Сервер успешно запущен на {SERVER_URL}")

    print(" [*] Открытие нативного окна десктопного приложения...")

    # Попытка запустить через pywebview (нативное окно WebView2)
    pywebview_success = False
    try:
        import webview
        
        # Настройки нативного окна
        window = webview.create_window(
            title=APP_TITLE,
            url=SERVER_URL,
            width=1400,
            height=900,
            min_size=(1080, 700),
            resizable=True,
            background_color="#0B0F19",
            text_select=True,
            zoomable=True
        )

        icon_file = ICON_PATH if os.path.exists(ICON_PATH) else None
        
        # Блокирующий запуск - завершится при закрытии окна крестиком
        webview.start(
            icon=icon_file,
            private_mode=False,
            debug=False
        )
        pywebview_success = True
    except Exception as e:
        print(f" [!] PyWebView не смог запуститься ({e}). Запускаем fallback-режим...")

    # Резервный режим (если pywebview недоступен): запуск в режиме App без рамок браузера
    if not pywebview_success:
        opened = False
        import shutil

        candidate_browsers = []
        for name in ("msedge", "chrome", "google-chrome", "chromium", "chromium-browser", "brave-browser", "microsoft-edge"):
            found = shutil.which(name)
            if found:
                candidate_browsers.append(found)

        if sys.platform == "win32":
            prog_files = os.environ.get("PROGRAMFILES", r"C:\Program Files")
            prog_files_x86 = os.environ.get("PROGRAMFILES(X86)", r"C:\Program Files (x86)")
            local_app_data = os.environ.get("LOCALAPPDATA", "")

            for base_p in (prog_files, prog_files_x86, local_app_data):
                if base_p:
                    candidate_browsers.extend([
                        os.path.join(base_p, "Microsoft", "Edge", "Application", "msedge.exe"),
                        os.path.join(base_p, "Google", "Chrome", "Application", "chrome.exe"),
                    ])
        elif sys.platform == "darwin":
            mac_paths = [
                "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
                "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
                "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
            ]
            for p in mac_paths:
                if os.path.exists(p):
                    candidate_browsers.append(p)

        for browser_cmd in candidate_browsers:
            if os.path.exists(browser_cmd) or shutil.which(browser_cmd):
                try:
                    subprocess.Popen([browser_cmd, f"--app={SERVER_URL}"])
                    opened = True
                    break
                except Exception:
                    pass
        
        if not opened:
            webbrowser.open(SERVER_URL)
        
        print("\n [i] Приложение открыто в отдельном окне. Нажмите Ctrl+C для выхода.")
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            pass

    # Корректное завершение фонового сервера при закрытии окна
    if server_process:
        print("\n [*] Закрытие сервера LeadHunter Pro...")
        try:
            server_process.terminate()
            server_process.wait(timeout=3)
        except Exception:
            try:
                server_process.kill()
            except Exception:
                pass
        print(" [✓] Сервер остановлен. До свидания!")

if __name__ == "__main__":
    run_desktop_app()
