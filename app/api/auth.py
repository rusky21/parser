import os
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, Request, Response, Form, HTTPException, status
from fastapi.responses import HTMLResponse, RedirectResponse, JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.database import get_db
from app.db.models import User
from app.core.security import verify_password, create_session_token, decode_session_token
from app.core.rate_limiter import login_limiter

router = APIRouter(tags=["Authentication"])

# Флаг Secure для Cookie: True для продакшна за Cloudflare (HTTPS)
# Позволяет отключить через COOKIE_SECURE=false при локальной отладке по HTTP
COOKIE_SECURE = os.environ.get("COOKIE_SECURE", "true").lower() in ("true", "1", "yes")

@router.get("/login", response_class=HTMLResponse)
async def login_page(request: Request, returnUrl: str = "/", error: Optional[str] = None):
    """Страница входа в систему LeadHunter Pro"""
    token = request.cookies.get("access_token")
    if token and decode_session_token(token):
        return RedirectResponse(url=returnUrl or "/", status_code=status.HTTP_303_SEE_OTHER)

    error_html = ""
    if error == "invalid_credentials":
        error_html = '<div class="alert alert-error">❌ Неверный email или пароль</div>'
    elif error == "inactive":
        error_html = '<div class="alert alert-error">🚫 Учетная запись деактивирована</div>'
    elif error == "session_expired":
        error_html = '<div class="alert alert-warn">⚠️ Срок действия сессии истек. Войдите заново</div>'

    html_content = f"""<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Авторизация | LeadHunter Pro</title>
    <link rel="icon" type="image/x-icon" href="/favicon.ico">
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{
            background-color: #07090e;
            color: #f1f5f9;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            padding: 20px;
            background-image: 
                radial-gradient(circle at 50% 10%, rgba(37, 99, 235, 0.15) 0%, transparent 60%),
                radial-gradient(circle at 80% 80%, rgba(14, 165, 233, 0.08) 0%, transparent 50%);
        }}
        .card {{
            background: rgba(15, 23, 42, 0.75);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 20px;
            padding: 40px;
            width: 100%;
            max-width: 420px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.05);
        }}
        .brand {{
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 24px;
        }}
        .badge {{
            display: inline-flex;
            align-items: center;
            padding: 4px 12px;
            background: rgba(56, 189, 248, 0.1);
            color: #38bdf8;
            border: 1px solid rgba(56, 189, 248, 0.25);
            border-radius: 9999px;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.05em;
            text-transform: uppercase;
        }}
        h1 {{
            font-size: 22px;
            font-weight: 700;
            color: #ffffff;
            margin-bottom: 8px;
            letter-spacing: -0.02em;
        }}
        p.subtitle {{
            font-size: 13px;
            color: #94a3b8;
            margin-bottom: 28px;
            line-height: 1.5;
        }}
        .alert {{
            padding: 12px 14px;
            border-radius: 10px;
            font-size: 13px;
            font-weight: 500;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            gap: 8px;
        }}
        .alert-error {{
            background: rgba(239, 68, 68, 0.12);
            border: 1px solid rgba(239, 68, 68, 0.25);
            color: #f87171;
        }}
        .alert-warn {{
            background: rgba(245, 158, 11, 0.12);
            border: 1px solid rgba(245, 158, 11, 0.25);
            color: #fbbf24;
        }}
        .form-group {{
            margin-bottom: 20px;
        }}
        label {{
            display: block;
            font-size: 12px;
            font-weight: 600;
            color: #cbd5e1;
            margin-bottom: 8px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }}
        input[type="email"],
        input[type="password"] {{
            width: 100%;
            padding: 13px 16px;
            background: rgba(8, 12, 22, 0.8);
            border: 1px solid #1e293b;
            border-radius: 12px;
            color: #ffffff;
            font-size: 14px;
            outline: none;
            transition: all 0.2s ease;
        }}
        input[type="email"]:focus,
        input[type="password"]:focus {{
            border-color: #38bdf8;
            box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.15);
            background: rgba(11, 17, 32, 0.95);
        }}
        button.btn-primary {{
            width: 100%;
            padding: 13px;
            background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
            color: #ffffff;
            border: none;
            border-radius: 12px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            box-shadow: 0 4px 14px rgba(37, 99, 235, 0.35);
            transition: all 0.2s ease;
            margin-top: 6px;
        }}
        button.btn-primary:hover {{
            background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
            box-shadow: 0 6px 20px rgba(37, 99, 235, 0.45);
            transform: translateY(-1px);
        }}
        button.btn-primary:active {{
            transform: translateY(0);
        }}
        .footer-note {{
            margin-top: 24px;
            text-align: center;
            font-size: 11px;
            color: #64748b;
        }}
    </style>
</head>
<body>
    <div class="card">
        <div class="brand">
            <span class="badge">LeadHunter Core</span>
        </div>
        <h1>Вход в систему</h1>
        <p class="subtitle">Изолированный контур лидогенерации и аудита</p>

        {error_html}

        <form method="POST" action="/login">
            <input type="hidden" name="returnUrl" value="{returnUrl}">
            <div class="form-group">
                <label for="email">Электронная почта</label>
                <input type="email" id="email" name="email" required autocomplete="username" placeholder="admin@lead.pro" autofocus>
            </div>
            <div class="form-group">
                <label for="password">Пароль</label>
                <input type="password" id="password" name="password" required autocomplete="current-password" placeholder="••••••••">
            </div>
            <button type="submit" class="btn-primary">Войти в панель</button>
        </form>
        <div class="footer-note">
            Защищено Cloudflare Proxy • HTTPS TLS
        </div>
    </div>
</body>
</html>"""
    return HTMLResponse(content=html_content)

@router.post("/login")
async def login_submit(
    request: Request,
    email: str = Form(...),
    password: str = Form(...),
    returnUrl: str = Form("/"),
    db: AsyncSession = Depends(get_db)
):
    """Обработчик отправки формы входа"""
    # 1. Защита от брутфорса с учетом реального IP от Cloudflare
    login_limiter.check(request)

    # 2. Поиск пользователя в нашей БД
    clean_email = email.strip().lower()
    query = select(User).where(User.email == clean_email)
    result = await db.execute(query)
    user = result.scalar_one_or_none()

    # Проверка пароля и статуса пользователя
    if not user or not verify_password(password, user.password_hash):
        if "application/json" in request.headers.get("accept", ""):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Неверный email или пароль"
            )
        return RedirectResponse(
            url=f"/login?error=invalid_credentials&returnUrl={returnUrl}",
            status_code=status.HTTP_303_SEE_OTHER
        )

    if not user.is_active:
        if "application/json" in request.headers.get("accept", ""):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Учетная запись деактивирована"
            )
        return RedirectResponse(
            url=f"/login?error=inactive&returnUrl={returnUrl}",
            status_code=status.HTTP_303_SEE_OTHER
        )

    # 3. Фиксация времени последнего входа
    user.last_login_at = datetime.now(timezone.utc)
    await db.commit()

    # 4. Выпуск JWT токена
    token = create_session_token(user.id, user.email, user.role)

    # 5. Установка защищенной HTTP-Only Cookie
    target_url = returnUrl if (returnUrl and not returnUrl.startswith("/login")) else "/"
    response = RedirectResponse(url=target_url, status_code=status.HTTP_303_SEE_OTHER)
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
        max_age=7 * 86400,
        path="/"
    )
    return response

@router.get("/logout")
@router.post("/logout")
async def logout():
    """Выход из аккаунта и очистка Cookie"""
    response = RedirectResponse(url="/login", status_code=status.HTTP_303_SEE_OTHER)
    response.delete_cookie(key="access_token", path="/")
    return response

@router.get("/api/auth/me")
async def get_current_user_info(request: Request):
    """Получение информации о текущем пользователе (для фронтенда)"""
    user_data = getattr(request.state, "user", None)
    if not user_data:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return {
        "id": user_data.get("sub"),
        "email": user_data.get("email"),
        "role": user_data.get("role")
    }
