import os
import sys
import webbrowser
import asyncio

# Принудительная установка UTF-8 для консоли Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

CYAN = "\033[96m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
BOLD = "\033[1m"
RESET = "\033[0m"

def show_menu():
    os.system("cls" if os.name == "nt" else "clear")
    print(f"{CYAN}{BOLD}======================================================================{RESET}")
    print(f"{CYAN}{BOLD}          🎯 LEADHUNTER PRO — ПАРСЕР, АУДИТОР И ЛИДОГЕНЕРАТОР         {RESET}")
    print(f"{CYAN}{BOLD}======================================================================{RESET}")
    print("")
    print(f"  {BOLD}[1]{RESET} 🖥️  Запустить ДЕСКТОП-ПРИЛОЖЕНИЕ (Нативное окно Windows, рекомендуется)")
    print(f"  {BOLD}[2]{RESET} 🌐  Запустить в БРАУЗЕРЕ (Веб-интерфейс http://localhost:8000)")
    print(f"  {BOLD}[3]{RESET} ⚡  Запустить парсинг в КОНСОЛИ (Интерактивный CLI + Excel)")
    print(f"  {BOLD}[4]{RESET} 📖  Открыть Swagger UI документацию (API Docs)")
    print(f"  {BOLD}[0]{RESET} ❌  Выход")
    print("")
    print(f"{CYAN}{BOLD}======================================================================{RESET}")

def main():
    while True:
        show_menu()
        choice = input(f"{BOLD}Выберите режим [1/2/3/4/0, Enter=1]: {RESET}").strip()
        
        if choice in ("", "1"):
            import desktop
            desktop.run_desktop_app()
            input(f"\n{BOLD}Нажмите Enter для возврата в меню...{RESET}")
        elif choice == "2":
            os.system("cls" if os.name == "nt" else "clear")
            print(f"{GREEN}{BOLD}Запуск веб-приложения LeadHunter в браузере...{RESET}")
            print("Адрес веб-интерфейса: http://localhost:8000")
            print("Swagger документация: http://localhost:8000/docs")
            print("Остановка: нажмите Ctrl + C\n")
            webbrowser.open("http://localhost:8000")
            import uvicorn
            uvicorn.run(
                "app.main:app",
                host="0.0.0.0",
                port=8000,
                reload=False,
                loop="asyncio.windows_events:ProactorEventLoop" if sys.platform == "win32" else "auto"
            )
            input(f"\n{BOLD}Нажмите Enter для возврата в меню...{RESET}")
        elif choice == "3":
            import cli
            asyncio.run(cli.run_cli())
        elif choice == "4":
            os.system("cls" if os.name == "nt" else "clear")
            print(f"{GREEN}{BOLD}Запуск Swagger UI документации...{RESET}\n")
            webbrowser.open("http://localhost:8000/docs")
            import uvicorn
            uvicorn.run(
                "app.main:app",
                host="0.0.0.0",
                port=8000,
                reload=False,
                loop="asyncio.windows_events:ProactorEventLoop" if sys.platform == "win32" else "auto"
            )
            input(f"\n{BOLD}Нажмите Enter для возврата в меню...{RESET}")

        elif choice == "0":
            print("До свидания!")
            sys.exit(0)
        else:
            print("Неверный выбор, попробуйте снова...")

if __name__ == "__main__":
    main()
