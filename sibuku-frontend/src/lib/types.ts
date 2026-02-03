// src/lib/types.ts

/** Helper */
export type ISODateString = string;
export type Nullable<T> = T | null;

/** =========================
 *  AUTH & USER
 *  ========================= */
export type LoginPayload = {
  email: string;
  password: string;
};

export type RegisterPayload = {
  nama: string;
  email: string;
  password: string;
  no_hp?: string;
  alamat?: string;
};

/**
 * Response /auth/login dari backend kamu:
 * {
 *  access_token,
 *  token_type,
 *  user: { id, nama, email, role }
 * }
 */
export type AuthUserLogin = {
  id: number; // backend return "id" (id_user)
  nama: string;
  email: string;
  role: "admin" | "customer" | string;
};

export type TokenResponse = {
  access_token: string;
  token_type: "bearer" | string;
  user: AuthUserLogin;
};

/**
 * Response /auth/me atau /users/profile: ini ambil dari tabel users
 * (password sudah dibuang oleh sanitize_user)
 */
export type MeUser = {
  id_user: number;
  nama: string;
  email: string;
  role: "admin" | "customer" | string;
  no_hp?: Nullable<string>;
  alamat?: Nullable<string>;
  is_active?: boolean;
  last_login?: Nullable<ISODateString>;
  created_at?: Nullable<ISODateString>;
};

export type ProfileUpdatePayload = {
  nama?: string;
  no_hp?: string;
  alamat?: string;
};

/** =========================
 *  MASTER DATA
 *  ========================= */
export type Genre = {
  id_genre: number;
  nama_genre: string;
  deskripsi_genre?: Nullable<string>;
  slug?: Nullable<string>;
};

export type Penulis = {
  id_penulis: number;
  nama_penulis: string;
  biografi?: Nullable<string>;
  foto_penulis?: Nullable<string>;
};

export type PaymentMethod = {
  id_jenis_pembayaran: number;
  nama_pembayaran: string;
  keterangan?: Nullable<string>;
  is_active: boolean;
};

export type StatusRef = {
  nama_status?: Nullable<string>;
};

/** =========================
 *  BOOKS
 *  ========================= */
export type BookStatus = "aktif" | "nonaktif" | string;

export type Book = {
  id_buku: number;
  judul: string;
  isbn?: Nullable<string>;
  harga: number;
  stok: number;
  berat?: Nullable<number>;
  deskripsi?: Nullable<string>;
  cover_image?: Nullable<string>;
  status?: BookStatus;

  // relasi
  id_genre?: Nullable<number>;
  id_penulis?: Nullable<number>;
  genre?: Nullable<Genre>;
  penulis?: Nullable<Penulis>;

  created_at?: Nullable<ISODateString>;
  updated_at?: Nullable<ISODateString>;
};

export type PagingMeta = {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
  sort_by: string;
  order: "asc" | "desc" | string;
};

export type BooksPaged = {
  meta: PagingMeta;
  data: Book[];
};

/** =========================
 *  CART (sesuai /cart)
 *  Backend cart router return:
 *  { cart_id, summary: {total_qty,total_price}, items: [...] }
 *  ========================= */
export type CartBookInfo = {
  judul?: Nullable<string>;
  harga?: Nullable<number>;
  cover_image?: Nullable<string>;
  berat?: Nullable<number>;
  status?: Nullable<string>;
};

export type CartItem = {
  id_keranjang_item: number;
  id_keranjang: number;
  id_buku: number;
  jumlah: number;
  harga_satuan?: Nullable<number>;
  subtotal?: Nullable<number>;
  created_at?: Nullable<ISODateString>;
  buku?: Nullable<CartBookInfo>;
};

export type CartSummary = {
  total_qty: number;
  total_price: number;
};

export type CartView = {
  cart_id: Nullable<number>;
  summary: CartSummary;
  items: CartItem[];
};

export type AddToCartPayload = {
  id_buku: number;
  jumlah: number;
};

export type UpdateCartQtyPayload = {
  jumlah: number;
};

export type MessageResponse = {
  message: string;
};

/** =========================
 *  CHECKOUT / ORDERS
 *  ========================= */
export type CheckoutRequest = {
  alamat_pengiriman: string;
  id_jenis_pembayaran: number;
  catatan?: string;
};

/**
 * Response dari RPC checkout/create_order_atomic:
 * { message, id_order, kode_order, total_bayar, status }
 */
export type CheckoutResult = {
  message: string;
  id_order: number;
  kode_order: string;
  total_bayar: number;
  status: string;
};

/**
 * orders GET di orders.py select:
 * "*, status_order(nama_status), status_pembayaran(nama_status),
 *  order_item(id_buku, jumlah, subtotal, harga_satuan)"
 */
export type OrderItem = {
  id_buku: number;
  jumlah: number;
  subtotal?: Nullable<number>;
  harga_satuan?: Nullable<number>;
};

export type Order = {
  id_status_order: null;
  id_status_pembayaran: null;
  id_order: number;
  kode_order: string;
  total_harga: number;
  created_at?: string | null; // ✅ tambahin null

  status_order?: { nama_status?: string | null } | null;
  status_pembayaran?: { nama_status?: string | null } | null;
  order_item?: Array<{
    id_buku: number;
    jumlah: number;
    subtotal: number;
    harga_satuan: number;
    buku?: { judul?: string | null } | null;
  }> | null;
};


/** =========================
 *  ADMIN (opsional untuk UI admin nanti)
 *  ========================= */
export type AdminDashboardStats = {
  total_user: number;
  total_buku: number;
  total_order: number;
  total_pendapatan: number;
};
