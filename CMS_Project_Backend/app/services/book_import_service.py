from typing import Dict, List, Tuple, Any
from app.database import supabase

def _get_or_create_genre(nama_genre: str) -> int:
    nama_genre = nama_genre.strip()
    res = supabase.table("genre").select("id_genre").ilike("nama_genre", nama_genre).execute()
    if res.data:
        return res.data[0]["id_genre"]

    # create genre otomatis (slug bisa dibuat belakangan)
    ins = supabase.table("genre").insert({
        "nama_genre": nama_genre,
        "deskripsi_genre": f"Auto-created: {nama_genre}",
        "slug": nama_genre.lower().replace(" ", "-")[:50]
    }).execute()
    return ins.data[0]["id_genre"]

def _get_or_create_author(nama_penulis: str) -> int:
    nama_penulis = nama_penulis.strip()
    res = supabase.table("penulis").select("id_penulis").ilike("nama_penulis", nama_penulis).execute()
    if res.data:
        return res.data[0]["id_penulis"]

    ins = supabase.table("penulis").insert({
        "nama_penulis": nama_penulis,
        "biografi": "Auto-created"
    }).execute()
    return ins.data[0]["id_penulis"]

def _is_duplicate(isbn: str | None, judul: str, id_penulis: int) -> bool:
    if isbn:
        cek = supabase.table("buku").select("id_buku").eq("isbn", isbn).execute()
        if cek.data:
            return True

    # fallback: judul + penulis
    cek2 = supabase.table("buku").select("id_buku").ilike("judul", judul).eq("id_penulis", id_penulis).execute()
    return bool(cek2.data)

def import_books_from_rows(rows: List[Dict[str, Any]]) -> Tuple[int, int, List[dict]]:
    success = 0
    failed = 0
    errors: List[dict] = []

    for i, row in enumerate(rows, start=2):  # start=2 karena header baris 1
        try:
            judul = (row.get("judul") or "").strip()
            if not judul:
                raise ValueError("judul kosong")

            harga = float(row.get("harga"))
            stok = int(float(row.get("stok")))  # aman jika '10.0'
            nama_genre = (row.get("nama_genre") or "").strip()
            nama_penulis = (row.get("nama_penulis") or "").strip()

            if not nama_genre:
                raise ValueError("nama_genre kosong")
            if not nama_penulis:
                raise ValueError("nama_penulis kosong")

            id_genre = _get_or_create_genre(nama_genre)
            id_penulis = _get_or_create_author(nama_penulis)

            isbn = (row.get("isbn") or "").strip() or None
            if _is_duplicate(isbn, judul, id_penulis):
                # duplikat dianggap gagal/skip
                failed += 1
                errors.append({"row": i, "error": "Duplikat (ISBN atau judul+penulis)", "data": {"judul": judul}})
                continue

            payload = {
                "judul": judul,
                "harga": harga,
                "stok": stok,
                "berat": float(row.get("berat") or 0.5),
                "deskripsi": row.get("deskripsi"),
                "cover_image": row.get("cover_image"),
                "isbn": isbn,
                "id_genre": id_genre,
                "id_penulis": id_penulis,
                "status": "aktif"
            }

            supabase.table("buku").insert(payload).execute()
            success += 1

        except Exception as e:
            failed += 1
            errors.append({"row": i, "error": str(e), "data": row})

    return success, failed, errors
