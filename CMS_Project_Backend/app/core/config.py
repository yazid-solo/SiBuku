# app/core/config.py

import os
from dataclasses import dataclass
from typing import List, Optional

from dotenv import load_dotenv

load_dotenv()


def _env_bool(name: str, default: bool = False) -> bool:
    v = os.getenv(name)
    if v is None:
        return default
    return v.strip().lower() in {"1", "true", "yes", "y", "on"}


def _split_csv(value: str) -> List[str]:
    return [x.strip() for x in (value or "").split(",") if x.strip()]


@dataclass(frozen=True)
class Settings:
    # App
    APP_TITLE: str = os.getenv("APP_TITLE", "CMS E-Commerce Buku")
    APP_VERSION: str = os.getenv("APP_VERSION", "1.0.0")
    APP_DESCRIPTION: str = os.getenv("APP_DESCRIPTION", "API Backend CMS Toko Buku (FastAPI + Supabase)")

    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))

    DEBUG: bool = _env_bool("DEBUG", default=False)

    # CORS
    # contoh:
    # FRONTEND_ORIGINS="*"
    # FRONTEND_ORIGINS="https://domain.com,http://localhost:5173"
    FRONTEND_ORIGINS_RAW: str = os.getenv("FRONTEND_ORIGINS", "*").strip()

    # Auth/JWT
    SECRET_KEY: Optional[str] = os.getenv("SECRET_KEY")
    ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "120"))


    # Supabase
    SUPABASE_URL: Optional[str] = os.getenv("SUPABASE_URL")
    SUPABASE_ANON_KEY: Optional[str] = os.getenv("SUPABASE_ANON_KEY")
    SUPABASE_SERVICE_ROLE_KEY: Optional[str] = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    # Storage
    SUPABASE_STORAGE_BUCKET: str = os.getenv("SUPABASE_STORAGE_BUCKET", "book-covers")

    @property
    def FRONTEND_ORIGINS(self) -> List[str]:
        """
        Return list origins yang siap dipakai CORSMiddleware.
        - kalau "*" => ["*"]
        - kalau csv => ["https://...", "http://..."]
        """
        if self.FRONTEND_ORIGINS_RAW in {"", "*"}:
            return ["*"]
        return _split_csv(self.FRONTEND_ORIGINS_RAW)

    def validate(self) -> None:
        """
        Validasi minimal agar startup fail-fast.
        """
        if not self.SUPABASE_URL:
            raise RuntimeError("SUPABASE_URL belum diisi di .env")
        if not (self.SUPABASE_SERVICE_ROLE_KEY or self.SUPABASE_ANON_KEY):
            raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY belum diisi di .env")

        # SECRET_KEY wajib kalau kamu pakai JWT auth
        # kalau kamu mau opsional, boleh hapus blok ini.
        if not self.SECRET_KEY:
            raise RuntimeError("SECRET_KEY belum diisi di .env (dibutuhkan untuk JWT)")


settings = Settings()
settings.validate()
