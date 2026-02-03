from app.database import supabase


def seed_master_data():
    """
    Seed data yang wajib ada agar sistem jalan tanpa insert manual.
    Aman dipanggil berulang (idempotent) karena cek dulu sebelum insert.
    """

    # 1) status_pembayaran
    status_pembayaran_list = ["Menunggu Pembayaran", "Lunas", "Gagal"]
    for name in status_pembayaran_list:
        cek = supabase.table("status_pembayaran").select("id_status_pembayaran").eq("nama_status", name).execute()
        if not cek.data:
            supabase.table("status_pembayaran").insert({"nama_status": name}).execute()

    # 2) status_order
    status_order_list = [
        ("Pending", 1),
        ("Diproses", 2),
        ("Dikirim", 3),
        ("Selesai", 4),
        ("Dibatalkan", 5),
    ]
    for name, urutan in status_order_list:
        cek = supabase.table("status_order").select("id_status_order").eq("nama_status", name).execute()
        if not cek.data:
            supabase.table("status_order").insert({"nama_status": name, "urutan_status": urutan}).execute()

    # 3) jenis_pembayaran (contoh default)
    payment_methods = [
        ("Transfer Bank", "Pembayaran via transfer bank"),
        ("COD", "Bayar di tempat"),
        ("E-Wallet", "Pembayaran via e-wallet"),
    ]
    for nama, ket in payment_methods:
        cek = supabase.table("jenis_pembayaran").select("id_jenis_pembayaran").eq("nama_pembayaran", nama).execute()
        if not cek.data:
            supabase.table("jenis_pembayaran").insert({
                "nama_pembayaran": nama,
                "keterangan": ket,
                "is_active": True
            }).execute()
