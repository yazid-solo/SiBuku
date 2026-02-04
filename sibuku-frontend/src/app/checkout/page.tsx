/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, RefreshCcw, MapPin, CreditCard, CheckCircle2, ShieldCheck } from "lucide-react";

import Card from "@/components/ui/card";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import Reveal from "@/components/ui/reveal";
import Badge from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";

import type { CartView } from "@/lib/types";
import { formatRupiah } from "@/lib/utils";

/* ---------------- helpers ---------------- */

type HttpErr = Error & { status?: number; data?: any };

function toPlainMessage(detail: any): string {
  if (!detail) return "";
  if (typeof detail === "string") return detail;

  if (Array.isArray(detail)) {
    return detail
      .map((x) => {
        if (!x) return "";
        if (typeof x === "string") return x;
        if (typeof x === "object") {
          const loc = Array.isArray(x.loc) ? x.loc.slice(1).join(".") : String(x.loc ?? "");
          const msg = x.msg ?? JSON.stringify(x);
          return loc ? `${loc}: ${String(msg)}` : String(msg);
        }
        return String(x);
      })
      .filter(Boolean)
      .join(" • ");
  }

  if (typeof detail === "object") {
    const loc = Array.isArray(detail.loc) ? detail.loc.slice(1).join(".") : String(detail.loc ?? "");
    const msg = detail.msg ?? JSON.stringify(detail);
    return loc ? `${loc}: ${String(msg)}` : String(msg);
  }

  return String(detail);
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    cache: "no-store",
    credentials: "include",
    ...init,
  });

  // ✅ handle 204 / body kosong
  if (res.status === 204) return null as T;

  const ct = res.headers.get("content-type") ?? "";
  const text = await res.text().catch(() => "");
  const data =
    ct.includes("application/json") && text
      ? (() => {
          try {
            return JSON.parse(text);
          } catch {
            return null;
          }
        })()
      : text || null;

  if (!res.ok) {
    const msg =
      toPlainMessage((data as any)?.detail) ||
      toPlainMessage((data as any)?.message) ||
      (typeof data === "string" ? data : "") ||
      `Request gagal (${res.status})`;

    const err = new Error(msg) as HttpErr;
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data as T;
}

function normalizeObj<T extends object>(x: any): T | null {
  if (x && typeof x === "object") return x as T;
  if (x?.data && typeof x.data === "object") return x.data as T;
  return null;
}

function getOrderIdFromResponse(x: any): number | null {
  const a =
    x?.id_order ??
    x?.data?.id_order ??
    x?.order?.id_order ??
    x?.data?.order?.id_order ??
    x?.result?.id_order ??
    x?.data?.result?.id_order;

  const n = Number(a);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function getOrderCodeFromResponse(x: any): string | null {
  const c =
    x?.kode_order ??
    x?.data?.kode_order ??
    x?.order?.kode_order ??
    x?.data?.order?.kode_order ??
    x?.result?.kode_order ??
    x?.data?.result?.kode_order;

  const s = String(c ?? "").trim();
  return s ? s : null;
}

function prettyApiError(e: any): string {
  if (typeof e?.message === "string" && e.message.trim()) return e.message.trim();
  const msg = toPlainMessage(e?.data?.detail);
  if (msg) return msg;
  return "Checkout gagal";
}

/** cari array di object sedalam maxDepth */
function findFirstArrayDeep(raw: any, maxDepth = 5): any[] {
  if (Array.isArray(raw)) return raw;
  if (!raw || typeof raw !== "object" || maxDepth <= 0) return [];

  const candidates = [
    raw.data,
    raw.items,
    raw.results,
    raw.payment_methods,
    raw.paymentMethods,
    raw.metode_pembayaran,
    raw.methods,
  ];

  for (const c of candidates) if (Array.isArray(c)) return c;

  for (const v of Object.values(raw)) {
    const got = findFirstArrayDeep(v, maxDepth - 1);
    if (got.length) return got;
  }
  return [];
}

function toBoolActive(v: any): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  const s = String(v ?? "").toLowerCase().trim();
  if (s === "0" || s === "false" || s === "nonaktif" || s === "inactive") return false;
  if (s === "1" || s === "true" || s === "aktif" || s === "active") return true;
  return true;
}

/* ---------------- types ---------------- */

type Profile = {
  nama?: string | null;
  no_hp?: string | null;
  alamat?: string | null;
  email?: string | null;
};

type PaymentMethodNorm = {
  id: number;
  name: string;
  desc?: string;
  active: boolean;
};

function normalizePaymentMethods(raw: any): PaymentMethodNorm[] {
  const arr = findFirstArrayDeep(raw, 6);
  const tmp: PaymentMethodNorm[] = [];

  for (const x of arr) {
    if (!x || typeof x !== "object") continue;

    const id = Number(
      x?.id_jenis_pembayaran ?? x?.id_payment_method ?? x?.id_metode_pembayaran ?? x?.id ?? NaN
    );
    if (!Number.isFinite(id) || id <= 0) continue;

    const name = String(
      x?.nama_pembayaran ?? x?.nama_metode ?? x?.nama ?? x?.name ?? `Metode #${id}`
    ).trim();
    if (!name) continue;

    const desc = String(x?.keterangan ?? x?.deskripsi ?? x?.description ?? x?.desc ?? "").trim();
    const active = toBoolActive(x?.is_active ?? x?.aktif ?? x?.active ?? true);
    if (!active) continue;

    tmp.push({ id, name, desc: desc || undefined, active: true });
  }

  // dedupe by id
  const byId = new Map<number, PaymentMethodNorm>();
  for (const m of tmp) if (!byId.has(m.id)) byId.set(m.id, m);

  // dedupe by name (case-insensitive)
  const byName = new Map<string, PaymentMethodNorm>();
  for (const m of Array.from(byId.values())) {
    const key = m.name.toLowerCase().trim();
    const cur = byName.get(key);
    if (!cur) {
      byName.set(key, m);
      continue;
    }
    const pick = m.id < cur.id ? m : cur;
    const other = pick === m ? cur : m;
    byName.set(key, { ...pick, desc: pick.desc || other.desc, active: true });
  }

  return Array.from(byName.values()).sort((a, b) => {
    const an = a.name.localeCompare(b.name, "id-ID");
    if (an !== 0) return an;
    return a.id - b.id;
  });
}

/* ---------------- instruksi pembayaran ---------------- */

function tryParseJson(s?: string) {
  if (!s) return null;
  const t = s.trim();
  if (!t) return null;
  if (!(t.startsWith("{") || t.startsWith("["))) return null;
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

function extractFirstUrl(text: string): string | null {
  const m = text.match(/https?:\/\/[^\s)"]+/i);
  return m ? m[0] : null;
}

function extractAccountNumber(text: string): string | null {
  const m = text.replace(/\s+/g, " ").match(/(\d{7,20})/);
  return m ? m[1] : null;
}

function PaymentInstruction({ method }: { method: PaymentMethodNorm | null }) {
  const { toast } = useToast();
  if (!method) return null;

  const desc = method.desc?.trim() || "";
  if (!desc) {
    return <div className="mt-3 text-xs text-white/50">Tidak ada instruksi tambahan.</div>;
  }

  const parsed = tryParseJson(desc);

  const qrUrl =
    (parsed?.qr_url || parsed?.qris_url || parsed?.qr || parsed?.qris || null) ??
    (desc.toLowerCase().includes("http") && desc.toLowerCase().includes("qr")
      ? extractFirstUrl(desc)
      : null);

  const acc =
    parsed?.account_number ||
    parsed?.va_number ||
    parsed?.rekening ||
    parsed?.no_rek ||
    extractAccountNumber(desc);

  const bank = String(parsed?.bank || parsed?.bank_name || "").trim();
  const accName = String(parsed?.account_name || parsed?.atas_nama || parsed?.nama_rekening || "").trim();

  const lines = desc
    .split(/\n+/)
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 10);

  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="text-sm font-semibold">Instruksi Pembayaran</div>

      {(bank || accName) && (
        <div className="text-xs text-white/60 mt-1">
          {bank ? <span>{bank}</span> : null}
          {bank && accName ? <span className="mx-2 text-white/30">•</span> : null}
          {accName ? <span>Atas nama: {accName}</span> : null}
        </div>
      )}

      {acc ? (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3">
          <div className="min-w-0">
            <div className="text-[11px] text-white/50">Nomor Rekening / Virtual Account</div>
            <div className="font-semibold text-white/90 break-all">{String(acc)}</div>
          </div>
          <Button
            variant="secondary"
            className="shrink-0 gap-2"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(String(acc));
                toast({ variant: "success", title: "Tersalin", message: "Nomor berhasil dicopy." });
              } catch {
                toast({ variant: "error", title: "Gagal", message: "Tidak bisa akses clipboard." });
              }
            }}
          >
            <Copy size={16} /> Copy
          </Button>
        </div>
      ) : null}

      {qrUrl ? (
        <div className="mt-3">
          <div className="text-[11px] text-white/50 mb-2">QR / QRIS</div>
          <div className="rounded-xl overflow-hidden border border-white/10 bg-slate-950/40 p-3 inline-block">
            <img src={qrUrl} alt="QR Code" className="h-40 w-40 object-contain" />
          </div>
          <div className="text-[11px] text-white/40 mt-2 break-all">{qrUrl}</div>
        </div>
      ) : null}

      {lines.length ? (
        <div className="mt-3 grid gap-1 text-xs text-white/70">
          {lines.map((l, i) => (
            <div key={i}>• {l}</div>
          ))}
        </div>
      ) : null}

      <div className="text-[11px] text-white/40 mt-3">
        *Otomatis dari field <code className="text-white/70">keterangan</code>.
      </div>
    </div>
  );
}

/* ---------------- UI kecil (tanpa ubah logic) ---------------- */

function StepItem({
  icon,
  title,
  desc,
  active,
  done,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  active?: boolean;
  done?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className={[
          "h-10 w-10 rounded-2xl flex items-center justify-center border",
          done
            ? "bg-emerald-500/15 border-emerald-400/20 text-emerald-200"
            : active
            ? "bg-indigo-500/15 border-indigo-400/20 text-indigo-200"
            : "bg-white/5 border-white/10 text-white/60",
        ].join(" ")}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div className="font-semibold text-white/90">{title}</div>
        <div className="text-xs text-white/55 mt-0.5">{desc}</div>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-white/65">{label}</span>
      <span className={strong ? "text-indigo-200 font-extrabold" : "text-white/85 font-semibold"}>{value}</span>
    </div>
  );
}

/* ---------------- API ---------------- */

async function fetchPaymentMethods(): Promise<any> {
  return await fetchJson<any>("/api/payment-methods");
}

async function postCheckout(payload: any): Promise<any> {
  return await fetchJson<any>("/api/cart/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

/* ---------------- Page ---------------- */

const LS_PM = "sibuku_pm_id";

export default function CheckoutPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [nama, setNama] = useState("");
  const [noHp, setNoHp] = useState("");
  const [alamat, setAlamat] = useState("");
  const [catatan, setCatatan] = useState("");
  const [pmId, setPmId] = useState<string>("");

  // load remembered payment method
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_PM);
      if (saved && !pmId) setPmId(saved);
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // save remembered payment method
  useEffect(() => {
    if (!pmId) return;
    try {
      localStorage.setItem(LS_PM, pmId);
    } catch {
      /* ignore */
    }
  }, [pmId]);

  const {
    data: cart,
    isLoading: loadingCart,
    isError: cartErr,
    error: cartError,
    refetch: refetchCart,
    isFetching: fetchingCart,
  } = useQuery({
    queryKey: ["cart"],
    queryFn: () => fetchJson<CartView>("/api/cart"),
    retry: false,
    staleTime: 3_000,
    refetchOnWindowFocus: false,
  });

  const {
    data: profileRaw,
    isLoading: loadingProfile,
    isError: profileErr,
    error: profileError,
  } = useQuery({
    queryKey: ["profile"],
    queryFn: () => fetchJson<any>("/api/users/profile"),
    retry: false,
    staleTime: 20_000,
    refetchOnWindowFocus: false,
  });

  const profile = useMemo(() => normalizeObj<Profile>(profileRaw) ?? null, [profileRaw]);

  // ✅ Prefill aman: hanya isi jika field masih kosong (tidak menimpa input user)
  useEffect(() => {
    if (!profile) return;
    if (!nama.trim() && profile.nama) setNama(profile.nama ?? "");
    if (!noHp.trim() && profile.no_hp) setNoHp(profile.no_hp ?? "");
    if (!alamat.trim() && profile.alamat) setAlamat(profile.alamat ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const {
    data: pmRaw,
    isLoading: loadingPm,
    isError: pmErr,
    error: pmError,
    refetch: refetchPm,
    isFetching: fetchingPm,
  } = useQuery({
    queryKey: ["payment-methods"],
    queryFn: fetchPaymentMethods,
    retry: false,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const paymentMethods = useMemo(() => normalizePaymentMethods(pmRaw), [pmRaw]);

  // ✅ set default pm saat belum ada (setelah load)
  useEffect(() => {
    if (pmId) return;
    if (loadingPm) return;
    if (paymentMethods.length > 0) setPmId(String(paymentMethods[0].id));
  }, [pmId, loadingPm, paymentMethods]);

  const selectedMethod = useMemo(() => {
    const n = Number(pmId);
    if (!Number.isFinite(n)) return null;
    return paymentMethods.find((m) => m.id === n) ?? null;
  }, [pmId, paymentMethods]);

  const items = cart?.items ?? [];
  const totalQty = cart?.summary?.total_qty ?? 0;
  const totalPrice = Number(cart?.summary?.total_price ?? 0);

  const cartUnauthorized =
    (cartError as HttpErr | undefined)?.status === 401 || (cartError as HttpErr | undefined)?.status === 403;

  const profileUnauthorized =
    (profileError as HttpErr | undefined)?.status === 401 || (profileError as HttpErr | undefined)?.status === 403;

  const patchProfileMut = useMutation({
    mutationFn: (payload: Profile) =>
      fetchJson("/api/users/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
  });

  const checkoutMut = useMutation({
    mutationFn: async () => {
      if (items.length === 0) throw new Error("Keranjang kosong.");
      if (!pmId) throw new Error("Pilih metode pembayaran dulu.");
      if (alamat.trim().length < 5) throw new Error("Alamat minimal 5 karakter.");

      // simpan profile kalau berubah (biar next checkout makin auto)
      const nextProfile: Profile = {
        nama: nama.trim() || undefined,
        no_hp: noHp.trim() || undefined,
        alamat: alamat.trim() || undefined,
      };

      const dirty =
        (nextProfile.nama ?? "") !== (profile?.nama ?? "") ||
        (nextProfile.no_hp ?? "") !== (profile?.no_hp ?? "") ||
        (nextProfile.alamat ?? "") !== (profile?.alamat ?? "");

      if (dirty) {
        await patchProfileMut.mutateAsync(nextProfile);
        await qc.invalidateQueries({ queryKey: ["profile"] });
        await qc.invalidateQueries({ queryKey: ["me"] });
      }

      const payload: any = {
        id_jenis_pembayaran: Number(pmId),
        alamat_pengiriman: alamat.trim(),
      };

      // ✅ catatan opsional (backend kamu sudah siap)
      if (catatan.trim()) payload.catatan = catatan.trim();

      return await postCheckout(payload);
    },

    onMutate: () => {
      toast({ variant: "info", title: "Memproses", message: "Membuat order..." });
    },

    onSuccess: async (result) => {
      await qc.invalidateQueries({ queryKey: ["cart"] });
      await qc.invalidateQueries({ queryKey: ["cart-summary"] });
      await qc.invalidateQueries({ queryKey: ["orders"] });

      const oid = getOrderIdFromResponse(result);
      const code = getOrderCodeFromResponse(result);

      toast({
        variant: "success",
        title: "Checkout berhasil",
        message: code ? `Order dibuat (${code}).` : oid ? `Order dibuat (#${oid}).` : "Order berhasil dibuat.",
      });

      router.push(oid ? `/checkout/success?order_id=${oid}` : "/checkout/success");
    },

    onError: (e: any) => {
      const status = (e as HttpErr)?.status;

      if (status === 401 || status === 403) {
        router.push("/login?next=/checkout");
        return;
      }

      toast({ variant: "error", title: "Checkout gagal", message: prettyApiError(e) });
    },
  });

  const canCheckout =
    !loadingCart &&
    !loadingProfile &&
    !loadingPm &&
    !pmErr &&
    !cartErr &&
    items.length > 0 &&
    alamat.trim().length >= 5 &&
    !!pmId &&
    !checkoutMut.isPending &&
    !patchProfileMut.isPending;

  // empty cart hanya kalau request sukses & items benar-benar kosong
  const emptyCart = !loadingCart && !cartErr && items.length === 0;

  // ✅ indikator kelengkapan (tanpa ubah backend)
  const addressComplete = useMemo(() => {
    const nOk = nama.trim().length >= 2;
    const hpOk = noHp.trim().length === 0 || noHp.trim().length >= 8;
    const aOk = alamat.trim().length >= 5;
    return nOk && hpOk && aOk;
  }, [nama, noHp, alamat]);

  const step = useMemo(() => {
    if (!addressComplete) return 1;
    if (!pmId) return 2;
    return 3;
  }, [addressComplete, pmId]);

  return (
    <div className="container py-10 pb-28 md:pb-10">
      <Reveal>
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black">Checkout</h1>
            <p className="text-white/60 mt-1">Lengkapi alamat & pilih metode pembayaran.</p>
          </div>

          <Link href="/cart" className="hidden md:block">
            <Button variant="secondary">← Kembali ke Keranjang</Button>
          </Link>
        </div>
      </Reveal>

      {/* ✅ Stepper (menjelaskan alur, tanpa ubah logic) */}
      <Reveal delay={0.03}>
        <div className="mt-6 grid gap-3 md:grid-cols-3 glass rounded-2xl p-4">
          <StepItem
            icon={<MapPin size={18} />}
            title="1. Alamat"
            desc="Pastikan data pengiriman benar"
            active={step === 1}
            done={step > 1}
          />
          <StepItem
            icon={<CreditCard size={18} />}
            title="2. Pembayaran"
            desc="Pilih metode dari backend"
            active={step === 2}
            done={step > 2}
          />
          <StepItem
            icon={<CheckCircle2 size={18} />}
            title="3. Konfirmasi"
            desc="Buat order & lanjut sukses"
            active={step === 3}
            done={false}
          />
        </div>
      </Reveal>

      {(cartUnauthorized || profileUnauthorized) && (
        <div className="mt-6">
          <Card className="border border-amber-500/30 bg-amber-500/5">
            <div className="font-semibold text-amber-200">Kamu perlu login untuk checkout</div>
            <div className="text-sm text-white/60 mt-1">Sesi login diperlukan untuk akses cart & profile.</div>
            <div className="mt-4">
              <Link href="/login?next=/checkout">
                <Button>Login</Button>
              </Link>
            </div>
          </Card>
        </div>
      )}

      {/* ✅ Error Cart (bukan dianggap kosong) */}
      {cartErr && !cartUnauthorized && (
        <div className="mt-6">
          <Card className="border border-rose-500/30 bg-rose-500/5">
            <div className="font-semibold text-rose-200">Gagal memuat keranjang</div>
            <div className="text-sm text-white/60 mt-1">{(cartError as Error)?.message}</div>
            <div className="mt-4 flex gap-2">
              <Button variant="secondary" onClick={() => refetchCart()} className="gap-2" disabled={fetchingCart}>
                <RefreshCcw size={16} /> {fetchingCart ? "..." : "Coba lagi"}
              </Button>
              <Link href="/books">
                <Button variant="ghost">Ke Katalog</Button>
              </Link>
            </div>
          </Card>
        </div>
      )}

      {profileErr && !profileUnauthorized && (
        <div className="mt-6">
          <Card className="border border-rose-500/30 bg-rose-500/5">
            <div className="font-semibold text-rose-200">Gagal memuat profil</div>
            <div className="text-sm text-white/60 mt-1">{(profileError as Error)?.message || "Cek /users/profile"}</div>
          </Card>
        </div>
      )}

      {emptyCart ? (
        <div className="mt-6">
          <Card>
            <div className="font-semibold">Keranjang kosong</div>
            <div className="text-sm text-white/60 mt-1">Tambahkan buku dulu sebelum checkout.</div>
            <div className="mt-4">
              <Link href="/books">
                <Button>Mulai Belanja</Button>
              </Link>
            </div>
          </Card>
        </div>
      ) : (
        <div className="mt-6 grid lg:grid-cols-[1.2fr_.8fr] gap-6 items-start">
          {/* LEFT */}
          <div className="grid gap-4">
            <Reveal delay={0.02}>
              <Card>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">Alamat Pengiriman</div>
                    <p className="text-sm text-white/60 mt-1">Auto dari profil kamu. Bisa kamu ubah di sini.</p>
                  </div>

                  <Badge
                    className={
                      addressComplete
                        ? "bg-emerald-500/15 text-emerald-200 border border-emerald-400/20"
                        : "bg-amber-500/15 text-amber-200 border border-amber-400/20"
                    }
                  >
                    {addressComplete ? "Lengkap" : "Belum lengkap"}
                  </Badge>
                </div>

                <div className="mt-4 grid gap-3">
                  <Input
                    value={nama}
                    onChange={(e) => setNama(e.target.value)}
                    placeholder="Nama penerima"
                    disabled={loadingProfile}
                  />
                  <Input
                    value={noHp}
                    onChange={(e) => setNoHp(e.target.value)}
                    placeholder="No. HP (min 8 digit)"
                    disabled={loadingProfile}
                  />
                  <Input
                    value={alamat}
                    onChange={(e) => setAlamat(e.target.value)}
                    placeholder="Alamat lengkap (min 5 karakter)"
                    disabled={loadingProfile}
                  />

                  {/* ✅ catatan opsional */}
                  <div className="mt-1">
                    <div className="text-xs text-white/60 mb-2">Catatan (opsional)</div>
                    <textarea
                      value={catatan}
                      onChange={(e) => setCatatan(e.target.value)}
                      placeholder="Contoh: titip di satpam / paket fragile..."
                      className="w-full min-h-[88px] rounded-xl bg-white/5 border border-white/10 px-4 py-2 text-sm text-white/80 outline-none focus:ring-2 focus:ring-indigo-500/40"
                    />
                    <div className="text-xs text-white/50 mt-2">
                      *Alamat akan disimpan ke profil saat checkout (biar next checkout makin otomatis).
                    </div>
                  </div>
                </div>
              </Card>
            </Reveal>

            <Reveal delay={0.04}>
              <Card className="relative z-30">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">Metode Pembayaran</div>
                    <p className="text-sm text-white/60 mt-1">
                      Otomatis dari via <code className="text-white/80">payment-methods</code>.
                    </p>
                  </div>

                  <Button
                    variant="secondary"
                    onClick={() => refetchPm()}
                    disabled={loadingPm || fetchingPm}
                    className="shrink-0 gap-2"
                  >
                    <RefreshCcw size={16} /> {loadingPm || fetchingPm ? "..." : "Refresh"}
                  </Button>
                </div>

                <div className="mt-4">
                  <label className="text-xs text-white/60">Pilih metode</label>

                  <select
                    value={pmId}
                    onChange={(e) => setPmId(e.target.value)}
                    disabled={loadingPm || pmErr || paymentMethods.length === 0}
                    className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/40"
                  >
                    <option value="" className="bg-slate-950">
                      {loadingPm
                        ? "Memuat metode..."
                        : paymentMethods.length
                        ? "Pilih metode pembayaran"
                        : "(Metode pembayaran belum tersedia)"}
                    </option>

                    {paymentMethods.map((m) => (
                      <option key={m.id} value={String(m.id)} className="bg-slate-950">
                        {m.name}
                      </option>
                    ))}
                  </select>

                  {pmErr ? (
                    <div className="text-xs text-rose-200 mt-2">
                      Gagal memuat metode pembayaran: {(pmError as Error)?.message}
                    </div>
                  ) : !loadingPm && paymentMethods.length === 0 ? (
                    <div className="text-xs text-amber-200 mt-2">
                      Metode pembayaran kosong. Pastikan ada data aktif di tabel pembayaran.
                    </div>
                  ) : null}

                  <PaymentInstruction method={selectedMethod} />
                </div>
              </Card>
            </Reveal>

            <div className="md:hidden">
              <Link href="/cart">
                <Button variant="secondary" className="w-full">
                  ← Kembali ke Keranjang
                </Button>
              </Link>
            </div>
          </div>

          {/* RIGHT */}
          <Reveal delay={0.06}>
            <div className="lg:sticky lg:top-24 grid gap-4">
              <Card>
                <div className="flex items-start justify-between gap-3">
                  <div className="font-semibold">Ringkasan</div>
                  <div className="text-xs text-white/60 inline-flex items-center gap-2">
                    <ShieldCheck size={14} className="text-emerald-200" />
                    Secure Checkout
                  </div>
                </div>

                <div className="mt-3 grid gap-2">
                  <SummaryRow label="Total item" value={String(totalQty)} />
                  <SummaryRow label="Total harga" value={formatRupiah(totalPrice)} strong />
                  <div className="text-[11px] text-white/45">
                    *Total mengikuti perhitungan(order dibuat saat konfirmasi).
                  </div>
                </div>

                <div className="mt-4 border-t border-white/10 pt-4">
                  <Button className="w-full" disabled={!canCheckout} onClick={() => checkoutMut.mutate()}>
                    {checkoutMut.isPending || patchProfileMut.isPending ? "Memproses..." : "Konfirmasi Checkout"}
                  </Button>

                  {checkoutMut.isError ? (
                    <div className="text-xs text-rose-200 mt-2">{prettyApiError(checkoutMut.error)}</div>
                  ) : null}

                  <div className="text-[11px] text-white/50 mt-3">
                    Setelah klik, kamu akan diarahkan ke halaman sukses + invoice.
                  </div>
                </div>
              </Card>

              <Card>
                <div className="font-semibold">Item ({items.length})</div>
                <div className="mt-3 grid gap-3">
                  {(items || []).map((it) => (
                    <div key={it.id_keranjang_item} className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-xl overflow-hidden bg-white/5 border border-white/10 flex-shrink-0">
                        <img
                          src={it.buku?.cover_image || "/illustrations/hero-books.svg"}
                          alt={it.buku?.judul || "Buku"}
                          className="h-full w-full object-cover"
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold line-clamp-1">{it.buku?.judul || "—"}</div>
                        <div className="text-xs text-white/60">
                          {it.jumlah} × {formatRupiah(Number(it.harga_satuan || 0))}
                        </div>
                      </div>

                      <div className="text-sm font-semibold text-white/80">
                        {formatRupiah(Number(it.subtotal || 0))}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </Reveal>
        </div>
      )}

      {/* ✅ Mobile bottom bar CTA (lebih ecommerce, tanpa ubah endpoint) */}
      {!emptyCart ? (
        <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t border-white/10 bg-slate-950/80 backdrop-blur">
          <div className="container py-3 flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-[11px] text-white/55">Total</div>
              <div className="font-extrabold text-indigo-200 leading-tight">{formatRupiah(totalPrice)}</div>
            </div>
            <Button className="shrink-0" disabled={!canCheckout} onClick={() => checkoutMut.mutate()}>
              {checkoutMut.isPending || patchProfileMut.isPending ? "..." : "Checkout"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}