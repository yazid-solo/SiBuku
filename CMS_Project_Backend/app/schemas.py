# app/schemas.py
from datetime import datetime
from typing import Optional, List, Dict, Any

from pydantic import BaseModel, EmailStr, Field

try:
    from pydantic import ConfigDict  # pydantic v2
except Exception:
    ConfigDict = None  # type: ignore


class BaseSchema(BaseModel):
    if ConfigDict is not None:
        model_config = ConfigDict(from_attributes=True, extra="ignore", populate_by_name=True)
    else:
        class Config:
            from_attributes = True
            extra = "ignore"
            allow_population_by_field_name = True


# ===========================
# AUTH
# ===========================
class LoginRequest(BaseSchema):
    email: EmailStr
    password: str


class RegisterRequest(BaseSchema):
    nama: str
    email: EmailStr
    password: str
    no_hp: Optional[str] = None
    alamat: Optional[str] = None


class AuthUser(BaseSchema):
    # bisa terima "id" atau "id_user"
    id_user: int = Field(..., alias="id")
    nama: str
    email: EmailStr
    role: str
    avatar_url: Optional[str] = None


class TokenResponse(BaseSchema):
    access_token: str
    token_type: str = "bearer"
    user: AuthUser


# ===========================
# USER
# ===========================
class UserResponse(BaseSchema):
    id_user: int
    nama: str
    email: EmailStr
    role: str
    no_hp: Optional[str] = None
    alamat: Optional[str] = None
    avatar_url: Optional[str] = None
    is_active: Optional[bool] = True
    last_login: Optional[datetime] = None
    created_at: Optional[datetime] = None


# ===========================
# MASTER DATA
# ===========================
class GenreResponse(BaseSchema):
    id_genre: int
    nama_genre: str
    deskripsi_genre: Optional[str] = None
    slug: Optional[str] = None


class PenulisResponse(BaseSchema):
    id_penulis: int
    nama_penulis: str
    biografi: Optional[str] = None
    foto_penulis: Optional[str] = None


class PaymentMethodResponse(BaseSchema):
    id_jenis_pembayaran: int
    nama_pembayaran: str
    keterangan: Optional[str] = None
    is_active: bool = True


class StatusOrderResponse(BaseSchema):
    id_status_order: int
    nama_status: str
    urutan_status: Optional[int] = None


class StatusPembayaranResponse(BaseSchema):
    id_status_pembayaran: int
    nama_status: str


# ===========================
# BOOKS
# ===========================
class BookBase(BaseSchema):
    judul: str
    isbn: Optional[str] = Field(default=None, max_length=20)

    harga: float = Field(..., ge=0)
    stok: int = Field(..., ge=0)

    berat: Optional[float] = Field(default=None, ge=0)
    deskripsi: Optional[str] = None
    cover_image: Optional[str] = None

    status: Optional[str] = Field(default="aktif", description="aktif / nonaktif")


class BookCreate(BookBase):
    id_genre: int
    id_penulis: int


class BookUpdate(BaseSchema):
    judul: Optional[str] = None
    isbn: Optional[str] = Field(default=None, max_length=20)
    harga: Optional[float] = Field(default=None, ge=0)
    stok: Optional[int] = Field(default=None, ge=0)
    berat: Optional[float] = Field(default=None, ge=0)
    deskripsi: Optional[str] = None
    cover_image: Optional[str] = None
    status: Optional[str] = Field(default=None, description="aktif / nonaktif")
    id_genre: Optional[int] = None
    id_penulis: Optional[int] = None


class BookResponse(BookBase):
    id_buku: int
    id_genre: Optional[int] = None
    id_penulis: Optional[int] = None
    penulis: Optional[PenulisResponse] = None
    genre: Optional[GenreResponse] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


# ===========================
# CART (sesuai SQL: keranjang, keranjang_item)
# ===========================
class CartItemInput(BaseSchema):
    id_buku: int
    jumlah: int = Field(..., ge=1)


class CartBookInfo(BaseSchema):
    judul: Optional[str] = None
    harga: Optional[float] = None
    cover_image: Optional[str] = None
    berat: Optional[float] = None
    status: Optional[str] = None


class CartItemResponse(BaseSchema):
    id_keranjang_item: int
    id_keranjang: int
    id_buku: int
    jumlah: int
    harga_satuan: float
    subtotal: float
    created_at: Optional[datetime] = None
    buku: Optional[CartBookInfo] = None


class CartSummary(BaseSchema):
    total_qty: int
    total_price: float


class CartResponse(BaseSchema):
    id_keranjang: Optional[int] = None
    status_keranjang: Optional[str] = None
    created_at: Optional[datetime] = None
    summary: CartSummary = Field(default_factory=lambda: CartSummary(total_qty=0, total_price=0))
    items: List[CartItemResponse] = Field(default_factory=list)


class MessageResponse(BaseSchema):
    message: str


# ===========================
# ORDERS (sesuai SQL: orders, order_item)
# ===========================
class CheckoutRequest(BaseSchema):
    alamat_pengiriman: str
    id_jenis_pembayaran: int
    catatan: Optional[str] = None


class StatusRef(BaseSchema):
    nama_status: Optional[str] = None


class OrderItemBookInfo(BaseSchema):
    judul: Optional[str] = None
    cover_image: Optional[str] = None


class OrderItemResponse(BaseSchema):
    id_order_item: int
    id_order: int
    id_buku: int
    jumlah: int
    harga_satuan: float
    subtotal: float
    created_at: Optional[datetime] = None
    buku: Optional[OrderItemBookInfo] = None


class OrderResponse(BaseSchema):
    id_order: int
    kode_order: str
    id_user: int

    tanggal_order: Optional[datetime] = None
    alamat_pengiriman: str

    total_harga: float
    ongkir: float = 0
    catatan: Optional[str] = None

    id_jenis_pembayaran: Optional[int] = None
    id_status_pembayaran: Optional[int] = None
    id_status_order: Optional[int] = None

    status_order: StatusRef = Field(default_factory=StatusRef)
    status_pembayaran: StatusRef = Field(default_factory=StatusRef)

    order_item: List[OrderItemResponse] = Field(default_factory=list)

    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class CheckoutResult(BaseSchema):
    message: str
    id_order: int
    kode_order: str
    total_bayar: float
    status: str


# ===========================
# IMPORT
# ===========================
class BookImportRow(BaseSchema):
    judul: str
    harga: float = Field(..., ge=0)
    stok: int = Field(..., ge=0)

    id_genre: Optional[int] = None
    id_penulis: Optional[int] = None
    nama_genre: Optional[str] = None
    nama_penulis: Optional[str] = None

    berat: Optional[float] = Field(default=None, ge=0)
    deskripsi: Optional[str] = None
    cover_image: Optional[str] = None
    isbn: Optional[str] = Field(default=None, max_length=20)


class BookImportResult(BaseSchema):
    total: int
    success: int
    failed: int
    errors: List[Dict[str, Any]] = Field(default_factory=list)
