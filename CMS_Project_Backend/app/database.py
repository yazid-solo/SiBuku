# app/database.py

import logging
from functools import lru_cache
from typing import Optional

from supabase import Client, create_client

from app.core.config import settings

logger = logging.getLogger(__name__)


@lru_cache(maxsize=4)
def _make_client(url: str, key: str) -> Client:
    return create_client(url, key)


def _pick_key(prefer_service: bool = True) -> str:
    """
    Default: backend pakai service_role (kalau ada) karena:
    - admin endpoints (upload storage/import) biasanya butuh hak lebih.
    - lebih stabil dibanding anon kalau RLS ketat.
    """
    if prefer_service and settings.SUPABASE_SERVICE_ROLE_KEY:
        return settings.SUPABASE_SERVICE_ROLE_KEY
    if settings.SUPABASE_ANON_KEY:
        return settings.SUPABASE_ANON_KEY
    # harusnya tidak terjadi karena settings.validate()
    return ""


def _require(name: str, value: Optional[str]) -> str:
    if not value:
        raise RuntimeError(f"❌ ERROR DATABASE: {name} belum lengkap di .env")
    return value


SUPABASE_URL = _require("SUPABASE_URL", settings.SUPABASE_URL)

# Client untuk operasi admin/server (service_role jika ada)
SUPABASE_ADMIN_KEY = _pick_key(prefer_service=True)
supabase_admin: Client = _make_client(SUPABASE_URL, SUPABASE_ADMIN_KEY)

# Client public (anon) — berguna kalau nanti kamu mau pisahin akses
SUPABASE_ANON_KEY = settings.SUPABASE_ANON_KEY
supabase_public: Client = _make_client(SUPABASE_URL, SUPABASE_ANON_KEY) if SUPABASE_ANON_KEY else supabase_admin

# Backward-compatible: router kamu sekarang import `supabase`
# Jadi kita set default supabase = admin client
supabase: Client = supabase_admin

if settings.DEBUG:
    logger.info("✅ Supabase client ready. Using service_role=%s", bool(settings.SUPABASE_SERVICE_ROLE_KEY))
