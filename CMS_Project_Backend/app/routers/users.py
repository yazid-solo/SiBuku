# app/routers/users.py

import os
import uuid
from fastapi import UploadFile, File 
from datetime import datetime,timezone   
from typing import Optional, Literal

from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from app.database import supabase
from app.dependencies import get_current_user, sanitize_user
from app.schemas import UserResponse

load_dotenv()

router = APIRouter(prefix="/users", tags=["Users"])


# ===========================
# AVATAR SETTINGS
# ===========================
AVATAR_BUCKET = (os.getenv("SUPABASE_STORAGE_BUCKET") or "avatars").strip() or "avatars"
MAX_AVATAR_BYTES = int(os.getenv("MAX_AVATAR_BYTES", "2097152"))  # default 2MB

ALLOWED_AVATAR_MIME = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}

def _pick_public_url(bucket: str, path: str) -> str:
    """
    Supabase python client kadang return string, kadang dict.
    Kita normalisasi biar aman.
    """
    u = supabase.storage.from_(bucket).get_public_url(path)
    if isinstance(u, str):
        return u
    if isinstance(u, dict):
        return (
            u.get("publicUrl")
            or u.get("publicURL")
            or u.get("data", {}).get("publicUrl")
            or u.get("data", {}).get("publicURL")
            or ""
        )
    return ""

def _storage_upload(bucket: str, path: str, content: bytes, content_type: str):
    """
    Kompatibilitas beberapa versi supabase-py:
    ada yang pakai argumen 'file_options', ada yang langsung dict.
    """
    storage = supabase.storage.from_(bucket)
    try:
        return storage.upload(path, content, file_options={"content-type": content_type, "upsert": "true"})
    except TypeError:
        # fallback signature lama
        return storage.upload(path, content, {"content-type": content_type, "upsert": "true"})


# ===========================
# SCHEMAS
# ===========================
class UserUpdatePayload(BaseModel):
    nama: Optional[str] = Field(default=None, min_length=2, max_length=100)
    no_hp: Optional[str] = Field(default=None, min_length=8, max_length=20)
    alamat: Optional[str] = Field(default=None, min_length=3, max_length=255)


class ProfileUpdateResponse(BaseModel):
    message: str
    data: UserResponse


class RoleUpgradePayload(BaseModel):
    # tetap kamu pakai (upgrade via invite code)
    role: str = Field(..., description="Pilih: seller atau admin")
    invite_code: str = Field(..., min_length=3)


class RoleUpdatePayload(BaseModel):
    """
    Dipakai oleh tombol 'Aktifkan Mode Jual' (PATCH /users/role).
    - Jika role dikirim: set role.
    - Jika role kosong/null: toggle otomatis customer <-> admin.
    """
    role: Optional[Literal["customer", "admin", "user", "seller", "buyer"]] = None


class RoleUpdateResponse(BaseModel):
    message: str
    data: UserResponse


# ===========================
# 1) CUSTOMER: PROFIL SAYA
# ===========================
@router.get("/profile", response_model=UserResponse)
def get_my_profile(current_user: dict = Depends(get_current_user)):
    try:
        res = (
            supabase.table("users")
            .select("*")
            .eq("id_user", int(current_user["id_user"]))
            .limit(1)
            .execute()
        )
        if not res.data:
            raise HTTPException(status_code=404, detail="User tidak ditemukan")
        return sanitize_user(res.data[0])
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Gagal mengambil profil")


@router.patch("/profile", response_model=ProfileUpdateResponse)
def update_my_profile(payload: UserUpdatePayload, current_user: dict = Depends(get_current_user)):
    user_id = int(current_user["id_user"])
    update_payload = payload.dict(exclude_none=True)

    if not update_payload:
        raise HTTPException(status_code=400, detail="Tidak ada data yang diupdate")

    for k, v in list(update_payload.items()):
        if isinstance(v, str):
            v2 = v.strip()
            if not v2:
                raise HTTPException(status_code=400, detail=f"{k} tidak boleh kosong")
            update_payload[k] = v2

    try:
        res = supabase.table("users").update(update_payload).eq("id_user", user_id).execute()
        if not res.data:
            # fallback fetch (kadang update return kosong di beberapa setup)
            fresh = (
                supabase.table("users")
                .select("*")
                .eq("id_user", user_id)
                .limit(1)
                .execute()
            )
            if not fresh.data:
                raise HTTPException(status_code=404, detail="User tidak ditemukan")
            return {"message": "Profil berhasil diperbarui", "data": sanitize_user(fresh.data[0])}

        return {"message": "Profil berhasil diperbarui", "data": sanitize_user(res.data[0])}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Gagal update profil")


# ===========================
# 1b) CUSTOMER: UPLOAD AVATAR
# ===========================
@router.post("/profile/avatar", response_model=ProfileUpdateResponse)
async def upload_my_avatar(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    user_id = int(current_user["id_user"])

    # validasi type & size (pakai konstanta)
    ct = (file.content_type or "").lower()
    allowed = set(ALLOWED_AVATAR_MIME.keys())
    if ct not in allowed:
        raise HTTPException(status_code=415, detail="File harus JPG/PNG/WEBP")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="File kosong")
    if len(content) > MAX_AVATAR_BYTES:
        raise HTTPException(status_code=413, detail=f"Maksimal ukuran file {MAX_AVATAR_BYTES} bytes")

    ext = ALLOWED_AVATAR_MIME.get(ct, ".jpg")
    path = f"user-{user_id}/{uuid.uuid4().hex}{ext}"

    try:
        # upload ke bucket avatars (pakai konstanta)
        supabase.storage.from_(AVATAR_BUCKET).upload(
            path,
            content,
            {
                "content-type": ct,
                "upsert": "true",
            },
        )

        pub = supabase.storage.from_(AVATAR_BUCKET).get_public_url(path)
        avatar_url = ""
        if isinstance(pub, dict):
            avatar_url = pub.get("publicUrl") or pub.get("public_url") or ""
        else:
            avatar_url = str(pub or "")

        if not avatar_url:
            raise HTTPException(status_code=500, detail="Gagal membuat public URL avatar")

        res = (
            supabase.table("users")
            .update(
                {
                    "avatar_url": avatar_url,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
            )
            .eq("id_user", user_id)
            .execute()
        )

        if not res.data:
            fresh = (
                supabase.table("users")
                .select("*")
                .eq("id_user", user_id)
                .limit(1)
                .execute()
            )
            if not fresh.data:
                raise HTTPException(status_code=404, detail="User tidak ditemukan")
            return {"message": "Avatar berhasil diupload", "data": sanitize_user(fresh.data[0])}

        return {"message": "Avatar berhasil diupload", "data": sanitize_user(res.data[0])}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal upload avatar: {str(e)}")


@router.delete("/profile/avatar", response_model=ProfileUpdateResponse)
def delete_my_avatar(current_user: dict = Depends(get_current_user)):
    user_id = int(current_user["id_user"])
    try:
        res = (
            supabase.table("users")
            .update({"avatar_url": None, "updated_at": datetime.now(timezone.utc).isoformat()})
            .eq("id_user", user_id)
            .execute()
        )
        fresh = (
            supabase.table("users")
            .select("*")
            .eq("id_user", user_id)
            .limit(1)
            .execute()
        )
        if not fresh.data:
            raise HTTPException(status_code=404, detail="User tidak ditemukan")
        return {"message": "Avatar dihapus", "data": sanitize_user(fresh.data[0])}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal hapus avatar: {str(e)}")


# ===========================
# 2) ROLE: UPGRADE / DOWNGRADE (invite code + manual)
# ===========================
@router.post("/role/upgrade", response_model=RoleUpdateResponse)
def upgrade_role(payload: RoleUpgradePayload, current_user: dict = Depends(get_current_user)):
    """
    User bisa jadi seller/admin dengan invite code.
    - ADMIN_INVITE_CODE untuk admin
    - SELLER_INVITE_CODE untuk seller

    Catatan:
    Karena frontend kamu cek admin via 'role=admin',
    maka role 'seller' akan kita mapping ke 'admin' agar tombol mode jual nyambung.
    """
    user_id = int(current_user["id_user"])
    role_in = (payload.role or "").lower().strip()

    if role_in not in ("seller", "admin"):
        raise HTTPException(status_code=400, detail="role harus seller atau admin")

    admin_code = os.getenv("ADMIN_INVITE_CODE", "").strip()
    seller_code = os.getenv("SELLER_INVITE_CODE", "").strip()

    expected = admin_code if role_in == "admin" else seller_code
    if not expected:
        raise HTTPException(status_code=500, detail="Server belum set invite code untuk role ini")

    if payload.invite_code.strip() != expected:
        raise HTTPException(status_code=403, detail="Invite code salah")

    # ✅ mapping seller -> admin (biar sesuai UI + auth admin)
    target_role = "admin" if role_in in ("seller", "admin") else "customer"

    try:
        res = supabase.table("users").update({"role": target_role}).eq("id_user", user_id).execute()
        if not res.data:
            fresh = (
                supabase.table("users")
                .select("*")
                .eq("id_user", user_id)
                .limit(1)
                .execute()
            )
            if not fresh.data:
                raise HTTPException(status_code=404, detail="User tidak ditemukan")
            return {"message": "Role berhasil diubah", "data": sanitize_user(fresh.data[0])}

        return {"message": "Role berhasil diubah", "data": sanitize_user(res.data[0])}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Gagal mengubah role")


@router.post("/role/downgrade", response_model=RoleUpdateResponse)
def downgrade_role(current_user: dict = Depends(get_current_user)):
    """Turunkan role kembali jadi customer."""
    user_id = int(current_user["id_user"])
    try:
        res = supabase.table("users").update({"role": "customer"}).eq("id_user", user_id).execute()
        if not res.data:
            fresh = (
                supabase.table("users")
                .select("*")
                .eq("id_user", user_id)
                .limit(1)
                .execute()
            )
            if not fresh.data:
                raise HTTPException(status_code=404, detail="User tidak ditemukan")
            return {"message": "Role dikembalikan ke customer", "data": sanitize_user(fresh.data[0])}

        return {"message": "Role dikembalikan ke customer", "data": sanitize_user(res.data[0])}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Gagal downgrade role")


# ===========================
# 3) ROLE: TOGGLE / SET (dipakai tombol Mode Jual)
# ===========================
@router.patch("/role", response_model=RoleUpdateResponse)
def update_my_role(payload: RoleUpdatePayload, current_user: dict = Depends(get_current_user)):
    """
    Fix utama:
    - JANGAN chain .select() setelah .eq() (itu yang bikin error SyncFilterRequestBuilder)
    - Update dulu, lalu SELECT terpisah kalau data kosong.
    """
    user_id = int(current_user["id_user"])
    current_role = str(current_user.get("role") or "customer").lower().strip()

    req_role = (payload.role or "").lower().strip() if payload.role else ""

    alias = {
        "user": "customer",
        "buyer": "customer",
        "seller": "admin",
    }

    if req_role:
        target_role = alias.get(req_role, req_role)
    else:
        # toggle otomatis
        target_role = "customer" if current_role == "admin" else "admin"

    if target_role not in ("customer", "admin"):
        raise HTTPException(status_code=422, detail="role harus 'customer' atau 'admin'")

    try:
        # ✅ FIX: tanpa .select() setelah .eq()
        res = (
            supabase.table("users")
            .update({"role": target_role})
            .eq("id_user", user_id)
            .execute()
        )

        if not res.data:
            fresh = (
                supabase.table("users")
                .select("*")
                .eq("id_user", user_id)
                .limit(1)
                .execute()
            )
            if not fresh.data:
                raise HTTPException(status_code=404, detail="User tidak ditemukan")
            user_row = fresh.data[0]
        else:
            user_row = res.data[0]

        return {"message": f"Role berhasil diubah menjadi {target_role}", "data": sanitize_user(user_row)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e) or "Gagal mengubah role")


# ===========================
# 4) ME (fresh dari DB biar role langsung update di header)
# ===========================
@router.get("/me", response_model=UserResponse)
def me(current_user: dict = Depends(get_current_user)):
    """
    Praktis untuk frontend: cek role terbaru dari DB (fresh).
    """
    user_id = int(current_user["id_user"])
    try:
        res = (
            supabase.table("users")
            .select("*")
            .eq("id_user", user_id)
            .limit(1)
            .execute()
        )
        if not res.data:
            # fallback ke current_user kalau DB gak balik data
            return sanitize_user(current_user)
        return sanitize_user(res.data[0])
    except Exception:
        return sanitize_user(current_user)
