from typing import Optional, Dict, Any
from app.database import supabase


def log_event(
    actor: Optional[dict],
    action: str,
    entity: Optional[str] = None,
    entity_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None
) -> None:
    """
    Simpan audit log. Fail-safe: kalau gagal log, jangan gagalkan endpoint utama.
    """
    try:
        payload = {
            "actor_id": actor.get("id_user") if actor else None,
            "actor_email": actor.get("email") if actor else None,
            "actor_role": actor.get("role") if actor else None,
            "action": action,
            "entity": entity,
            "entity_id": str(entity_id) if entity_id is not None else None,
            "metadata": metadata or {}
        }
        supabase.table("audit_logs").insert(payload).execute()
    except Exception:
        pass
