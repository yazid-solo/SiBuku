# CMS_Project_Backend/api/index.py

try:
    from app.main import app  # FastAPI instance
except ImportError:
    from main import app  # fallback kalau dijalankan beda path