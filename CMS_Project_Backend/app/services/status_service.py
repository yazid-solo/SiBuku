from app.database import supabase


def get_status_order_id(nama_status: str) -> int:
    res = supabase.table("status_order").select("id_status_order").eq("nama_status", nama_status).execute()
    if not res.data:
        raise ValueError(f"Status order '{nama_status}' tidak ditemukan. Jalankan /admin/seed dulu.")
    return res.data[0]["id_status_order"]


def get_status_pembayaran_id(nama_status: str) -> int:
    res = supabase.table("status_pembayaran").select("id_status_pembayaran").eq("nama_status", nama_status).execute()
    if not res.data:
        raise ValueError(f"Status pembayaran '{nama_status}' tidak ditemukan. Jalankan /admin/seed dulu.")
    return res.data[0]["id_status_pembayaran"]
