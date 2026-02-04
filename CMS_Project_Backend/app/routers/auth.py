# app/routers/auth.py

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException, status, Depends
from jose import jwt
from passlib.context import CryptContext

from app.core.config import settings
from app.database import supabase
from app.schemas import LoginRequest, RegisterRequest, TokenResponse
from app.dependencies import get_current_user, sanitize_user

router = APIRouter(prefix="/auth", tags=["Auth"])
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ACCESS_TOKEN_EXPIRES_MINUTES = int(
    (getattr(settings, "ACCESS_TOKEN_EXPIRES_MINUTES", None) or 120)
)


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _to_dict(model: Any) -> Dict[str, Any]:
    # pydantic v2: model_dump; v1: dict
    if hasattr(model, "model_dump"):
        return model.model_dump()
    return model.dict()


def _normalize_email(email: str) -> str:
    return (email or "").strip().lower()


def _clean_optional_str(v: Optional[str]) -> Optional[str]:
    if v is None:
        return None
    s = str(v).strip()
    return s if s else None


def _create_access_token(*, id_user: int, email: str, role: str, expires_minutes: int) -> str:
    if not settings.SECRET_KEY:
        raise RuntimeError("SECRET_KEY belum diset")

    now = _now_utc()
    payload = {
        "id_user": int(id_user),
        "sub": _normalize_email(email),
        "role": (role or "customer"),
        "iat": int(now.timestamp()),
        "jti": str(uuid.uuid4()),
        "exp": int((now + timedelta(minutes=expires_minutes)).timestamp()),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(user: RegisterRequest):
    email = _normalize_email(user.email)
    nama = (user.nama or "").strip()

    # validasi ringan (biar aman & rapi)
    if len(nama) < 2:
        raise HTTPException(status_code=422, detail="Nama minimal 2 karakter")
    if not user.password or len(user.password) < 6:
        raise HTTPException(status_code=422, detail="Password minimal 6 karakter")

    no_hp = _clean_optional_str(getattr(user, "no_hp", None))
    alamat = _clean_optional_str(getattr(user, "alamat", None))

    # Cek duplikasi email
    existing = supabase.table("users").select("id_user").eq("email", email).limit(1).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="Email sudah terdaftar")

    hashed_password = pwd_context.hash(user.password)

    user_data = _to_dict(user)
    user_data["nama"] = nama
    user_data["email"] = email
    user_data["password"] = hashed_password

    # rapihin optional field
    user_data["no_hp"] = no_hp
    user_data["alamat"] = alamat

    # Paksa role customer (anti register jadi admin)
    user_data["role"] = "customer"
    user_data["is_active"] = True

    try:
        supabase.table("users").insert(user_data).execute()
        return {"message": "Registrasi berhasil, silakan login"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal register: {str(e)}")


@router.post("/login", response_model=TokenResponse)
async def login(creds: LoginRequest):
    email = _normalize_email(creds.email)

    res = supabase.table("users").select("*").eq("email", email).limit(1).execute()
    user = res.data[0] if res.data else None

    if not user:
        raise HTTPException(status_code=401, detail="Email atau Password salah")

    if user.get("is_active") is False:
        raise HTTPException(status_code=403, detail="Akun dinonaktifkan. Hubungi admin.")

    # verify password dengan aman
    try:
        ok = pwd_context.verify(creds.password, user.get("password") or "")
    except Exception:
        ok = False

    if not ok:
        raise HTTPException(status_code=401, detail="Email atau Password salah")

    # Update last_login (jangan gagalkan login kalau gagal)
    try:
        supabase.table("users").update({"last_login": _now_utc().isoformat()}).eq("id_user", user["id_user"]).execute()
    except Exception:
        pass

    token = _create_access_token(
        id_user=int(user["id_user"]),
        email=user["email"],
        role=user.get("role", "customer"),
        expires_minutes=ACCESS_TOKEN_EXPIRES_MINUTES,
    )

    # TokenResponse.AuthUser punya alias id_user <- "id"
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": int(user["id_user"]),
            "nama": user["nama"],
            "email": user["email"],
            "role": user.get("role", "customer"),
        },
    }


@router.get("/me")
def me(current_user: dict = Depends(get_current_user)):
    """
    Frontend pakai ini untuk cek sesi login dan role.
    """
    return sanitize_user(current_user)