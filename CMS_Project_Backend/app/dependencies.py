# app/dependencies.py

from __future__ import annotations

import os
from typing import Any, Dict, Iterable, Optional, Tuple

from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from app.database import supabase

load_dotenv()

security = HTTPBearer(auto_error=False)


def sanitize_user(user: Optional[dict]) -> Optional[dict]:
    if not user:
        return user
    safe = dict(user)
    safe.pop("password", None)
    return safe


def _get_jwt_config() -> Tuple[Optional[str], str]:
    try:
        from app.core.config import settings  # type: ignore
        secret = getattr(settings, "SECRET_KEY", None)
        algo = getattr(settings, "ALGORITHM", None) or "HS256"
        if secret:
            return secret, algo
    except Exception:
        pass

    return os.getenv("SECRET_KEY"), os.getenv("ALGORITHM", "HS256")


SECRET_KEY, ALGORITHM = _get_jwt_config()


def _decode_token(token: str) -> Dict[str, Any]:
    if not SECRET_KEY:
        raise HTTPException(status_code=500, detail="Konfigurasi server error: SECRET_KEY belum diset")
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token tidak valid atau kadaluarsa",
            headers={"WWW-Authenticate": "Bearer"},
        )


def _extract_identity(payload: Dict[str, Any]) -> Tuple[Optional[int], Optional[str]]:
    id_user = payload.get("id_user") or payload.get("user_id") or payload.get("uid")
    if id_user is not None:
        try:
            return int(id_user), None
        except Exception:
            pass

    email = payload.get("sub") or payload.get("email")
    if isinstance(email, str) and email.strip():
        return None, email.strip().lower()

    return None, None


def _token_from_cookie(request: Request) -> Optional[str]:
    # kalau kamu punya nama cookie token sendiri, set di env TOKEN_COOKIE
    preferred = os.getenv("TOKEN_COOKIE", "").strip()
    candidates = [preferred, "token", "access_token", "sibuku_token", "auth_token"]
    for name in candidates:
        if not name:
            continue
        v = request.cookies.get(name)
        if v and isinstance(v, str) and v.strip():
            return v.strip()
    return None


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    """
    - Prioritas token: Authorization Bearer
    - Fallback: cookie token
    """
    token = None
    if credentials is not None and credentials.credentials:
        token = credentials.credentials

    if not token:
        token = _token_from_cookie(request)

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token tidak ada",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = _decode_token(token)
    id_user, email = _extract_identity(payload)

    try:
        q = supabase.table("users").select("*")
        if id_user is not None:
            q = q.eq("id_user", id_user)
        elif email is not None:
            q = q.eq("email", email)
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token tidak valid atau kadaluarsa",
                headers={"WWW-Authenticate": "Bearer"},
            )

        user_res = q.limit(1).execute()
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Gagal memverifikasi user")

    if not user_res.data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token tidak valid atau kadaluarsa",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = user_res.data[0]

    if user.get("is_active") is False:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Akun dinonaktifkan. Hubungi admin.",
        )

    return user


def _role_in(user: dict, roles: Iterable[str]) -> bool:
    role = str(user.get("role") or "customer").lower().strip()
    allow = {r.lower().strip() for r in roles}
    return role in allow


async def get_current_admin(user: dict = Depends(get_current_user)) -> dict:
    if not _role_in(user, ("admin",)):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Akses ditolak: khusus Admin.")
    return user


async def get_current_staff(user: dict = Depends(get_current_user)) -> dict:
    if not _role_in(user, ("admin", "seller")):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Akses ditolak: khusus Seller/Admin.")
    return user
