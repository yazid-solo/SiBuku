import os

try:
    # ✅ normal (struktur kamu: CMS_Project_Backend/app/main.py)
    from app.main import app as asgi_app
except ImportError:
    # ✅ fallback kalau run dari root berbeda
    from main import app as asgi_app  # type: ignore


# ✅ Vercel: cukup expose ASGI app langsung
app = asgi_app

# ✅ Kalau suatu saat dipakai di AWS Lambda, baru bungkus pakai Mangum
if os.getenv("AWS_LAMBDA_FUNCTION_NAME"):
    from mangum import Mangum  # pyright: ignore[reportMissingImports]
    handler = Mangum(asgi_app)
else:
    # alias supaya config lama yang nyari "handler" tetap aman
    handler = asgi_app