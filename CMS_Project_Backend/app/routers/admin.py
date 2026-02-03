# app/routers/admin.py

import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, BackgroundTasks
from pydantic import BaseModel

from app.database import supabase
from app.dependencies import get_current_admin
from app.utils.csv_reader import read_csv_upload
from app.services.import_job_service import create_job, run_books_import_job
from app.services.seed_service import seed_master_data
from app.core.config import settings

from app.services.audit_service import log_event

router = APIRouter(prefix="/admin", tags=["Admin Dashboard"])


# ===========================
# SCHEMAS
# ===========================
class GenreInput(BaseModel):
    nama_genre: str
    deskripsi_genre: str
    slug: str


class PenulisInput(BaseModel):
    nama_penulis: str
    biografi: Optional[str] = None
    foto_penulis: Optional[str] = None


class StatusUpdate(BaseModel):
    id_status_order: Optional[int] = None
    id_status_pembayaran: Optional[int] = None


class PaymentMethodInput(BaseModel):
    nama_pembayaran: str
    keterangan: Optional[str] = None
    is_active: bool = True


class PaymentMethodUpdate(BaseModel):
    nama_pembayaran: Optional[str] = None
    keterangan: Optional[str] = None
    is_active: Optional[bool] = None


class UserRoleUpdate(BaseModel):
    role: str


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


def _sanitize_sort(sort_by: str, order: str, allowed: set, default_sort: str):
    if sort_by not in allowed:
        sort_by = default_sort
    order = (order or "desc").lower()
    if order not in ("asc", "desc"):
        order = "desc"
    return sort_by, order


def _safe_audit(
    admin: dict,
    action: str,
    entity: Optional[str] = None,
    entity_id: Optional[int] = None,
    metadata: Optional[dict] = None,
):
    try:
        log_event(admin, action, entity=entity, entity_id=entity_id, metadata=metadata or {})
    except Exception:
        pass


def _safe_count(resp: Any) -> int:
    """
    Supabase response kadang resp.count = None (tergantung versi/adapter).
    Kita tetap utamakan count dari header (paling benar).
    """
    try:
        c = getattr(resp, "count", None)
        if isinstance(c, int):
            return c
    except Exception:
        pass
    return 0


_status_cache: Dict[str, int] = {}


def _get_status_pembayaran_id(nama_status: str) -> Optional[int]:
    if nama_status in _status_cache:
        return _status_cache[nama_status]
    try:
        res = (
            supabase.table("status_pembayaran")
            .select("id_status_pembayaran")
            .eq("nama_status", nama_status)
            .limit(1)
            .execute()
        )
        if res.data:
            _status_cache[nama_status] = int(res.data[0]["id_status_pembayaran"])
            return _status_cache[nama_status]
    except Exception:
        return None
    return None


# ===========================
# STORAGE (1 bucket dari .env)
# ===========================
BUCKET = getattr(settings, "SUPABASE_STORAGE_BUCKET", None) or "book-covers"
MAX_MB = 5
ALLOWED_CT = {"image/jpeg", "image/png", "image/webp"}


def _safe_ext(filename: str, content_type: str) -> str:
    fn = (filename or "").lower()
    ext = fn.rsplit(".", 1)[-1] if "." in fn else ""

    if ext in ("jpg", "jpeg", "png", "webp"):
        return "jpg" if ext == "jpeg" else ext
    if content_type == "image/jpeg":
        return "jpg"
    if content_type == "image/png":
        return "png"
    if content_type == "image/webp":
        return "webp"
    return "jpg"


def _infer_storage_path_from_public_url(public_url: Optional[str]) -> Optional[str]:
    if not public_url:
        return None
    marker = f"/storage/v1/object/public/{BUCKET}/"
    idx = public_url.find(marker)
    if idx == -1:
        return None
    return public_url[idx + len(marker) :]


def _storage_upload(path: str, content: bytes, content_type: str):
    try:
        supabase.storage.from_(BUCKET).upload(
            path,
            content,
            file_options={"content-type": content_type, "upsert": True},
        )
    except TypeError:
        supabase.storage.from_(BUCKET).upload(
            path,
            content,
            {"content-type": content_type, "x-upsert": "true"},
        )


# ===========================
# 1) DASHBOARD
# ===========================
@router.get("/stats")
def get_dashboard_stats(admin: dict = Depends(get_current_admin)):
    try:
        # ✅ Jangan filter role=customer (sering bikin 0 kalau role di DB "user/seller/admin")
        users_res = supabase.table("users").select("id_user", count="exact").limit(1).execute()
        buku_res = supabase.table("buku").select("id_buku", count="exact").limit(1).execute()
        order_res = supabase.table("orders").select("id_order", count="exact").limit(1).execute()

        # ✅ Pending payment (buat kartu dashboard)
        pending_id = (
            _get_status_pembayaran_id("Menunggu Pembayaran")
            or _get_status_pembayaran_id("Pending")
            or 1
        )
        pending_res = (
            supabase.table("orders")
            .select("id_order", count="exact")
            .eq("id_status_pembayaran", pending_id)
            .limit(1)
            .execute()
        )

        # ✅ Revenue dari status "Lunas"
        lunas_id = _get_status_pembayaran_id("Lunas") or 2
        orders_lunas = (
            supabase.table("orders")
            .select("total_harga")
            .eq("id_status_pembayaran", lunas_id)
            .execute()
        )
        total_pendapatan = sum(float(x.get("total_harga") or 0) for x in (orders_lunas.data or []))

        total_user = _safe_count(users_res)
        total_buku = _safe_count(buku_res)
        total_order = _safe_count(order_res)
        pending_payment = _safe_count(pending_res)

        # ✅ Return dua gaya key (snake_case + camelCase) biar frontend admin aman
        return {
            "total_user": total_user,
            "total_buku": total_buku,
            "total_order": total_order,
            "pending_payment": pending_payment,
            "total_pendapatan": total_pendapatan,

            "totalUsers": total_user,
            "totalBooks": total_buku,
            "totalOrders": total_order,
            "pendingPayment": pending_payment,
            "totalRevenue": total_pendapatan,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal memuat statistik: {str(e)}")


# ===========================
# 2) MASTER DATA - CREATE
# ===========================
@router.post("/genres", status_code=201)
def create_genre(data: GenreInput, admin: dict = Depends(get_current_admin)):
    try:
        cek = supabase.table("genre").select("id_genre").eq("slug", data.slug).execute()
        if cek.data:
            raise HTTPException(status_code=400, detail="Slug genre sudah ada, gunakan nama lain.")

        res = supabase.table("genre").insert(data.dict()).execute()
        created = res.data[0]
        _safe_audit(admin, "CREATE_GENRE", entity="genre", entity_id=created.get("id_genre"), metadata={"slug": data.slug})
        return {"message": "Genre berhasil ditambahkan", "data": created}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/authors", status_code=201)
def create_author(data: PenulisInput, admin: dict = Depends(get_current_admin)):
    try:
        res = supabase.table("penulis").insert(data.dict(exclude_unset=True)).execute()
        created = res.data[0]
        _safe_audit(admin, "CREATE_AUTHOR", entity="penulis", entity_id=created.get("id_penulis"), metadata={"nama_penulis": created.get("nama_penulis")})
        return {"message": "Penulis berhasil ditambahkan", "data": created}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ===========================
# 2B) PAGED LIST (Dropdown pro)
# ===========================
@router.get("/genres/paged")
def admin_list_genres_paged(page: int = 1, limit: int = 20, q: Optional[str] = None, admin: dict = Depends(get_current_admin)):
    try:
        page, limit, start, end = _sanitize_paging(page, limit, max_limit=100)

        count_q = supabase.table("genre").select("id_genre", count="exact")
        data_q = supabase.table("genre").select("*")

        if q and q.strip():
            s = q.strip()
            count_q = count_q.ilike("nama_genre", f"%{s}%")
            data_q = data_q.ilike("nama_genre", f"%{s}%")

        total = (count_q.execute().count) or 0
        res = data_q.order("nama_genre").range(start, end).execute()

        return {"meta": {"page": page, "limit": limit, "total": total, "total_pages": (total + limit - 1) // limit}, "data": res.data or []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/authors/paged")
def admin_list_authors_paged(page: int = 1, limit: int = 20, q: Optional[str] = None, admin: dict = Depends(get_current_admin)):
    try:
        page, limit, start, end = _sanitize_paging(page, limit, max_limit=100)

        count_q = supabase.table("penulis").select("id_penulis", count="exact")
        data_q = supabase.table("penulis").select("*")

        if q and q.strip():
            s = q.strip()
            count_q = count_q.ilike("nama_penulis", f"%{s}%")
            data_q = data_q.ilike("nama_penulis", f"%{s}%")

        total = (count_q.execute().count) or 0
        res = data_q.order("nama_penulis").range(start, end).execute()

        return {"meta": {"page": page, "limit": limit, "total": total, "total_pages": (total + limit - 1) // limit}, "data": res.data or []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ===========================
# MASTER DROPDOWN
# ===========================
@router.get("/master/status-order")
def master_status_order(admin: dict = Depends(get_current_admin)):
    try:
        res = supabase.table("status_order").select("*").order("urutan_status").execute()
        return res.data or []
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/master/status-pembayaran")
def master_status_pembayaran(admin: dict = Depends(get_current_admin)):
    try:
        res = supabase.table("status_pembayaran").select("*").order("id_status_pembayaran").execute()
        return res.data or []
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ===========================
# PAYMENT METHODS (ADMIN)
# ===========================
@router.get("/payment-methods")
def admin_get_payment_methods(admin: dict = Depends(get_current_admin)):
    try:
        res = supabase.table("jenis_pembayaran").select("*").order("id_jenis_pembayaran", desc=True).execute()
        return res.data or []
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/payment-methods/paged")
def admin_get_payment_methods_paged(
    page: int = 1,
    limit: int = 20,
    q: Optional[str] = None,
    is_active: Optional[bool] = None,
    sort_by: str = "id_jenis_pembayaran",
    order: str = "desc",
    admin: dict = Depends(get_current_admin),
):
    try:
        page, limit, start, end = _sanitize_paging(page, limit, max_limit=100)
        sort_by, order = _sanitize_sort(sort_by, order, {"id_jenis_pembayaran", "nama_pembayaran", "is_active"}, "id_jenis_pembayaran")

        count_q = supabase.table("jenis_pembayaran").select("id_jenis_pembayaran", count="exact")
        data_q = supabase.table("jenis_pembayaran").select("*")

        if q and q.strip():
            s = q.strip()
            data_q = data_q.ilike("nama_pembayaran", f"%{s}%")
            count_q = count_q.ilike("nama_pembayaran", f"%{s}%")

        if is_active is not None:
            data_q = data_q.eq("is_active", is_active)
            count_q = count_q.eq("is_active", is_active)

        total = (count_q.execute().count) or 0
        res = data_q.order(sort_by, desc=(order == "desc")).range(start, end).execute()

        return {
            "meta": {"page": page, "limit": limit, "total": total, "total_pages": (total + limit - 1) // limit, "sort_by": sort_by, "order": order},
            "data": res.data or [],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/payment-methods", status_code=201)
def admin_create_payment_method(data: PaymentMethodInput, admin: dict = Depends(get_current_admin)):
    try:
        cek = supabase.table("jenis_pembayaran").select("id_jenis_pembayaran").eq("nama_pembayaran", data.nama_pembayaran).execute()
        if cek.data:
            raise HTTPException(status_code=400, detail="Metode pembayaran dengan nama itu sudah ada")

        res = supabase.table("jenis_pembayaran").insert(data.dict()).execute()
        created = res.data[0]
        _safe_audit(admin, "CREATE_PAYMENT_METHOD", entity="jenis_pembayaran", entity_id=created.get("id_jenis_pembayaran"), metadata={"nama": data.nama_pembayaran})
        return {"message": "Metode pembayaran berhasil ditambahkan", "data": created}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/payment-methods/{pm_id}")
def admin_update_payment_method(pm_id: int, data: PaymentMethodUpdate, admin: dict = Depends(get_current_admin)):
    try:
        payload = data.dict(exclude_unset=True)
        if not payload:
            raise HTTPException(status_code=400, detail="Tidak ada data yang diupdate")

        res = supabase.table("jenis_pembayaran").update(payload).eq("id_jenis_pembayaran", pm_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Metode pembayaran tidak ditemukan")

        _safe_audit(admin, "UPDATE_PAYMENT_METHOD", entity="jenis_pembayaran", entity_id=pm_id, metadata={"changes": payload})
        return {"message": "Metode pembayaran berhasil diupdate", "data": res.data[0]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/payment-methods/{pm_id}/toggle")
def admin_toggle_payment_method(pm_id: int, is_active: bool, admin: dict = Depends(get_current_admin)):
    try:
        res = supabase.table("jenis_pembayaran").update({"is_active": is_active}).eq("id_jenis_pembayaran", pm_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Metode pembayaran tidak ditemukan")

        _safe_audit(admin, "TOGGLE_PAYMENT_METHOD", entity="jenis_pembayaran", entity_id=pm_id, metadata={"is_active": is_active})
        return {"message": "Status metode pembayaran diperbarui", "data": res.data[0]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ===========================
# UPLOAD COVER BUKU (buku.cover_image)
# ===========================
@router.post("/books/{book_id}/cover", status_code=201)
async def upload_book_cover(book_id: int, file: UploadFile = File(...), admin: dict = Depends(get_current_admin)):
    if file.content_type not in ALLOWED_CT:
        raise HTTPException(status_code=400, detail="File harus gambar: jpg/png/webp")

    book_res = supabase.table("buku").select("id_buku, cover_image").eq("id_buku", book_id).limit(1).execute()
    if not book_res.data:
        raise HTTPException(status_code=404, detail="Buku tidak ditemukan")

    old_url = book_res.data[0].get("cover_image")
    old_path = _infer_storage_path_from_public_url(old_url)

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="File kosong")
    if len(content) > MAX_MB * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"Ukuran maksimal {MAX_MB}MB")

    ext = _safe_ext(file.filename, file.content_type)
    new_path = f"books/{book_id}/{uuid.uuid4().hex}.{ext}"

    try:
        _storage_upload(new_path, content, file.content_type)
        public_url = supabase.storage.from_(BUCKET).get_public_url(new_path)

        upd = supabase.table("buku").update({"cover_image": public_url, "updated_at": _now_utc_iso()}).eq("id_buku", book_id).execute()
        if not upd.data:
            raise HTTPException(status_code=500, detail="Gagal update cover di database")

        if old_path and old_path != new_path:
            try:
                supabase.storage.from_(BUCKET).remove([old_path])
            except Exception:
                pass

        _safe_audit(admin, "UPLOAD_BOOK_COVER", entity="buku", entity_id=book_id, metadata={"path": new_path})
        return {"message": "Cover berhasil diupload", "book_id": book_id, "cover_image": public_url, "path": new_path}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal upload cover: {str(e)}")


@router.delete("/books/{book_id}/cover")
def delete_book_cover(book_id: int, admin: dict = Depends(get_current_admin)):
    book_res = supabase.table("buku").select("id_buku, cover_image").eq("id_buku", book_id).limit(1).execute()
    if not book_res.data:
        raise HTTPException(status_code=404, detail="Buku tidak ditemukan")

    cover_url = book_res.data[0].get("cover_image")
    if not cover_url:
        return {"message": "Buku tidak punya cover"}

    path = _infer_storage_path_from_public_url(cover_url)

    try:
        if path:
            try:
                supabase.storage.from_(BUCKET).remove([path])
            except Exception:
                pass

        supabase.table("buku").update({"cover_image": None, "updated_at": _now_utc_iso()}).eq("id_buku", book_id).execute()
        _safe_audit(admin, "DELETE_BOOK_COVER", entity="buku", entity_id=book_id, metadata={"path": path})
        return {"message": "Cover berhasil dihapus"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ===========================
# UPLOAD FOTO PENULIS (penulis.foto_penulis)
# ===========================
@router.post("/authors/{author_id}/photo", status_code=201)
async def upload_author_photo(author_id: int, file: UploadFile = File(...), admin: dict = Depends(get_current_admin)):
    if file.content_type not in ALLOWED_CT:
        raise HTTPException(status_code=400, detail="File harus gambar: jpg/png/webp")

    author_res = supabase.table("penulis").select("id_penulis, foto_penulis").eq("id_penulis", author_id).limit(1).execute()
    if not author_res.data:
        raise HTTPException(status_code=404, detail="Penulis tidak ditemukan")

    old_url = author_res.data[0].get("foto_penulis")
    old_path = _infer_storage_path_from_public_url(old_url)

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="File kosong")
    if len(content) > MAX_MB * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"Ukuran maksimal {MAX_MB}MB")

    ext = _safe_ext(file.filename, file.content_type)
    new_path = f"authors/{author_id}/{uuid.uuid4().hex}.{ext}"

    try:
        _storage_upload(new_path, content, file.content_type)
        public_url = supabase.storage.from_(BUCKET).get_public_url(new_path)

        upd = supabase.table("penulis").update({"foto_penulis": public_url}).eq("id_penulis", author_id).execute()
        if not upd.data:
            raise HTTPException(status_code=500, detail="Gagal update foto_penulis")

        if old_path and old_path != new_path:
            try:
                supabase.storage.from_(BUCKET).remove([old_path])
            except Exception:
                pass

        _safe_audit(admin, "UPLOAD_AUTHOR_PHOTO", entity="penulis", entity_id=author_id, metadata={"path": new_path})
        return {"message": "Foto penulis berhasil diupload", "author_id": author_id, "foto_penulis": public_url, "path": new_path}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal upload foto penulis: {str(e)}")


@router.delete("/authors/{author_id}/photo")
def delete_author_photo(author_id: int, admin: dict = Depends(get_current_admin)):
    author_res = supabase.table("penulis").select("id_penulis, foto_penulis").eq("id_penulis", author_id).limit(1).execute()
    if not author_res.data:
        raise HTTPException(status_code=404, detail="Penulis tidak ditemukan")

    foto_url = author_res.data[0].get("foto_penulis")
    if not foto_url:
        return {"message": "Penulis belum punya foto"}

    path = _infer_storage_path_from_public_url(foto_url)

    try:
        if path:
            try:
                supabase.storage.from_(BUCKET).remove([path])
            except Exception:
                pass

        supabase.table("penulis").update({"foto_penulis": None}).eq("id_penulis", author_id).execute()
        _safe_audit(admin, "DELETE_AUTHOR_PHOTO", entity="penulis", entity_id=author_id, metadata={"path": path})
        return {"message": "Foto penulis berhasil dihapus"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ===========================
# IMPORT JOBS (tetap sesuai project kamu)
# ===========================
@router.post("/books/import", status_code=202)
def import_books_csv(background_tasks: BackgroundTasks, file: UploadFile = File(...), admin: dict = Depends(get_current_admin)):
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="File harus berformat .csv")

    try:
        rows = read_csv_upload(file)
        job_id = create_job("books_csv", file.filename, total=len(rows))
        background_tasks.add_task(run_books_import_job, job_id, rows)

        _safe_audit(admin, "IMPORT_BOOKS_CSV_START", entity="import_jobs", entity_id=job_id, metadata={"filename": file.filename, "total": len(rows)})
        return {"message": "Import dijalankan di background", "job_id": job_id, "total": len(rows), "status_url": f"/admin/import-jobs/{job_id}"}
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/import-jobs/{job_id}")
def get_import_job(job_id: int, admin: dict = Depends(get_current_admin)):
    res = supabase.table("import_jobs").select("*").eq("id", job_id).limit(1).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Job tidak ditemukan")
    return res.data[0]


@router.get("/import-jobs")
def list_import_jobs(admin: dict = Depends(get_current_admin)):
    res = supabase.table("import_jobs").select("*").order("created_at", desc=True).execute()
    return res.data or []


@router.get("/import-jobs/paged")
def list_import_jobs_paged(page: int = 1, limit: int = 20, admin: dict = Depends(get_current_admin)):
    page, limit, start, end = _sanitize_paging(page, limit, max_limit=100)
    total = (supabase.table("import_jobs").select("id", count="exact").execute().count) or 0
    res = supabase.table("import_jobs").select("*").order("created_at", desc=True).range(start, end).execute()
    return {"meta": {"page": page, "limit": limit, "total": total, "total_pages": (total + limit - 1) // limit}, "data": res.data or []}


# ===========================
# ORDERS ADMIN (CMS)
# ===========================
@router.get("/orders")
def get_all_orders(admin: dict = Depends(get_current_admin)):
    res = (
        supabase.table("orders")
        .select(
            "*, users(nama, email), status_order(nama_status), status_pembayaran(nama_status), "
            "order_item(id_order_item, id_order, id_buku, jumlah, harga_satuan, subtotal, created_at, buku(judul, cover_image))"
        )
        .order("created_at", desc=True)
        .execute()
    )
    return res.data or []


@router.get("/orders/{id_order}")
def admin_order_detail(id_order: int, admin: dict = Depends(get_current_admin)):
    res = (
        supabase.table("orders")
        .select(
            "*, users(nama, email), status_order(nama_status), status_pembayaran(nama_status), "
            "order_item(id_order_item, id_order, id_buku, jumlah, harga_satuan, subtotal, created_at, buku(judul, cover_image))"
        )
        .eq("id_order", id_order)
        .limit(1)
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Order tidak ditemukan")
    return res.data[0]


@router.patch("/orders/{id_order}/status")
def update_order_status(id_order: int, status: StatusUpdate, admin: dict = Depends(get_current_admin)):
    updates: Dict[str, Any] = {}

    if status.id_status_order is not None:
        if status.id_status_order <= 0:
            raise HTTPException(status_code=422, detail="id_status_order tidak valid")
        updates["id_status_order"] = status.id_status_order

    if status.id_status_pembayaran is not None:
        if status.id_status_pembayaran <= 0:
            raise HTTPException(status_code=422, detail="id_status_pembayaran tidak valid")
        updates["id_status_pembayaran"] = status.id_status_pembayaran

    if not updates:
        raise HTTPException(status_code=422, detail="Tidak ada status yang diupdate")

    updates["updated_at"] = _now_utc_iso()

    res = (
        supabase.table("orders")
        .update(updates)
        .eq("id_order", id_order)
        .execute()
    )

    if not res.data:
        raise HTTPException(status_code=404, detail="Order tidak ditemukan")

    _safe_audit(
        admin,
        "UPDATE_ORDER_STATUS",
        entity="orders",
        entity_id=id_order,
        metadata=updates,
    )
    return {"message": "Status order berhasil diperbarui", "data": res.data[0]}


# ===========================
# USERS MANAGEMENT
# ===========================
@router.get("/users")
def admin_list_users(admin: dict = Depends(get_current_admin)):
    res = supabase.table("users").select("id_user, nama, email, role, is_active, created_at").order("id_user", desc=True).execute()
    return res.data or []


@router.patch("/users/{id_user}/toggle")
def admin_toggle_user(id_user: int, is_active: bool, admin: dict = Depends(get_current_admin)):
    res = supabase.table("users").update({"is_active": is_active}).eq("id_user", id_user).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="User tidak ditemukan")

    _safe_audit(admin, "TOGGLE_USER_ACTIVE", entity="users", entity_id=id_user, metadata={"is_active": is_active})
    return {"message": "Status user diperbarui", "data": res.data[0]}


@router.patch("/users/{id_user}/role")
def admin_set_user_role(id_user: int, payload: UserRoleUpdate, admin: dict = Depends(get_current_admin)):
    role = (payload.role or "").lower().strip()
    if role not in ("customer", "seller", "admin"):
        raise HTTPException(status_code=400, detail="role harus: customer | seller | admin")

    res = supabase.table("users").update({"role": role}).eq("id_user", id_user).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="User tidak ditemukan")

    return {"message": "Role user berhasil diubah", "data": res.data[0]}


# ===========================
# AUDIT LOGS (opsional)
# ===========================
@router.get("/audit-logs")
def admin_get_audit_logs(admin: dict = Depends(get_current_admin)):
    try:
        res = supabase.table("audit_logs").select("*").order("created_at", desc=True).limit(200).execute()
        return res.data or []
    except Exception:
        return []


# ===========================
# SEED
# ===========================
@router.post("/seed", status_code=201)
def seed(admin: dict = Depends(get_current_admin)):
    try:
        seed_master_data()
        _safe_audit(admin, "SEED_MASTER_DATA", metadata={})
        return {"message": "Seed master data selesai"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
