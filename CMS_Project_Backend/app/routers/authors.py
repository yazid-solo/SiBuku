from typing import Optional

from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel, Field

from app.database import supabase
from app.dependencies import get_current_admin

router = APIRouter(prefix="/authors", tags=["Authors"])


class AuthorUpsert(BaseModel):
    nama_penulis: str = Field(..., min_length=1)
    biografi: Optional[str] = None
    foto_penulis: Optional[str] = None


@router.get("/")
def list_authors(q: Optional[str] = None):
    try:
        query = supabase.table("penulis").select("*")
        if q and q.strip():
            query = query.ilike("nama_penulis", f"%{q.strip()}%")
        res = query.order("nama_penulis").execute()
        return res.data or []
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{author_id}")
def author_detail(author_id: int):
    try:
        res = supabase.table("penulis").select("*").eq("id_penulis", author_id).limit(1).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Penulis tidak ditemukan")
        return res.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ✅ CRUD hanya admin (lebih profesional & aman)
@router.post("/", status_code=status.HTTP_201_CREATED)
def create_author(payload: AuthorUpsert, admin: dict = Depends(get_current_admin)):
    try:
        res = supabase.table("penulis").insert(payload.dict(exclude_unset=True)).execute()
        if not res.data:
            raise HTTPException(status_code=500, detail="Gagal membuat penulis")
        return {"message": "Penulis berhasil dibuat", "data": res.data[0]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{author_id}")
def update_author(author_id: int, payload: AuthorUpsert, admin: dict = Depends(get_current_admin)):
    try:
        res = supabase.table("penulis").update(payload.dict(exclude_unset=True)).eq("id_penulis", author_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Penulis tidak ditemukan")
        return {"message": "Penulis berhasil diupdate", "data": res.data[0]}
    except HTTPException:
        raise
    except Exception as e:
        # kalau ada FK dari buku → bisa gagal delete/update tertentu tergantung constraint
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{author_id}")
def delete_author(author_id: int, admin: dict = Depends(get_current_admin)):
    try:
        res = supabase.table("penulis").delete().eq("id_penulis", author_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Penulis tidak ditemukan")
        return {"message": "Penulis berhasil dihapus"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Gagal hapus (mungkin masih dipakai buku): {str(e)}")
