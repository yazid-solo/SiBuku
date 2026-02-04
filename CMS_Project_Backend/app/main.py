import os
import uvicorn
from dotenv import load_dotenv

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

from app.routers import auth, books, orders, authors, users, cart, admin  # noqa: E402

APP_TITLE = os.getenv("APP_TITLE", "CMS E-Commerce Buku")
APP_VERSION = os.getenv("APP_VERSION", "1.0.0")
APP_DESCRIPTION = os.getenv("APP_DESCRIPTION", "API Backend CMS Toko Buku (FastAPI + Supabase)")

openapi_tags = [
    {"name": "General", "description": "General endpoints"},
    {"name": "Auth", "description": "Login, register, dan sesi user"},
    {"name": "Users", "description": "Profil user"},
    {"name": "Books", "description": "Katalog buku & master dropdown untuk frontend"},
    {"name": "Orders", "description": "Checkout & riwayat pesanan"},
    {"name": "Cart", "description": "Keranjang belanja"},
    {"name": "Authors", "description": "Master penulis (read-only publik, CRUD via admin)"},
    {"name": "Admin Dashboard", "description": "Fitur admin: stats, master data, import, upload cover/foto, audit"},
    {"name": "Admin - Books", "description": "CMS buku (CRUD, bulk update, toggle)"},
]

app = FastAPI(
    title=APP_TITLE,
    description=APP_DESCRIPTION,
    version=APP_VERSION,
    openapi_tags=openapi_tags,
)

# CORS
origins_env = os.getenv("FRONTEND_ORIGINS", "*").strip()
if origins_env == "*" or origins_env == "":
    origins = ["*"]
    allow_credentials = False
else:
    origins = [o.strip() for o in origins_env.split(",") if o.strip()]
    allow_credentials = True

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(cart.router)
app.include_router(orders.router)
app.include_router(books.router)
app.include_router(authors.router)
app.include_router(admin.router)


@app.get("/", tags=["General"])
def read_root():
    return {
        "message": "Server API CMS Buku berjalan",
        "docs_url": "/docs",
        "redoc_url": "/redoc",
        "database": "Supabase",
        "cors_origins": origins if origins != ["*"] else ["* (dev)"],
        "allow_credentials": allow_credentials,
        "version": APP_VERSION,
    }


@app.get("/health", tags=["General"])
def health():
    return {"status": "ok"}


if __name__ == "__main__":
    # ✅ FIX: karena file ini ada di app/main.py, module path yang benar adalah "app.main:app"
    uvicorn.run(
        "app.main:app",
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", "8000")),
        reload=True,
    )