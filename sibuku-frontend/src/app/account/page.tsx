/* eslint-disable react-hooks/set-state-in-effect */
"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LayoutDashboard, Store, User2, CreditCard, ShoppingCart, PackageOpen } from "lucide-react";

import Card from "@/components/ui/card";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import Reveal from "@/components/ui/reveal";
import { useToast } from "@/components/ui/toast";

type Profile = {
  id_user: number;
  nama: string;
  email: string;
  role?: string;
  is_admin?: boolean;
  no_hp?: string | null;
  alamat?: string | null;

  // ✅ avatar
  avatar_url?: string | null;
};

type HttpError = Error & { status?: number; data?: any };

function normalizeProfile(x: any): Profile | null {
  if (!x) return null;
  if (x?.email && x?.nama) return x as Profile;
  if (x?.data?.email && x?.data?.nama) return x.data as Profile;
  return null;
}

function pickRole(p?: Profile | null) {
  const raw = String(p?.role ?? "").toLowerCase().trim();
  if (p?.is_admin === true) return "admin";
  if (raw === "admin" || raw === "superadmin") return "admin";
  return raw || "customer";
}

async function fetchJson<T = any>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    cache: "no-store",
    credentials: "include",
    ...init,
  });

  // ✅ handle 204 body kosong
  if (res.status === 204) return null as T;

  const text = await res.text().catch(() => "");
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text || null;
  }

  if (!res.ok) {
    const err = new Error(
      data?.detail || data?.message || (typeof data === "string" ? data : "") || `Request gagal (${res.status})`
    ) as HttpError;
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data as T;
}

async function fetchProfile(): Promise<Profile> {
  const data = await fetchJson("/api/users/profile");
  const p = normalizeProfile(data);
  if (!p) throw new Error("Format data profile tidak sesuai");
  return p;
}

async function patchProfile(payload: Partial<Profile>) {
  return fetchJson("/api/users/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

// role switch: customer <-> admin (mode jual)
async function patchRole(role: "customer" | "admin") {
  return fetchJson("/api/users/role", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  });
}

/* ---------------- ecommerce helpers ---------------- */

type CartSummary = { total_qty?: number; total_price?: number };
type OrderAny = any;

function norm(s: any) {
  return String(s ?? "").toLowerCase().trim();
}
function isUnpaid(o: any) {
  const pay = norm(o?.status_pembayaran?.nama_status);
  return pay.includes("menunggu") || pay.includes("pending") || pay.includes("belum");
}
function isProcessing(o: any) {
  const st = norm(o?.status_order?.nama_status);
  return st.includes("diproses") || st.includes("proses");
}
function isShipping(o: any) {
  const st = norm(o?.status_order?.nama_status);
  return st.includes("dikirim") || st.includes("siap kirim") || st.includes("siap dikirim") || st.includes("shipping");
}
function isDone(o: any) {
  const st = norm(o?.status_order?.nama_status);
  const pay = norm(o?.status_pembayaran?.nama_status);
  return st.includes("selesai") || pay.includes("lunas");
}
function isCancel(o: any) {
  const st = norm(o?.status_order?.nama_status);
  const pay = norm(o?.status_pembayaran?.nama_status);
  return st.includes("batal") || st.includes("dibatalkan") || pay.includes("gagal");
}
function getOrderId(o: any): string {
  const raw = o?.id_order ?? o?.id ?? "";
  return String(raw ?? "").trim();
}
function normalizeArrayAny(x: any): any[] {
  if (Array.isArray(x)) return x;
  if (x && Array.isArray(x.data)) return x.data;
  if (x?.data?.data && Array.isArray(x.data.data)) return x.data.data;
  if (x?.results && Array.isArray(x.results)) return x.results;
  return [];
}

/** coba ambil cart summary dari endpoint paling umum tanpa bikin error kalau beda */
async function fetchCartSummarySmart(): Promise<CartSummary> {
  // 1) jika kamu punya route /api/cart-summary (sering dipakai di app)
  try {
    const s = await fetchJson<CartSummary>("/api/cart-summary");
    if (s && (typeof s.total_qty === "number" || typeof s.total_price === "number")) return s;
  } catch (e: any) {
    if (e?.status !== 404) {
      // ignore, fallback ke /api/cart
    }
  }

  // 2) fallback: hitung dari /api/cart
  try {
    const cart = await fetchJson<any>("/api/cart");
    const total_qty = Number(cart?.summary?.total_qty ?? 0);
    const total_price = Number(cart?.summary?.total_price ?? 0);
    return { total_qty, total_price };
  } catch {
    return { total_qty: 0, total_price: 0 };
  }
}

async function fetchOrdersSmart(): Promise<OrderAny[]> {
  const data = await fetchJson<any>("/api/orders");
  return normalizeArrayAny(data);
}

/** ecommerce: normalisasi input hp (aman, tidak maksa) */
function normalizePhoneInput(v: string) {
  const raw = String(v ?? "");
  const cleaned = raw.replace(/[^\d+]/g, "");
  if (cleaned.startsWith("+62")) return "0" + cleaned.slice(3);
  if (cleaned.startsWith("62")) return "0" + cleaned.slice(2);
  return cleaned;
}

function RolePill({ role }: { role: string }) {
  const isAdmin = role === "admin";
  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs ring-1",
        isAdmin ? "bg-indigo-500/15 text-indigo-200 ring-indigo-500/30" : "bg-white/5 text-white/70 ring-white/10",
      ].join(" ")}
    >
      {isAdmin ? "Admin / Penjual" : "User / Pembeli"}
    </span>
  );
}

/* ---------------- page ---------------- */

export default function AccountPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useToast();

  const {
    data: profile,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["profile"],
    queryFn: fetchProfile,
    retry: false,
    staleTime: 20_000,
    refetchOnWindowFocus: false,
  });

  // Redirect kalau 401/403
  useEffect(() => {
    const s = (error as HttpError | undefined)?.status;
    if (s === 401 || s === 403) {
      router.replace(`/login?next=${encodeURIComponent("/account")}`);
    }
  }, [error, router]);

  const role = useMemo(() => pickRole(profile), [profile]);
  const isAdmin = role === "admin";

  const [nama, setNama] = useState("");
  const [noHp, setNoHp] = useState("");
  const [alamat, setAlamat] = useState("");
  const [lastSavedAt, setLastSavedAt] = useState<string>("");

  // ✅ Avatar states
  const [avatarUrl, setAvatarUrl] = useState<string>("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarObjectUrl, setAvatarObjectUrl] = useState<string>("");
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  // Prefill aman: hanya isi kalau field kosong (biar tidak nimpa input user)
  useEffect(() => {
    if (!profile) return;
    setNama((prev) => (prev.trim() ? prev : profile.nama || ""));
    setNoHp((prev) => (prev.trim() ? prev : profile.no_hp || ""));
    setAlamat((prev) => (prev.trim() ? prev : profile.alamat || ""));

    // avatar dari server (jangan override kalau user sedang pilih file)
    if (!avatarFile) setAvatarUrl(profile.avatar_url || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  // preview object url (aman)
  useEffect(() => {
    if (!avatarFile) {
      setAvatarObjectUrl("");
      return;
    }
    const u = URL.createObjectURL(avatarFile);
    setAvatarObjectUrl(u);
    return () => {
      try {
        URL.revokeObjectURL(u);
      } catch {
        /* ignore */
      }
    };
  }, [avatarFile]);

  const avatarShown = avatarObjectUrl || avatarUrl;

  const serverNama = (profile?.nama ?? "").trim();
  const serverHp = (profile?.no_hp ?? "").trim();
  const serverAlamat = (profile?.alamat ?? "").trim();

  const inputNama = nama.trim();
  const inputHp = noHp.trim();
  const inputAlamat = alamat.trim();

  const dirty = useMemo(() => {
    if (!profile) return false;
    return inputNama !== serverNama || inputHp !== serverHp || inputAlamat !== serverAlamat;
  }, [profile, inputNama, inputHp, inputAlamat, serverNama, serverHp, serverAlamat]);

  // validasi sederhana tapi jelas
  const namaErr = useMemo(() => {
    if (!profile) return "";
    if (!inputNama) return "Nama wajib diisi.";
    if (inputNama.length < 2) return "Nama minimal 2 karakter.";
    return "";
  }, [profile, inputNama]);

  const hpErr = useMemo(() => {
    if (!profile) return "";
    if (!inputHp) return ""; // optional
    if (inputHp.length < 8) return "No HP minimal 8 digit.";
    if (!/^0\d{7,15}$/.test(inputHp.replace(/\s+/g, ""))) return "Format No HP tidak valid (contoh: 08xxxxxxxxxx).";
    return "";
  }, [profile, inputHp]);

  const alamatErr = useMemo(() => {
    if (!profile) return "";
    if (!inputAlamat) return ""; // optional tapi disarankan
    if (inputAlamat.length < 8) return "Alamat minimal 8 karakter.";
    return "";
  }, [profile, inputAlamat]);

  const canSave = useMemo(() => {
    if (!profile) return false;
    if (!dirty) return false;
    if (namaErr) return false;
    if (hpErr) return false;
    if (alamatErr) return false;
    return true;
  }, [profile, dirty, namaErr, hpErr, alamatErr]);

  const mutProfile = useMutation({
    mutationFn: () =>
      patchProfile({
        nama: inputNama,
        no_hp: inputHp || null,
        alamat: inputAlamat || null,
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["profile"] });
      await qc.invalidateQueries({ queryKey: ["me"] });
      await qc.invalidateQueries({ queryKey: ["cart-summary"] });
      setLastSavedAt(new Date().toISOString());
      toast({ variant: "success", title: "Tersimpan", message: "Profil berhasil diupdate." });
    },
    onError: (e: any) => {
      const s = e?.status as number | undefined;
      if (s === 401 || s === 403) {
        router.replace(`/login?next=${encodeURIComponent("/account")}`);
        return;
      }
      toast({ variant: "error", title: "Gagal", message: e?.message || "Gagal update profil" });
    },
  });

  const mutRole = useMutation({
    mutationFn: (nextRole: "customer" | "admin") => patchRole(nextRole),
    onSuccess: async (_data, nextRole) => {
      await qc.invalidateQueries({ queryKey: ["profile"] });
      await qc.invalidateQueries({ queryKey: ["me"] });
      toast({
        variant: "success",
        title: "Role diupdate",
        message: nextRole === "admin" ? "Mode Jual/Admin aktif." : "Kembali ke Mode User/Pembeli.",
      });
    },
    onError: (e: any) => {
      toast({
        variant: "error",
        title: "Gagal ubah role",
        message: e?.message || "Pastikan users/role sudah ada.",
      });
    },
  });

  // ✅ Upload avatar mutation (FormData)
  const mutAvatarUpload = useMutation({
    mutationFn: async () => {
      if (!avatarFile) throw new Error("Pilih foto dulu.");

      const allowed = ["image/jpeg", "image/png", "image/webp"];
      if (!allowed.includes(avatarFile.type)) throw new Error("File harus JPG/PNG/WEBP.");
      if (avatarFile.size > 2 * 1024 * 1024) throw new Error("Ukuran maksimal 2MB.");

      const fd = new FormData();
      fd.append("file", avatarFile);

      const res = await fetch("/api/users/profile/avatar", {
        method: "POST",
        body: fd,
        credentials: "include",
      });

      const text = await res.text().catch(() => "");
      let data: any = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = text || null;
      }

      if (!res.ok) {
        throw new Error(data?.detail || data?.message || (typeof data === "string" ? data : "") || `Upload gagal (${res.status})`);
      }

      return data;
    },
    onSuccess: async (data: any) => {
      // optimistik: ambil avatar_url dari response jika ada
      const nextUrl =
        data?.data?.avatar_url ??
        data?.avatar_url ??
        data?.data?.data?.avatar_url ??
        "";

      setAvatarFile(null);
      if (typeof nextUrl === "string" && nextUrl.trim()) setAvatarUrl(nextUrl.trim());

      await qc.invalidateQueries({ queryKey: ["profile"] });
      await qc.invalidateQueries({ queryKey: ["me"] });

      toast({ variant: "success", title: "Berhasil", message: "Foto profil diperbarui." });

      // reset input file supaya bisa pilih file yang sama lagi
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    },
    onError: (e: any) => {
      toast({ variant: "error", title: "Gagal", message: e?.message || "Gagal upload avatar" });
    },
  });

  // ✅ Delete avatar (optional) — butuh route DELETE /api/users/profile/avatar
  const mutAvatarDelete = useMutation({
    mutationFn: async () => {
      return await fetchJson("/api/users/profile/avatar", { method: "DELETE" });
    },
    onSuccess: async () => {
      setAvatarFile(null);
      setAvatarUrl("");
      if (avatarInputRef.current) avatarInputRef.current.value = "";

      await qc.invalidateQueries({ queryKey: ["profile"] });
      await qc.invalidateQueries({ queryKey: ["me"] });

      toast({ variant: "success", title: "Terhapus", message: "Foto profil dihapus." });
    },
    onError: (e: any) => {
      toast({ variant: "error", title: "Gagal", message: e?.message || "Gagal hapus avatar" });
    },
  });

  function resetFormToServer() {
    if (!profile) return;
    setNama(profile.nama || "");
    setNoHp(profile.no_hp || "");
    setAlamat(profile.alamat || "");
  }

  // ✅ Auto-save ecommerce: simpan saat user keluar dari field (onBlur), tapi cuma kalau valid + dirty
  const autoSaveLock = useRef(false);
  async function tryAutoSave() {
    if (!profile) return;
    if (!dirty) return;
    if (!canSave) return;
    if (mutProfile.isPending) return;
    if (autoSaveLock.current) return;

    autoSaveLock.current = true;
    try {
      await mutProfile.mutateAsync();
    } finally {
      setTimeout(() => {
        autoSaveLock.current = false;
      }, 600);
    }
  }

  // ✅ Smart summary (cart + orders) untuk shortcut ecommerce
  const { data: cartSum } = useQuery({
    queryKey: ["cart-summary"],
    queryFn: fetchCartSummarySmart,
    retry: false,
    staleTime: 10_000,
    refetchOnWindowFocus: false,
    enabled: !!profile,
  });

  const { data: ordersRaw } = useQuery({
    queryKey: ["orders"],
    queryFn: fetchOrdersSmart,
    retry: false,
    staleTime: 10_000,
    refetchOnWindowFocus: false,
    enabled: !!profile,
  });

  const orders = useMemo(() => (Array.isArray(ordersRaw) ? ordersRaw : []), [ordersRaw]);
  const unpaidOrders = useMemo(() => orders.filter((o) => isUnpaid(o) && !isCancel(o)), [orders]);
  const processingOrders = useMemo(() => orders.filter((o) => isProcessing(o)), [orders]);
  const shippingOrders = useMemo(() => orders.filter((o) => isShipping(o)), [orders]);

  const cartQty = Number(cartSum?.total_qty ?? 0);
  const firstUnpaidId = useMemo(() => {
    const o = unpaidOrders[0];
    const id = o ? getOrderId(o) : "";
    return id;
  }, [unpaidOrders]);

  const primaryCta = useMemo(() => {
    if (firstUnpaidId) return { href: `/orders/${firstUnpaidId}#payment`, label: "Bayar Sekarang", icon: <CreditCard size={16} /> };
    if (cartQty > 0) return { href: "/checkout", label: "Ke Checkout", icon: <ShoppingCart size={16} /> };
    return { href: "/books", label: "Belanja Sekarang", icon: <PackageOpen size={16} /> };
  }, [firstUnpaidId, cartQty]);

  function formatSavedTime(iso: string) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" }).format(d);
  }

  const avatarBusy = mutAvatarUpload.isPending || mutAvatarDelete.isPending;

  return (
    <div className="container py-10">
      <Reveal>
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black">Akun Saya</h1>
            <p className="text-white/60 mt-1">Update profil untuk mempermudah checkout & pengiriman.</p>
          </div>

          <div className="hidden md:flex gap-2">
            <Link href="/orders">
              <Button variant="secondary">Pesanan</Button>
            </Link>
            <Link href="/cart">
              <Button variant="secondary">Keranjang</Button>
            </Link>
          </div>
        </div>
      </Reveal>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
        {/* LEFT */}
        <Card>
          {isLoading ? (
            <div className="animate-pulse">
              <div className="h-4 w-40 bg-white/5 rounded" />
              <div className="h-10 bg-white/5 rounded mt-4" />
              <div className="h-10 bg-white/5 rounded mt-3" />
              <div className="h-24 bg-white/5 rounded mt-3" />
              <div className="h-10 bg-white/5 rounded mt-4" />
            </div>
          ) : isError || !profile ? (
            <div>
              <div className="font-semibold text-rose-200">Tidak bisa memuat profil</div>
              <div className="text-sm text-white/60 mt-1">
                {(error as Error)?.message || "Pastikan kamu sudah login (token cookie tersimpan)."}
              </div>
              <div className="mt-4">
                <Link href="/login">
                  <Button>Login</Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid gap-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm text-white/60">Role</div>
                  <div className="mt-1">
                    <RolePill role={role} />
                  </div>
                </div>

                {isAdmin ? (
                  <Link href="/admin">
                    <Button variant="secondary" className="gap-2">
                      <LayoutDashboard size={16} />
                      Dashboard
                    </Button>
                  </Link>
                ) : null}
              </div>

              {/* ✅ Avatar block */}
              <div className="mt-2 flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="h-16 w-16 rounded-2xl overflow-hidden bg-slate-950/40 border border-white/10 grid place-items-center shrink-0">
                  {avatarShown ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={avatarShown} alt="Avatar" className="h-full w-full object-cover" />
                  ) : (
                    <div className="text-xl font-black text-white/70">
                      {(profile.nama || "U").slice(0, 1).toUpperCase()}
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">Foto Profil</div>
                  <div className="text-xs text-white/60 mt-1">JPG/PNG/WEBP • max 2MB</div>

                  <div className="mt-2 flex flex-wrap gap-2">
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;

                        const allowed = ["image/jpeg", "image/png", "image/webp"];
                        if (!allowed.includes(f.type)) {
                          toast({ variant: "error", title: "Format salah", message: "File harus JPG/PNG/WEBP." });
                          e.currentTarget.value = "";
                          return;
                        }
                        if (f.size > 2 * 1024 * 1024) {
                          toast({ variant: "error", title: "Kebesaran", message: "Maksimal ukuran 2MB." });
                          e.currentTarget.value = "";
                          return;
                        }

                        setAvatarFile(f);
                      }}
                    />

                    <Button
                      variant="secondary"
                      type="button"
                      disabled={avatarBusy}
                      onClick={() => avatarInputRef.current?.click()}
                    >
                      Pilih Foto
                    </Button>

                    <Button
                      type="button"
                      disabled={!avatarFile || avatarBusy}
                      onClick={() => mutAvatarUpload.mutate()}
                    >
                      {mutAvatarUpload.isPending ? "Mengupload..." : "Upload"}
                    </Button>

                    {avatarUrl ? (
                      <Button
                        type="button"
                        variant="ghost"
                        className="text-rose-200 hover:bg-rose-500/10"
                        disabled={avatarBusy}
                        onClick={() => {
                          const ok = window.confirm("Hapus foto profil?");
                          if (!ok) return;
                          mutAvatarDelete.mutate();
                        }}
                      >
                        Hapus
                      </Button>
                    ) : null}

                    {avatarFile ? (
                      <Button
                        type="button"
                        variant="ghost"
                        className="text-white/70"
                        disabled={avatarBusy}
                        onClick={() => {
                          setAvatarFile(null);
                          if (avatarInputRef.current) avatarInputRef.current.value = "";
                        }}
                      >
                        Batal
                      </Button>
                    ) : null}
                  </div>

                  <div className="text-[11px] text-white/45 mt-2">
                    {avatarFile ? "Preview aktif. Klik Upload untuk menyimpan." : "Foto tersimpan akan tampil di header/akun (jika kamu pakai di UI)."}
                  </div>
                </div>
              </div>

              <div className="text-sm text-white/60 mt-2">Email (readonly)</div>
              <Input value={profile.email} readOnly />

              <div className="text-sm text-white/60 mt-2">Nama</div>
              <Input
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                onBlur={tryAutoSave}
                placeholder="Nama lengkap"
              />
              {namaErr ? <div className="text-xs text-rose-200 -mt-1">{namaErr}</div> : null}

              <div className="text-sm text-white/60 mt-2">No HP</div>
              <Input
                value={noHp}
                onChange={(e) => setNoHp(normalizePhoneInput(e.target.value))}
                onBlur={tryAutoSave}
                placeholder="08xxxxxxxxxx"
                inputMode="numeric"
              />
              {hpErr ? <div className="text-xs text-rose-200 -mt-1">{hpErr}</div> : null}

              <div className="text-sm text-white/60 mt-2">Alamat</div>
              <textarea
                value={alamat}
                onChange={(e) => setAlamat(e.target.value)}
                onBlur={tryAutoSave}
                placeholder="Alamat pengiriman (contoh: jalan, nomor, RT/RW, kecamatan, kota)"
                className="w-full min-h-[88px] rounded-xl bg-white/5 border border-white/10 px-4 py-2 text-sm text-white/80 outline-none focus:ring-2 focus:ring-indigo-500/40"
              />
              {alamatErr ? <div className="text-xs text-rose-200 -mt-1">{alamatErr}</div> : null}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3">
                <Button className="w-full" disabled={mutProfile.isPending || !canSave} onClick={() => mutProfile.mutate()}>
                  {mutProfile.isPending ? "Menyimpan..." : dirty ? "Simpan Perubahan" : "Tersimpan"}
                </Button>

                <Button variant="secondary" className="w-full" disabled={mutProfile.isPending || !dirty} onClick={resetFormToServer}>
                  Batalkan
                </Button>
              </div>

              <div className="text-xs text-white/50 mt-2 flex flex-wrap gap-x-3 gap-y-1">
                <span>Nama wajib.</span>
                <span>No HP & alamat disarankan untuk checkout cepat.</span>
                {lastSavedAt ? <span className="text-white/40">• Terakhir tersimpan: {formatSavedTime(lastSavedAt)}</span> : null}
              </div>
            </div>
          )}
        </Card>

        {/* RIGHT */}
        <Card>
          <div className="font-semibold">Mode & Shortcut</div>

          <div className="mt-3 grid gap-2">
            {/* smart stats ecommerce */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="text-sm font-semibold">Ringkasan Cepat</div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-xl border border-white/10 bg-slate-950/30 p-2">
                  <div className="text-white/50">Keranjang</div>
                  <div className="text-white/90 font-extrabold">{cartQty}</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-slate-950/30 p-2">
                  <div className="text-white/50">Belum bayar</div>
                  <div className="text-amber-200 font-extrabold">{unpaidOrders.length}</div>
                </div>
                <div className="rounded-xl border border-white/10 bg-slate-950/30 p-2">
                  <div className="text-white/50">Diproses</div>
                  <div className="text-sky-200 font-extrabold">{processingOrders.length + shippingOrders.length}</div>
                </div>
              </div>

              <div className="mt-3">
                <Link href={primaryCta.href}>
                  <Button className="w-full gap-2">
                    {primaryCta.icon}
                    {primaryCta.label}
                  </Button>
                </Link>
                <div className="text-[11px] text-white/50 mt-2">
                  Tombol ini otomatis menyesuaikan: unpaid → checkout → belanja.
                </div>
              </div>
            </div>

            {/* mode switch ecommerce */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="text-sm font-semibold flex items-center gap-2">
                {isAdmin ? <Store size={16} /> : <User2 size={16} />}
                {isAdmin ? "Mode Jual (Admin)" : "Mode Belanja (User)"}
              </div>
              <div className="text-xs text-white/60 mt-1">
                {isAdmin
                  ? "Kamu bisa kelola buku di dashboard. Kamu tetap bisa belanja seperti user."
                  : "Aktifkan Mode Jual kalau ingin mengelola & menjual buku."}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {!isAdmin ? (
                  <Button className="gap-2" disabled={mutRole.isPending || isLoading || !profile} onClick={() => mutRole.mutate("admin")}>
                    <Store size={16} />
                    Aktifkan Mode Jual
                  </Button>
                ) : (
                  <>
                    <Link href="/admin">
                      <Button variant="secondary" className="gap-2">
                        <LayoutDashboard size={16} />
                        Buka Dashboard
                      </Button>
                    </Link>

                    <Button
                      variant="ghost"
                      className="gap-2 text-white/70"
                      disabled={mutRole.isPending || isLoading || !profile}
                      onClick={() => {
                        const ok = window.confirm("Kembalikan akun jadi User/Pembeli?\n\nCatatan: kamu akan kehilangan akses admin.");
                        if (ok) mutRole.mutate("customer");
                      }}
                      title="Opsional"
                    >
                      <User2 size={16} />
                      Jadikan User
                    </Button>
                  </>
                )}
              </div>
            </div>

            {/* shortcuts */}
            <div className="grid gap-2">
              <Link href="/cart">
                <Button variant="secondary" className="w-full">Ke Keranjang</Button>
              </Link>
              <Link href="/orders">
                <Button variant="secondary" className="w-full">Riwayat Pesanan</Button>
              </Link>
              <Link href="/books">
                <Button variant="secondary" className="w-full">Belanja Lagi</Button>
              </Link>
            </div>
          </div>

          <div className="text-xs text-white/50 mt-4">
            Profil + alamat dipakai otomatis di checkout. Auto-save aktif saat kamu selesai edit (keluar dari field).
          </div>
        </Card>
      </div>
    </div>
  );
}