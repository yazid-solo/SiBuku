# app/routers/books.py

from datetime import datetime, timezone
from typing import List, Optional, Set

from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel

from app.database import supabase
from app.dependencies import get_current_admin
from app.schemas import (
    BookCreate,
    BookUpdate,
    BookResponse,
    GenreResponse,
    PaymentMethodResponse,
)

router = APIRouter()


# ===========================
# RESPONSE MODELS (Swagger rapi)
# ===========================
class PagingMeta(BaseModel):
    page: int
    limit: int
    total: int
    total_pages: int
    sort_by: str
    order: str


class BooksPagedResponse(BaseModel):
    meta: PagingMeta
    data: List[BookResponse]


# ===========================
# HELPERS
# ===========================
def _now_utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _sanitize_paging(page: int, limit: int, max_limit: int = 100):
    if page < 1:
        page = 1
    if limit < 1:
        limit = 20
    if limit > max_limit:
        limit = max_limit
    start = (page - 1) * limit
    end = start + limit - 1
    return page, limit, start, end


def _sanitize_sort(sort_by: str, order: str, allowed: Set[str], default_sort: str):
    if sort_by not in allowed:
        sort_by = default_sort
    order = (order or "desc").lower()
    if order not in ("asc", "desc"):
        order = "desc"
    return sort_by, order


def _validate_status(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    v = value.lower().strip()
    if v not in ("aktif", "nonaktif"):
        raise HTTPException(status_code=400, detail="status harus 'aktif' atau 'nonaktif'")
    return v


def _validate_non_negative_int(name: str, value: Optional[int]):
    if value is None:
        return
    if int(value) < 0:
        raise HTTPException(status_code=400, detail=f"{name} tidak boleh negatif")


def _validate_non_negative_number(name: str, value: Optional[float]):
    if value is None:
        return
    if float(value) < 0:
        raise HTTPException(status_code=400, detail=f"{name} tidak boleh negatif")


def _map_db_error(e: Exception) -> HTTPException:
    msg = str(e).lower()

    if "duplicate" in msg and "isbn" in msg:
        return HTTPException(status_code=400, detail="ISBN sudah digunakan")

    if "foreign key" in msg:
        return HTTPException(status_code=400, detail="ID Genre atau ID Penulis tidak valid")

    return HTTPException(status_code=500, detail=str(e))


# ==========================================
# 1) PUBLIC ENDPOINTS (Katalog)
# ==========================================
@router.get("/books", tags=["Books"], response_model=List[BookResponse])
def get_all_books(search: Optional[str] = None, genre_id: Optional[int] = None):
    try:
        q = supabase.table("buku").select("*, penulis(*), genre(*)").eq("status", "aktif")

        if search and search.strip():
            q = q.ilike("judul", f"%{search.strip()}%")

        if genre_id:
            q = q.eq("id_genre", genre_id)

        res = q.order("created_at", desc=True).execute()
        return res.data or []
    except Exception as e:
        raise _map_db_error(e)


@router.get("/books/paged", tags=["Books"], response_model=BooksPagedResponse)
def get_all_books_paged(
    search: Optional[str] = None,
    genre_id: Optional[int] = None,
    page: int = 1,
    limit: int = 20,
    sort_by: str = "created_at",
    order: str = "desc",
):
    try:
        page, limit, start, end = _sanitize_paging(page, limit, max_limit=100)
        sort_by, order = _sanitize_sort(
            sort_by,
            order,
            allowed={"id_buku", "judul", "harga", "stok", "created_at"},
            default_sort="created_at",
        )

        count_q = supabase.table("buku").select("id_buku", count="exact").eq("status", "aktif")
        data_q = supabase.table("buku").select("*, penulis(*), genre(*)").eq("status", "aktif")

        if search and search.strip():
            s = search.strip()
            count_q = count_q.ilike("judul", f"%{s}%")
            data_q = data_q.ilike("judul", f"%{s}%")

        if genre_id:
            count_q = count_q.eq("id_genre", genre_id)
            data_q = data_q.eq("id_genre", genre_id)

        total = (count_q.execute().count) or 0
        data_res = data_q.order(sort_by, desc=(order == "desc")).range(start, end).execute()

        return {
            "meta": {
                "page": page,
                "limit": limit,
                "total": total,
                "total_pages": (total + limit - 1) // limit if limit else 0,
                "sort_by": sort_by,
                "order": order,
            },
            "data": data_res.data or [],
        }
    except Exception as e:
        raise _map_db_error(e)


@router.get("/books/{book_id}", tags=["Books"], response_model=BookResponse)
def get_book_detail(book_id: int):
    try:
        res = (
            supabase.table("buku")
            .select("*, penulis(*), genre(*)")
            .eq("id_buku", book_id)
            .eq("status", "aktif")
            .limit(1)
            .execute()
        )
        if not res.data:
            raise HTTPException(status_code=404, detail="Buku tidak ditemukan")
        return res.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise _map_db_error(e)


# ==========================================
# 2) MASTER DATA (Dropdown Frontend)
# ==========================================
@router.get("/genres", tags=["Books"], response_model=List[GenreResponse])
def get_all_genres():
    try:
        res = supabase.table("genre").select("*").order("nama_genre").execute()
        return res.data or []
    except Exception as e:
        raise _map_db_error(e)


@router.get("/payment-methods", tags=["Books"], response_model=List[PaymentMethodResponse])
def get_payment_methods():
    try:
        res = supabase.table("jenis_pembayaran").select("*").eq("is_active", True).order("id_jenis_pembayaran").execute()
        return res.data or []
    except Exception as e:
        raise _map_db_error(e)


# ==========================================
# 3) ADMIN ENDPOINTS (CMS BOOKS)
# ==========================================
@router.get("/admin/books", tags=["Admin - Books"], response_model=List[BookResponse])
def admin_list_books(
    status_filter: Optional[str] = None,
    search: Optional[str] = None,
    genre_id: Optional[int] = None,
    admin: dict = Depends(get_current_admin),
):
    try:
        q = supabase.table("buku").select("*, penulis(*), genre(*)")

        if status_filter:
            q = q.eq("status", _validate_status(status_filter))

        if search and search.strip():
            q = q.ilike("judul", f"%{search.strip()}%")

        if genre_id:
            q = q.eq("id_genre", genre_id)

        res = q.order("id_buku", desc=True).execute()
        return res.data or []
    except HTTPException:
        raise
    except Exception as e:
        raise _map_db_error(e)


@router.get("/admin/books/paged", tags=["Admin - Books"], response_model=BooksPagedResponse)
def admin_list_books_paged(
    page: int = 1,
    limit: int = 20,
    q: Optional[str] = None,
    id_genre: Optional[int] = None,
    id_penulis: Optional[int] = None,
    status_filter: Optional[str] = None,
    sort_by: str = "created_at",
    order: str = "desc",
    admin: dict = Depends(get_current_admin),
):
    try:
        page, limit, start, end = _sanitize_paging(page, limit, max_limit=100)
        sort_by, order = _sanitize_sort(
            sort_by,
            order,
            allowed={"id_buku", "judul", "harga", "stok", "status", "created_at", "updated_at"},
            default_sort="created_at",
        )

        status_ok = _validate_status(status_filter) if status_filter else None

        count_q = supabase.table("buku").select("id_buku", count="exact")
        data_q = supabase.table("buku").select("*, penulis(*), genre(*)")

        if q and q.strip():
            s = q.strip()
            count_q = count_q.ilike("judul", f"%{s}%")
            data_q = data_q.ilike("judul", f"%{s}%")

        if id_genre is not None:
            count_q = count_q.eq("id_genre", id_genre)
            data_q = data_q.eq("id_genre", id_genre)

        if id_penulis is not None:
            count_q = count_q.eq("id_penulis", id_penulis)
            data_q = data_q.eq("id_penulis", id_penulis)

        if status_ok:
            count_q = count_q.eq("status", status_ok)
            data_q = data_q.eq("status", status_ok)

        total = (count_q.execute().count) or 0
        res = data_q.order(sort_by, desc=(order == "desc")).range(start, end).execute()

        return {
            "meta": {
                "page": page,
                "limit": limit,
                "total": total,
                "total_pages": (total + limit - 1) // limit if limit else 0,
                "sort_by": sort_by,
                "order": order,
            },
            "data": res.data or [],
        }
    except HTTPException:
        raise
    except Exception as e:
        raise _map_db_error(e)


@router.get("/admin/books/{book_id}", tags=["Admin - Books"], response_model=BookResponse)
def admin_book_detail(book_id: int, admin: dict = Depends(get_current_admin)):
    try:
        res = supabase.table("buku").select("*, penulis(*), genre(*)").eq("id_buku", book_id).limit(1).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Buku tidak ditemukan")
        return res.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise _map_db_error(e)


@router.post("/admin/books", tags=["Admin - Books"], status_code=status.HTTP_201_CREATED, response_model=BookResponse)
def create_book(book: BookCreate, admin: dict = Depends(get_current_admin)):
    try:
        payload = book.dict(exclude_unset=True)

        if "stok" in payload:
            _validate_non_negative_int("stok", payload.get("stok"))
        if "harga" in payload:
            _validate_non_negative_number("harga", float(payload.get("harga")))

        # biarkan created_at dari DB, kita set updated_at saja biar konsisten
        payload["updated_at"] = _now_utc_iso()

        res = supabase.table("buku").insert(payload).execute()
        if not res.data:
            raise HTTPException(status_code=500, detail="Gagal membuat buku")
        return res.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise _map_db_error(e)


@router.put("/admin/books/{book_id}", tags=["Admin - Books"])
def update_book(book_id: int, book: BookUpdate, admin: dict = Depends(get_current_admin)):
    try:
        payload = book.dict(exclude_unset=True)
        if not payload:
            raise HTTPException(status_code=400, detail="Tidak ada data yang dikirim untuk update")

        if "stok" in payload:
            _validate_non_negative_int("stok", payload.get("stok"))
        if "harga" in payload:
            _validate_non_negative_number("harga", float(payload.get("harga")))
        if "status" in payload:
            payload["status"] = _validate_status(payload["status"])

        payload["updated_at"] = _now_utc_iso()

        res = supabase.table("buku").update(payload).eq("id_buku", book_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Buku tidak ditemukan")

        return {"message": "Buku berhasil diupdate", "data": res.data[0]}
    except HTTPException:
        raise
    except Exception as e:
        raise _map_db_error(e)


@router.delete("/admin/books/{book_id}", tags=["Admin - Books"])
def delete_book(book_id: int, admin: dict = Depends(get_current_admin)):
    try:
        res = supabase.table("buku").update({"status": "nonaktif", "updated_at": _now_utc_iso()}).eq("id_buku", book_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Buku tidak ditemukan")
        return {"message": "Buku berhasil dinonaktifkan", "data": res.data[0]}
    except HTTPException:
        raise
    except Exception as e:
        raise _map_db_error(e)


@router.patch("/admin/books/{book_id}/restore", tags=["Admin - Books"])
def restore_book(book_id: int, admin: dict = Depends(get_current_admin)):
    try:
        res = supabase.table("buku").update({"status": "aktif", "updated_at": _now_utc_iso()}).eq("id_buku", book_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Buku tidak ditemukan")
        return {"message": "Buku berhasil diaktifkan kembali", "data": res.data[0]}
    except HTTPException:
        raise
    except Exception as e:
        raise _map_db_error(e)


@router.patch("/admin/books/{book_id}/toggle", tags=["Admin - Books"])
def toggle_book(book_id: int, is_active: bool, admin: dict = Depends(get_current_admin)):
    try:
        new_status = "aktif" if is_active else "nonaktif"
        res = supabase.table("buku").update({"status": new_status, "updated_at": _now_utc_iso()}).eq("id_buku", book_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Buku tidak ditemukan")
        return {"message": "Status buku diperbarui", "data": res.data[0]}
    except HTTPException:
        raise
    except Exception as e:
        raise _map_db_error(e)


class BulkBookUpdateItem(BaseModel):
    id_buku: int
    stok: Optional[int] = None
    harga: Optional[float] = None
    status: Optional[str] = None


class BulkBookUpdatePayload(BaseModel):
    items: List[BulkBookUpdateItem]


@router.patch("/admin/books/bulk", tags=["Admin - Books"])
def bulk_update_books(payload: BulkBookUpdatePayload, admin: dict = Depends(get_current_admin)):
    if not payload.items:
        raise HTTPException(status_code=400, detail="items kosong")

    updated = 0
    errors = []

    for item in payload.items:
        try:
            data = item.dict(exclude_unset=True)
            book_id = data.pop("id_buku")

            if "stok" in data:
                _validate_non_negative_int("stok", data.get("stok"))
            if "harga" in data:
                _validate_non_negative_number("harga", data.get("harga"))
            if "status" in data:
                data["status"] = _validate_status(data["status"])

            if not data:
                continue

            data["updated_at"] = _now_utc_iso()

            res = supabase.table("buku").update(data).eq("id_buku", book_id).execute()
            if res.data:
                updated += 1
            else:
                errors.append({"id_buku": book_id, "error": "Buku tidak ditemukan"})
        except HTTPException as he:
            errors.append({"id_buku": item.id_buku, "error": he.detail})
        except Exception as e:
            errors.append({"id_buku": item.id_buku, "error": str(e)})

    return {"message": "Bulk update selesai", "updated": updated, "errors": errors[:50]}
