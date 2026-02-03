from typing import Dict

def clamp(n: int, min_n: int, max_n: int) -> int:
    return max(min_n, min(n, max_n))

def get_range(page: int, limit: int, max_limit: int = 100) -> Dict[str, int]:
    """
    Supabase range is inclusive: range(start, end)
    """
    page = clamp(page, 1, 10**9)
    limit = clamp(limit, 1, max_limit)
    start = (page - 1) * limit
    end = start + limit - 1
    return {"page": page, "limit": limit, "start": start, "end": end}
