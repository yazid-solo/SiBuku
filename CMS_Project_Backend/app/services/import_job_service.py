from typing import List, Dict, Any
from app.database import supabase
from app.services.book_import_service import import_books_from_rows

def create_job(job_type: str, filename: str, total: int) -> int:
    res = supabase.table("import_jobs").insert({
        "type": job_type,
        "filename": filename,
        "status": "queued",
        "total": total,
        "success": 0,
        "failed": 0,
        "errors": []
    }).execute()
    return res.data[0]["id"]

def update_job(job_id: int, **fields):
    supabase.table("import_jobs").update(fields).eq("id", job_id).execute()

def run_books_import_job(job_id: int, rows: List[Dict[str, Any]]):
    # set running
    update_job(job_id, status="running", total=len(rows))

    try:
        success, failed, errors = import_books_from_rows(rows)
        update_job(
            job_id,
            status="done",
            success=success,
            failed=failed,
            errors=errors[:200]  # batasi agar tidak kebesaran
        )
    except Exception as e:
        update_job(job_id, status="failed", errors=[{"error": str(e)}])
