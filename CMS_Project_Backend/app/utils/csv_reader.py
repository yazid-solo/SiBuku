import csv
from typing import List, Dict
from fastapi import UploadFile

REQUIRED_COLS = ["judul", "harga", "stok", "nama_genre", "nama_penulis"]

def read_csv_upload(file: UploadFile) -> List[Dict]:
    content = file.file.read().decode("utf-8-sig").splitlines()
    reader = csv.DictReader(content)

    if not reader.fieldnames:
        raise ValueError("File CSV kosong atau header tidak ditemukan")

    missing = [c for c in REQUIRED_COLS if c not in reader.fieldnames]
    if missing:
        raise ValueError(f"Kolom wajib tidak ada: {missing}. Wajib: {REQUIRED_COLS}")

    return [row for row in reader]
