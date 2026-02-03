/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Copy, RefreshCcw } from "lucide-react";

import Card from "@/components/ui/card";
import Button from "@/components/ui/button";
import Reveal from "@/components/ui/reveal";
import { useToast } from "@/components/ui/toast";

import type { Order } from "@/lib/types";
import { formatRupiah } from "@/lib/utils";

type HttpErr = Error & { status?: number; data?: any };

function formatDateTime(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function statusColor(label: string) {
  const s = (label || "").toLowerCase();
  if (s.includes("selesai") || s.includes("lunas"))
    return "bg-emerald-500/15 text-emerald-200 ring-emerald-500/30";
  if (s.includes("batal") || s.includes("gagal"))
    return "bg-rose-500/15 text-rose-200 ring-rose-500/30";
  if (s.includes("dikirim") || s.includes("diproses") || s.includes("proses"))
    return "bg-sky-500/15 text-sky-200 ring-sky-500/30";
  return "bg-amber-500/15 text-amber-200 ring-amber-500/30";
}

function StatusPill({ label }: { label?: string | null }) {
  const text = label || "—";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs ring-1 ${statusColor(text)}`}>
      {text}
    </span>
  );
}

function isPaymentPending(label?: string | null) {
  const s = String(label ?? "").toLowerCase();
  return s.includes("menunggu") || s.includes("pending") || s.includes("belum");
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store", credentials: "include" });
  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const err = new Error(data?.detail || `Gagal (${res.status})`) as HttpErr;
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data as T;
}

async function fetchOrderDetail(id: string): Promise<Order> {
  return await fetchJson<Order>(`/api/orders/${id}`);
}

/* --------- payment instruction helpers --------- */

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

type PaymentInfo = {
  methodName?: string;
  desc?: string;
  bank?: string;
  accountName?: string;
  accountNumber?: string;
  qrUrl?: string;
};

function pickPaymentInfo(order?: any): PaymentInfo {
  if (!order) return {};

  const methodObj =
    order?.jenis_pembayaran ??
    order?.payment_method ??
    order?.metode_pembayaran ??
    order?.metodePembayaran ??
    null;

  const methodName =
    methodObj?.nama_pembayaran ??
    methodObj?.nama_metode ??
    methodObj?.nama ??
    order?.nama_pembayaran ??
    order?.nama_metode ??
    order?.payment_method_name ??
    undefined;

  const descRaw =
    methodObj?.keterangan ??
    methodObj?.deskripsi ??
    methodObj?.description ??
    order?.keterangan_pembayaran ??
    order?.deskripsi_pembayaran ??
    order?.payment_instruction ??
    undefined;

  const desc = typeof descRaw === "string" ? descRaw : descRaw ? String(descRaw) : "";
  const parsed = tryParseJson(desc);

  const qrUrl =
    parsed?.qr_url ||
    parsed?.qris_url ||
    parsed?.qr ||
    parsed?.qris ||
    methodObj?.qr_url ||
    methodObj?.qris_url ||
    order?.qr_url ||
    order?.qris_url ||
    (desc.toLowerCase().includes("http") && desc.toLowerCase().includes("qr") ? extractFirstUrl(desc) : null) ||
    null;

  const accountNumber =
    parsed?.account_number ||
    parsed?.va_number ||
    parsed?.rekening ||
    parsed?.no_rek ||
    methodObj?.no_rek ||
    methodObj?.account_number ||
    methodObj?.va_number ||
    order?.no_rek ||
    order?.va_number ||
    extractAccountNumber(desc) ||
    null;

  const bank = parsed?.bank || parsed?.bank_name || methodObj?.bank || methodObj?.bank_name || undefined;

  const accountName =
    parsed?.account_name ||
    parsed?.nama_rekening ||
    parsed?.atas_nama ||
    methodObj?.atas_nama ||
    methodObj?.nama_rekening ||
    undefined;

  return {
    methodName: methodName ? String(methodName) : undefined,
    desc: desc || undefined,
    bank: bank ? String(bank) : undefined,
    accountName: accountName ? String(accountName) : undefined,
    accountNumber: accountNumber ? String(accountNumber) : undefined,
    qrUrl: qrUrl ? String(qrUrl) : undefined,
  };
}

function PaymentInstruction({ order }: { order?: Order | null }) {
  const { toast } = useToast();
  const info = pickPaymentInfo(order);

  const desc = info.desc?.trim() || "";
  const hasAny = !!desc || !!info.accountNumber || !!info.qrUrl;

  const lines = desc
    .split(/\n+/)
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 8);

  // ✅ selalu render section agar anchor #payment tidak kosong
  return (
    <div id="payment" className="mt-4 scroll-mt-28 rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="text-sm font-semibold">Instruksi Pembayaran</div>

      {info.methodName ? (
        <div className="text-xs text-white/60 mt-1">
          Metode: <span className="text-white/80 font-semibold">{info.methodName}</span>
        </div>
      ) : null}

      {(info.bank || info.accountName) && (
        <div className="text-xs text-white/60 mt-1">
          {info.bank ? <span>{info.bank}</span> : null}
          {info.bank && info.accountName ? <span className="mx-2 text-white/30">•</span> : null}
          {info.accountName ? <span>Atas nama: {info.accountName}</span> : null}
        </div>
      )}

      {!hasAny ? (
        <div className="mt-3 text-xs text-white/60">
          Instruksi belum tersedia dari backend untuk metode ini.
        </div>
      ) : null}

      {info.accountNumber ? (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3">
          <div className="min-w-0">
            <div className="text-[11px] text-white/50">Nomor Rekening / Virtual Account</div>
            <div className="font-semibold text-white/90 break-all">{info.accountNumber}</div>
          </div>
          <Button
            variant="secondary"
            className="shrink-0 gap-2"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(info.accountNumber!);
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

      {info.qrUrl ? (
        <div className="mt-3">
          <div className="text-[11px] text-white/50 mb-2">QR / QRIS</div>
          <div className="rounded-xl overflow-hidden border border-white/10 bg-slate-950/40 p-3 inline-block">
            <img src={info.qrUrl} alt="QR Code" className="h-40 w-40 object-contain" />
          </div>
          <div className="text-[11px] text-white/40 mt-2 break-all">{info.qrUrl}</div>
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
        *Konten di atas otomatis dari field{" "}
        <code className="text-white/70">keterangan/deskripsi</code> di backend.
      </div>
    </div>
  );
}

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();

  const id = useMemo(() => {
    const raw = (params as Record<string, string | string[] | undefined>)?.id;
    return Array.isArray(raw) ? raw[0] : raw || "";
  }, [params]);

  const { data: order, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["order", id],
    queryFn: () => fetchOrderDetail(id),
    enabled: !!id,
    retry: false,
    staleTime: 10_000,
    refetchOnWindowFocus: false,
  });

  // ✅ auto-refresh kalau status masih menunggu / pending
  const shouldPoll = useMemo(() => {
    const s = String(order?.status_pembayaran?.nama_status ?? "").toLowerCase();
    return !!order && (s.includes("menunggu") || s.includes("pending"));
  }, [order]);

  useEffect(() => {
    if (!shouldPoll) return;
    const t = setInterval(() => refetch(), 5000);
    return () => clearInterval(t);
  }, [shouldPoll, refetch]);

  // ✅ auto-scroll kalau URL ada #payment
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!order) return;

    const hash = window.location.hash || "";
    if (hash !== "#payment") return;

    const el = document.getElementById("payment");
    if (!el) return;

    // kasih sedikit delay biar layout/transition stabil
    const t = setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    return () => clearTimeout(t);
  }, [order]);

  const unauthorized =
    (error as HttpErr | undefined)?.status === 401 || (error as HttpErr | undefined)?.status === 403;

  const shippingAddress =
    (order as any)?.alamat_pengiriman ??
    (order as any)?.alamat ??
    (order as any)?.user?.alamat ??
    "";

  const payPending = isPaymentPending(order?.status_pembayaran?.nama_status ?? null);

  return (
    <div className="container py-10">
      <Reveal>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black">Detail Pesanan</h1>
            <p className="text-white/60 mt-1">Rincian item & status pesanan.</p>
          </div>
          <div className="flex items-center gap-2">
            {payPending ? (
              <Button
                variant="secondary"
                onClick={() => {
                  const el = document.getElementById("payment");
                  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                Lihat Instruksi
              </Button>
            ) : null}

            <Button
              variant="secondary"
              onClick={async () => {
                const r = await refetch();
                if (r.data) toast({ variant: "success", title: "Terupdate", message: "Status terbaru dimuat." });
              }}
              disabled={isFetching}
              className="gap-2"
            >
              <RefreshCcw size={16} /> {isFetching ? "..." : "Refresh"}
            </Button>

            <Button variant="secondary" onClick={() => router.push("/orders")}>
              ← Kembali
            </Button>
          </div>
        </div>
      </Reveal>

      {isLoading ? (
        <div className="mt-6 grid gap-3">
          <Card className="animate-pulse">
            <div className="h-4 bg-white/5 rounded w-56" />
            <div className="h-3 bg-white/5 rounded w-72 mt-3" />
          </Card>
          <Card className="animate-pulse">
            <div className="h-24 bg-white/5 rounded" />
          </Card>
        </div>
      ) : isError ? (
        <div className="mt-6">
          <Card className="border border-rose-500/30 bg-rose-500/5">
            <div className="font-semibold text-rose-200">Gagal memuat detail</div>
            <div className="text-sm text-white/60 mt-1">
              {unauthorized ? "Sesi kamu habis. Silakan login lagi." : (error as Error)?.message}
            </div>
            {unauthorized ? (
              <div className="mt-4">
                <Button onClick={() => router.push(`/login?next=/orders/${id}`)}>Login</Button>
              </div>
            ) : null}
          </Card>
        </div>
      ) : !order ? null : (
        <div className="mt-6 grid gap-4">
          <Reveal delay={0.02}>
            <Card>
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <div className="text-sm text-white/60">Kode Order</div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="text-xl font-extrabold">{order.kode_order}</div>

                    <Button
                      variant="secondary"
                      className="h-8 px-3 gap-2"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(String(order.kode_order));
                          toast({ variant: "success", title: "Tersalin", message: "Kode order berhasil dicopy." });
                        } catch {
                          toast({ variant: "error", title: "Gagal", message: "Tidak bisa akses clipboard." });
                        }
                      }}
                    >
                      <Copy size={14} /> Copy
                    </Button>
                  </div>

                  <div className="text-sm text-white/60 mt-1">Dibuat: {formatDateTime(order.created_at ?? null)}</div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <StatusPill label={order.status_order?.nama_status ?? null} />
                    <StatusPill label={order.status_pembayaran?.nama_status ?? null} />
                  </div>

                  {payPending ? (
                    <div className="mt-3 text-xs text-amber-200">
                      Menunggu pembayaran — lakukan pembayaran sesuai instruksi di bawah. Status akan auto-update.
                    </div>
                  ) : null}
                </div>

                <div className="md:text-right">
                  <div className="text-sm text-white/60">Total</div>
                  <div className="text-xl font-extrabold text-indigo-200">
                    {formatRupiah(Number(order.total_harga ?? 0))}
                  </div>
                </div>
              </div>

              {/* ✅ Payment instruction (anchor #payment ada di dalam komponen) */}
              <PaymentInstruction order={order} />
            </Card>
          </Reveal>

          <Reveal delay={0.03}>
            <Card>
              <div className="font-semibold">Alamat Pengiriman</div>
              <div className="text-sm text-white/70 mt-2 whitespace-pre-line">
                {shippingAddress ? String(shippingAddress) : "—"}
              </div>
            </Card>
          </Reveal>

          <Reveal delay={0.04}>
            <Card>
              <div className="font-semibold">Item Pesanan</div>
              <div className="mt-3 divide-y divide-white/10">
                {Array.isArray(order.order_item) && order.order_item.length > 0 ? (
                  order.order_item.map((it: any) => {
                    const key = String(
                      it?.id_order_item ?? it?.id ?? `${it?.id_buku}-${it?.jumlah}-${it?.subtotal}`
                    );
                    const title = it?.buku?.judul ?? (it?.id_buku ? `Buku ID: ${it.id_buku}` : "Item");
                    const cover = it?.buku?.cover_image || "/illustrations/hero-books.svg";

                    return (
                      <div key={key} className="py-3 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-12 w-12 rounded-xl overflow-hidden bg-white/5 border border-white/10 shrink-0">
                            <img src={cover} alt={title} className="h-full w-full object-cover" />
                          </div>

                          <div className="min-w-0">
                            <div className="font-medium line-clamp-1">{title}</div>
                            <div className="text-xs text-white/60 mt-1">
                              Qty: {it.jumlah}
                              <span className="mx-2 text-white/30">•</span>
                              Harga: {formatRupiah(Number(it.harga_satuan ?? 0))}
                            </div>
                          </div>
                        </div>

                        <div className="font-semibold text-white/80">
                          {formatRupiah(Number(it.subtotal ?? 0))}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-sm text-white/60 py-3">Item tidak ditemukan.</div>
                )}
              </div>
            </Card>
          </Reveal>

          <Reveal delay={0.06}>
            <Card>
              <div className="font-semibold">Aksi</div>
              <div className="text-sm text-white/60 mt-2">
                Jika status masih menunggu pembayaran, lakukan pembayaran sesuai instruksi di atas.
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button onClick={() => router.push("/books")}>Belanja lagi</Button>
                <Button variant="secondary" onClick={() => router.push("/orders")}>
                  Lihat semua pesanan
                </Button>
              </div>
            </Card>
          </Reveal>
        </div>
      )}
    </div>
  );
}
