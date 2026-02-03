from typing import List, Optional, Any, Dict
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, status, Depends, Query
from pydantic import BaseModel, Field
from fastapi.responses import Response

from app.database import supabase
from app.dependencies import get_current_user
from app.schemas import CartItemInput, OrderResponse, CheckoutResult

router = APIRouter()


class CreateOrderRequest(BaseModel):
    alamat_pengiriman: str
    id_jenis_pembayaran: int
    catatan: Optional[str] = None
    items: List[CartItemInput] = Field(..., min_length=1)


def _normalize_rpc_data(data: Any) -> Dict[str, Any]:
    if data is None:
        return {}
    if isinstance(data, list):
        return data[0] if data else {}
    if isinstance(data, dict):
        return data
    return {}


def _raise_mapped_rpc_error(msg: str):
    m = (msg or "").strip()
    if "Keranjang belanja kosong" in m:
        raise HTTPException(status_code=400, detail="Keranjang belanja kosong")
    if "Metode pembayaran" in m:
        raise HTTPException(status_code=400, detail=m)
    if "Stok tidak cukup" in m or "stok tidak cukup" in m:
        raise HTTPException(status_code=400, detail=m)
    if "Buku tidak ditemukan" in m:
        raise HTTPException(status_code=404, detail=m)
    if "Status order" in m or "Status pembayaran" in m or "seed" in m.lower():
        raise HTTPException(status_code=500, detail=m)
    raise HTTPException(status_code=400, detail=m or "Terjadi kesalahan")


def _rpc_create_order_atomic(
    *,
    id_user: int,
    alamat_pengiriman: str,
    catatan: Optional[str],
    id_jenis_pembayaran: int,
    items_payload: List[Dict[str, int]],
) -> Dict[str, Any]:
    try:
        rpc_res = supabase.rpc(
            "create_order_atomic",
            {
                "p_id_user": id_user,
                "p_alamat_pengiriman": alamat_pengiriman,
                "p_catatan": catatan,
                "p_id_jenis_pembayaran": id_jenis_pembayaran,
                "p_items": items_payload,
            },
        ).execute()

        data = _normalize_rpc_data(rpc_res.data)
        if not data:
            raise HTTPException(status_code=500, detail="Gagal membuat order (RPC tidak mengembalikan data)")
        return data
    except HTTPException:
        raise
    except Exception as e:
        _raise_mapped_rpc_error(str(e))


def _clear_active_cart_items_safe(id_user: int):
    try:
        cart = (
            supabase.table("keranjang")
            .select("id_keranjang")
            .eq("id_user", id_user)
            .eq("status_keranjang", "aktif")
            .limit(1)
            .execute()
        )
        if not cart.data:
            return
        id_keranjang = int(cart.data[0]["id_keranjang"])
        supabase.table("keranjang_item").delete().eq("id_keranjang", id_keranjang).execute()
    except Exception:
        pass


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _try_archive_order(id_order: int, id_user: int) -> bool:
    """
    Soft delete: set is_archived = true (dan archived_at jika kolom ada).
    Kalau kolom belum ada, return False agar caller bisa fallback.
    """
    try:
        # update is_archived (archived_at opsional)
        payload = {"is_archived": True, "archived_at": _now_iso()}
        res = (
            supabase.table("orders")
            .update(payload)
            .eq("id_order", id_order)
            .eq("id_user", id_user)
            .execute()
        )
        # kalau sukses tapi data kosong (tergantung setting return), anggap berhasil
        return True
    except Exception:
        # kemungkinan kolom is_archived/archived_at belum ada
        try:
            payload = {"is_archived": True}
            supabase.table("orders").update(payload).eq("id_order", id_order).eq("id_user", id_user).execute()
            return True
        except Exception:
            return False


def _select_orders(user_id: int, include_archived: bool) -> List[Dict[str, Any]]:
    """
    Aman: kalau kolom is_archived belum ada, otomatis fallback tanpa filter.
    """
    select_cols = (
        "*, status_order(nama_status), status_pembayaran(nama_status), "
        "order_item(id_order_item, id_order, id_buku, jumlah, harga_satuan, subtotal, created_at, buku(judul, cover_image))"
    )

    base = (
        supabase.table("orders")
        .select(select_cols)
        .eq("id_user", user_id)
        .order("created_at", desc=True)
    )

    if include_archived:
        return (base.execute().data) or []

    # try filter is_archived=false, fallback kalau kolom belum ada
    try:
        res = base.eq("is_archived", False).execute()
        return res.data or []
    except Exception:
        res = base.execute()
        return res.data or []


@router.post("/orders", tags=["Orders"], status_code=status.HTTP_201_CREATED, response_model=CheckoutResult)
def create_order(payload: CreateOrderRequest, user: dict = Depends(get_current_user)):
    items_payload = [{"id_buku": it.id_buku, "jumlah": it.jumlah} for it in payload.items]

    data = _rpc_create_order_atomic(
        id_user=user["id_user"],
        alamat_pengiriman=payload.alamat_pengiriman,
        catatan=payload.catatan,
        id_jenis_pembayaran=payload.id_jenis_pembayaran,
        items_payload=items_payload,
    )

    _clear_active_cart_items_safe(user["id_user"])

    return {
        "message": "Order berhasil dibuat!",
        "id_order": int(data.get("id_order")),
        "kode_order": str(data.get("kode_order")),
        "total_bayar": float(data.get("total_bayar", 0) or 0),
        "status": str(data.get("status") or "Menunggu Pembayaran"),
    }


@router.get("/orders", tags=["Orders"], response_model=List[OrderResponse])
def get_my_order_history(
    include_archived: bool = Query(False, description="Jika true, tampilkan juga order yang sudah di-archive"),
    user: dict = Depends(get_current_user),
):
    """
    Join sesuai schema:
    - status_order(nama_status)
    - status_pembayaran(nama_status)
    - order_item(..., buku(judul, cover_image))
    Default: sembunyikan order yang is_archived=true (kalau kolomnya ada).
    """
    try:
        return _select_orders(user["id_user"], include_archived=include_archived)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/orders/{id_order}", tags=["Orders"], response_model=OrderResponse)
def get_order_detail(id_order: int, user: dict = Depends(get_current_user)):
    try:
        res = (
            supabase.table("orders")
            .select(
                "*, status_order(nama_status), status_pembayaran(nama_status), "
                "order_item(id_order_item, id_order, id_buku, jumlah, harga_satuan, subtotal, created_at, buku(judul, cover_image))"
            )
            .eq("id_order", id_order)
            .eq("id_user", user["id_user"])
            .limit(1)
            .execute()
        )
        if not res.data:
            raise HTTPException(status_code=404, detail="Order tidak ditemukan")
        return res.data[0]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ✅ ENDPOINT BARU: archive (soft delete) order milik user sendiri
@router.patch("/orders/{id_order}/archive", tags=["Orders"], status_code=status.HTTP_204_NO_CONTENT)
def archive_order(id_order: int, user: dict = Depends(get_current_user)):
    """
    Soft delete (ecommerce-friendly):
    - set is_archived = true (opsional archived_at)
    - order tidak muncul lagi di GET /orders (default)
    """
    try:
        check = (
            supabase.table("orders")
            .select("id_order, id_user")
            .eq("id_order", id_order)
            .eq("id_user", user["id_user"])
            .limit(1)
            .execute()
        )
        if not check.data:
            raise HTTPException(status_code=404, detail="Order tidak ditemukan")

        ok = _try_archive_order(id_order, user["id_user"])
        if not ok:
            raise HTTPException(
                status_code=400,
                detail="Kolom is_archived belum ada di tabel orders. Tambahkan dulu kolomnya di Supabase.",
            )

        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ✅ ENDPOINT DELETE: hard delete, tapi fallback ke archive kalau FK error
@router.delete("/orders/{id_order}", tags=["Orders"], status_code=status.HTTP_204_NO_CONTENT)
def delete_order(id_order: int, user: dict = Depends(get_current_user)):
    """
    Hapus order dari riwayat user.
    - Default: hard delete (hapus child order_item dulu).
    - Jika hard delete gagal karena FK, fallback: archive (soft delete) biar tidak error.
    """
    try:
        check = (
            supabase.table("orders")
            .select("id_order, id_user")
            .eq("id_order", id_order)
            .eq("id_user", user["id_user"])
            .limit(1)
            .execute()
        )
        if not check.data:
            raise HTTPException(status_code=404, detail="Order tidak ditemukan")

        # hard delete: hapus item dulu (hindari FK error)
        supabase.table("order_item").delete().eq("id_order", id_order).execute()

        supabase.table("orders").delete().eq("id_order", id_order).eq("id_user", user["id_user"]).execute()
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    except HTTPException:
        raise
    except Exception as e:
        # fallback soft delete jika hard delete kena FK constraint
        msg = str(e).lower()
        fk_like = "foreign key" in msg or "violates" in msg or "constraint" in msg

        if fk_like:
            ok = _try_archive_order(id_order, user["id_user"])
            if ok:
                return Response(status_code=status.HTTP_204_NO_CONTENT)

        raise HTTPException(status_code=400, detail=str(e))
