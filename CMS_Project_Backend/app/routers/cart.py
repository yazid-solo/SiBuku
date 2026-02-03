from typing import Optional, List, Dict, Any

from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel, Field

from app.database import supabase
from app.dependencies import get_current_user
from app.schemas import CartItemInput, CartResponse, MessageResponse, CheckoutRequest, CheckoutResult

router = APIRouter(prefix="/cart", tags=["Cart"])


class UpdateQtyPayload(BaseModel):
    jumlah: int = Field(..., ge=1)


def _get_active_cart_id_or_none(id_user: int) -> Optional[int]:
    cek = (
        supabase.table("keranjang")
        .select("id_keranjang")
        .eq("id_user", id_user)
        .eq("status_keranjang", "aktif")
        .limit(1)
        .execute()
    )
    if cek.data:
        return int(cek.data[0]["id_keranjang"])
    return None


def _get_or_create_active_cart_id(id_user: int) -> int:
    cid = _get_active_cart_id_or_none(id_user)
    if cid:
        return cid
    new_cart = supabase.table("keranjang").insert({"id_user": id_user, "status_keranjang": "aktif"}).execute()
    return int(new_cart.data[0]["id_keranjang"])


def _get_book_realtime(id_buku: int) -> Dict[str, Any]:
    res = supabase.table("buku").select("id_buku, judul, harga, stok, status").eq("id_buku", id_buku).limit(1).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Buku tidak ditemukan")
    return res.data[0]


def _cart_summary(items: List[Dict[str, Any]]) -> Dict[str, Any]:
    total_qty = 0
    total_price = 0.0
    for it in items:
        total_qty += int(it.get("jumlah") or 0)
        total_price += float(it.get("subtotal") or 0)
    return {"total_qty": total_qty, "total_price": total_price}


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
    if "Stok tidak cukup" in m or "stok tidak cukup" in m:
        raise HTTPException(status_code=400, detail=m)
    if "Metode pembayaran" in m:
        raise HTTPException(status_code=400, detail=m)
    if "Buku tidak ditemukan" in m:
        raise HTTPException(status_code=404, detail=m)
    if "seed" in m.lower() or "Status order" in m or "Status pembayaran" in m:
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
            raise HTTPException(status_code=500, detail="Gagal checkout (RPC tidak mengembalikan data)")
        return data
    except HTTPException:
        raise
    except Exception as e:
        _raise_mapped_rpc_error(str(e))


@router.get("/", response_model=CartResponse)
def get_my_cart(user: dict = Depends(get_current_user)):
    try:
        id_keranjang = _get_active_cart_id_or_none(user["id_user"])
        if not id_keranjang:
            return {"id_keranjang": None, "status_keranjang": None, "summary": {"total_qty": 0, "total_price": 0}, "items": []}

        items_res = (
            supabase.table("keranjang_item")
            .select("*, buku(judul, harga, cover_image, berat, status)")
            .eq("id_keranjang", id_keranjang)
            .order("created_at")
            .execute()
        )
        items = items_res.data or []

        cart_res = supabase.table("keranjang").select("id_keranjang, status_keranjang, created_at").eq("id_keranjang", id_keranjang).limit(1).execute()
        cart_row = (cart_res.data or [{}])[0]

        return {
            "id_keranjang": cart_row.get("id_keranjang"),
            "status_keranjang": cart_row.get("status_keranjang"),
            "created_at": cart_row.get("created_at"),
            "summary": _cart_summary(items),
            "items": items,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/items", status_code=201, response_model=MessageResponse)
def add_to_cart(item: CartItemInput, user: dict = Depends(get_current_user)):
    try:
        buku = _get_book_realtime(item.id_buku)
        if buku.get("status") != "aktif":
            raise HTTPException(status_code=400, detail="Buku sedang tidak aktif")

        stok = int(buku.get("stok") or 0)
        if stok <= 0:
            raise HTTPException(status_code=400, detail="Stok buku habis")
        if int(item.jumlah) > stok:
            raise HTTPException(status_code=400, detail=f"Stok tidak cukup. Sisa stok: {stok}")

        id_keranjang = _get_or_create_active_cart_id(user["id_user"])
        harga_satuan = float(buku["harga"])

        cek_item = (
            supabase.table("keranjang_item")
            .select("id_keranjang_item, jumlah")
            .eq("id_keranjang", id_keranjang)
            .eq("id_buku", item.id_buku)
            .limit(1)
            .execute()
        )

        if cek_item.data:
            row = cek_item.data[0]
            id_item = int(row["id_keranjang_item"])
            jumlah_baru = int(row["jumlah"]) + int(item.jumlah)
            if jumlah_baru > stok:
                raise HTTPException(status_code=400, detail=f"Stok tidak cukup. Sisa stok: {stok}")

            supabase.table("keranjang_item").update(
                {"jumlah": jumlah_baru, "harga_satuan": harga_satuan, "subtotal": harga_satuan * jumlah_baru}
            ).eq("id_keranjang_item", id_item).execute()

            return {"message": "Jumlah barang diperbarui"}

        supabase.table("keranjang_item").insert(
            {
                "id_keranjang": id_keranjang,
                "id_buku": item.id_buku,
                "jumlah": int(item.jumlah),
                "harga_satuan": harga_satuan,
                "subtotal": harga_satuan * int(item.jumlah),
            }
        ).execute()

        return {"message": "Barang berhasil masuk keranjang"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/items/{item_id}", response_model=MessageResponse)
def update_cart_item_qty(item_id: int, payload: UpdateQtyPayload, user: dict = Depends(get_current_user)):
    try:
        id_keranjang = _get_active_cart_id_or_none(user["id_user"])
        if not id_keranjang:
            raise HTTPException(status_code=404, detail="Keranjang tidak ditemukan")

        cek_item = (
            supabase.table("keranjang_item")
            .select("id_keranjang_item, id_buku")
            .eq("id_keranjang", id_keranjang)
            .eq("id_keranjang_item", item_id)
            .limit(1)
            .execute()
        )
        if not cek_item.data:
            raise HTTPException(status_code=404, detail="Item tidak ditemukan")

        id_buku = int(cek_item.data[0]["id_buku"])
        buku = _get_book_realtime(id_buku)

        if buku.get("status") != "aktif":
            raise HTTPException(status_code=400, detail="Buku sedang tidak aktif")

        stok = int(buku.get("stok") or 0)
        if int(payload.jumlah) > stok:
            raise HTTPException(status_code=400, detail=f"Stok tidak cukup. Sisa stok: {stok}")

        harga_satuan = float(buku["harga"])
        subtotal = harga_satuan * int(payload.jumlah)

        supabase.table("keranjang_item").update(
            {"jumlah": int(payload.jumlah), "harga_satuan": harga_satuan, "subtotal": subtotal}
        ).eq("id_keranjang_item", item_id).execute()

        return {"message": "Item berhasil diupdate"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/items/{item_id}", response_model=MessageResponse)
def remove_cart_item(item_id: int, user: dict = Depends(get_current_user)):
    try:
        id_keranjang = _get_active_cart_id_or_none(user["id_user"])
        if not id_keranjang:
            raise HTTPException(status_code=404, detail="Keranjang tidak ditemukan")

        cek = (
            supabase.table("keranjang_item")
            .select("id_keranjang_item")
            .eq("id_keranjang", id_keranjang)
            .eq("id_keranjang_item", item_id)
            .limit(1)
            .execute()
        )
        if not cek.data:
            raise HTTPException(status_code=404, detail="Item tidak ditemukan")

        supabase.table("keranjang_item").delete().eq("id_keranjang_item", item_id).execute()
        return {"message": "Item dihapus dari keranjang"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/", response_model=MessageResponse)
def clear_cart(user: dict = Depends(get_current_user)):
    try:
        id_keranjang = _get_active_cart_id_or_none(user["id_user"])
        if not id_keranjang:
            return {"message": "Keranjang sudah kosong"}

        supabase.table("keranjang_item").delete().eq("id_keranjang", id_keranjang).execute()
        return {"message": "Keranjang dikosongkan"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/checkout", status_code=status.HTTP_201_CREATED, response_model=CheckoutResult)
def checkout_cart(payload: CheckoutRequest, user: dict = Depends(get_current_user)):
    try:
        id_keranjang = _get_active_cart_id_or_none(user["id_user"])
        if not id_keranjang:
            raise HTTPException(status_code=400, detail="Keranjang belanja kosong")

        items_res = supabase.table("keranjang_item").select("id_buku, jumlah").eq("id_keranjang", id_keranjang).execute()
        if not items_res.data:
            raise HTTPException(status_code=400, detail="Keranjang belanja kosong")

        items_payload = [{"id_buku": int(x["id_buku"]), "jumlah": int(x["jumlah"])} for x in items_res.data]

        data = _rpc_create_order_atomic(
            id_user=user["id_user"],
            alamat_pengiriman=payload.alamat_pengiriman,
            catatan=payload.catatan,
            id_jenis_pembayaran=payload.id_jenis_pembayaran,
            items_payload=items_payload,
        )

        # clear items + tandai cart checkout (rapi sesuai kolom status_keranjang)
        supabase.table("keranjang_item").delete().eq("id_keranjang", id_keranjang).execute()
        supabase.table("keranjang").update({"status_keranjang": "checkout"}).eq("id_keranjang", id_keranjang).execute()

        return {
            "message": "Checkout berhasil!",
            "id_order": int(data.get("id_order")),
            "kode_order": str(data.get("kode_order")),
            "total_bayar": float(data.get("total_bayar", 0) or 0),
            "status": str(data.get("status") or "Menunggu Pembayaran"),
        }
    except HTTPException:
        raise
    except Exception as e:
        _raise_mapped_rpc_error(str(e))
