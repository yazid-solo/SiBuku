/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCcw, Search, Trash2 } from "lucide-react";

import Card from "@/components/ui/card";
import Button from "@/components/ui/button";
import Reveal from "@/components/ui/reveal";
import Input from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

import type { Order } from "@/lib/types";
import { formatRupiah } from "@/lib/utils";

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
  const res = await fetch(url, { cache: "no-store", credentials: "include", ...init });

  // ✅ handle 204 No Content (DELETE sering balikin ini)
  if (res.status === 204) return null as T;

  const contentType = res.headers.get("content-type") ?? "";
  const data = contentType.includes("application/json")
    ? await res.json().catch(() => null)
    : await res.text().catch(() => null);

  if (!res.ok) {
    const err = new Error(
      toPlainMessage((data as any)?.detail) ||
        toPlainMessage((data as any)?.message) ||
        (typeof data === "string" ? data : "") ||
        `Gagal (${res.status})`
    ) as HttpErr;
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data as T;
}

function normalizeArrayAny(x: any): any[] {
  if (Array.isArray(x)) return x;
  if (x && Array.isArray(x.data)) return x.data;
  if (x?.data?.data && Array.isArray(x.data.data)) return x.data.data;
  if (x?.results && Array.isArray(x.results)) return x.results;
  return [];
}

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

/* ---------------- filter helpers ---------------- */

type FilterKey = "all" | "unpaid" | "processing" | "shipping" | "done" | "cancel";

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
  return st.includes("dikirim") || st.includes("siap kirim") || st.includes("siap dikirim");
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

function matchFilter(key: FilterKey, o: any) {
  if (key === "all") return true;
  if (key === "unpaid") return isUnpaid(o);
  if (key === "processing") return isProcessing(o);
  if (key === "shipping") return isShipping(o);
  if (key === "done") return isDone(o);
  if (key === "cancel") return isCancel(o);
  return true;
}

/* ---------------- delete api ---------------- */

async function deleteOrderApi(id: string) {
  // butuh /api/orders/[id] support DELETE
  return await fetchJson(`/api/orders/${id}`, { method: "DELETE" });
}

/* ---------------- id helper (penting biar ga 404) ---------------- */
function getOrderId(o: any): string {
  const raw = o?.id_order ?? o?.id ?? "";
  const id = String(raw ?? "").trim();
  return id;
}

export default function OrdersPage() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["orders"],
    queryFn: () => fetchJson<any>("/api/orders"),
    retry: false,
    staleTime: 10_000,
    refetchOnWindowFocus: false,
  });

  const orders = useMemo(() => {
    const arr = normalizeArrayAny(data) as Order[];
    return arr.slice().sort((a: any, b: any) => {
      const ta = new Date(a?.created_at ?? a?.tanggal_order ?? 0).getTime();
      const tb = new Date(b?.created_at ?? b?.tanggal_order ?? 0).getTime();
      return tb - ta;
    });
  }, [data]);

  const counts = useMemo(() => {
    const base = { all: orders.length, unpaid: 0, processing: 0, shipping: 0, done: 0, cancel: 0 };
    for (const o of orders as any[]) {
      if (isUnpaid(o)) base.unpaid++;
      if (isProcessing(o)) base.processing++;
      if (isShipping(o)) base.shipping++;
      if (isDone(o)) base.done++;
      if (isCancel(o)) base.cancel++;
    }
    return base;
  }, [orders]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();

    return (orders as any[]).filter((o) => {
      if (!matchFilter(filter, o)) return false;

      if (!term) return true;

      const kode = norm(o?.kode_order);
      const pay = norm(o?.status_pembayaran?.nama_status);
      const st = norm(o?.status_order?.nama_status);
      const total = norm(o?.total_harga);

      const titles = Array.isArray((o as any)?.order_item)
        ? (o as any).order_item
            .map((it: any) => norm(it?.buku?.judul ?? it?.judul ?? ""))
            .filter(Boolean)
            .join(" ")
        : "";

      return kode.includes(term) || pay.includes(term) || st.includes(term) || total.includes(term) || titles.includes(term);
    });
  }, [orders, q, filter]);

  const unauthorized =
    (error as HttpErr | undefined)?.status === 401 || (error as HttpErr | undefined)?.status === 403;

  const filtersUi: { key: FilterKey; label: string; count: number }[] = useMemo(
    () => [
      { key: "all", label: "Semua", count: counts.all },
      { key: "unpaid", label: "Menunggu Bayar", count: counts.unpaid },
      { key: "processing", label: "Diproses", count: counts.processing },
      { key: "shipping", label: "Dikirim", count: counts.shipping },
      { key: "done", label: "Selesai", count: counts.done },
      { key: "cancel", label: "Batal", count: counts.cancel },
    ],
    [counts]
  );

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      toast({ variant: "info", title: "Menghapus", message: "Menghapus pesanan..." });
      return await deleteOrderApi(id);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["orders"] });
      toast({ variant: "success", title: "Terhapus", message: "Pesanan berhasil dihapus dari riwayat." });
    },
    onError: (e: any) => {
      const status = (e as HttpErr | undefined)?.status;
      if (status === 401 || status === 403) {
        toast({ variant: "info", title: "Login dulu", message: "Sesi kamu habis. Silakan login lagi." });
        window.location.href = "/login?next=/orders";
        return;
      }

      toast({
        variant: "error",
        title: "Gagal",
        message: (typeof e?.message === "string" && e.message) ? e.message : "Gagal menghapus pesanan",
      });
    },
  });

  return (
    <div className="container py-10">
      <Reveal>
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black">Pesanan Saya</h1>
            <p className="text-white/60 mt-1">Cek status pembayaran & pengiriman pesanan kamu.</p>
          </div>

          <Button
            variant="secondary"
            onClick={async () => {
              const r = await refetch();
              if (r.data) toast({ variant: "success", title: "Terupdate", message: "Riwayat pesanan dimuat ulang." });
            }}
            disabled={isFetching}
            className="gap-2"
          >
            <RefreshCcw size={16} /> {isFetching ? "..." : "Refresh"}
          </Button>
        </div>
      </Reveal>

      {unauthorized ? (
        <div className="mt-6">
          <Card className="border border-amber-500/30 bg-amber-500/5">
            <div className="font-semibold text-amber-200">Kamu perlu login</div>
            <div className="text-sm text-white/60 mt-1">Riwayat pesanan hanya bisa diakses setelah login.</div>
            <div className="mt-4">
              <Link href="/login?next=/orders">
                <Button>Login</Button>
              </Link>
            </div>
          </Card>
        </div>
      ) : isLoading ? (
        <div className="mt-6 grid gap-3">
          <Card className="animate-pulse">
            <div className="h-4 bg-white/5 rounded w-64" />
            <div className="h-3 bg-white/5 rounded w-96 mt-3" />
          </Card>
          <Card className="animate-pulse"><div className="h-20 bg-white/5 rounded" /></Card>
          <Card className="animate-pulse"><div className="h-20 bg-white/5 rounded" /></Card>
        </div>
      ) : isError ? (
        <div className="mt-6">
          <Card className="border border-rose-500/30 bg-rose-500/5">
            <div className="font-semibold text-rose-200">Gagal memuat pesanan</div>
            <div className="text-sm text-white/60 mt-1">{(error as Error)?.message}</div>
          </Card>
        </div>
      ) : (
        <div className="mt-6 grid gap-4">
          {/* Search + Filters */}
          <Card>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="flex-1">
                  <div className="text-sm text-white/60">Cari pesanan</div>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40">
                        <Search size={16} />
                      </span>
                      <Input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Cari kode order / status / judul buku / total..."
                        className="pl-10"
                      />
                    </div>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setQ("");
                        setFilter("all");
                      }}
                    >
                      Reset
                    </Button>
                  </div>
                </div>

                <div className="text-xs text-white/50 md:text-right">
                  Total: <span className="text-white/80 font-semibold">{orders.length}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {filtersUi.map((f) => {
                  const active = filter === f.key;
                  return (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => setFilter(f.key)}
                      className={[
                        "px-3 py-1.5 rounded-full text-xs ring-1 transition",
                        active
                          ? "bg-indigo-500/15 text-indigo-200 ring-indigo-500/30"
                          : "bg-white/5 text-white/70 ring-white/10 hover:bg-white/10",
                      ].join(" ")}
                    >
                      {f.label} <span className="text-white/50">({f.count})</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </Card>

          {filtered.length === 0 ? (
            <Card>
              <div className="font-semibold">Pesanan tidak ditemukan</div>
              <div className="text-sm text-white/60 mt-1">Coba ganti kata kunci atau reset filter.</div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => { setQ(""); setFilter("all"); }}>
                  Reset Filter
                </Button>
                <Link href="/books">
                  <Button>Belanja Sekarang</Button>
                </Link>
              </div>
            </Card>
          ) : (
            <div className="grid gap-3">
              {filtered.map((o: any, idx: number) => {
                const orderId = getOrderId(o); // ✅ wajib untuk link ke /orders/{id}
                const canOpen = !!orderId;

                const kode = o?.kode_order ?? (canOpen ? `Order #${orderId}` : `Order #${idx + 1}`);
                const created = formatDateTime(o?.created_at ?? o?.tanggal_order ?? null);
                const total = formatRupiah(Number(o?.total_harga ?? 0));

                const statusOrderLabel = o?.status_order?.nama_status ?? null;
                const statusPayLabel = o?.status_pembayaran?.nama_status ?? null;

                const items = Array.isArray(o?.order_item) ? o.order_item : [];
                const preview = items.slice(0, 2);
                const moreCount = Math.max(0, items.length - preview.length);

                const unpaid = isUnpaid(o);

                // ✅ aturan aman ecommerce: hapus hanya bila unpaid/cancel/done
                const canDelete =
                  canOpen &&
                  (unpaid || isCancel(o) || isDone(o)) &&
                  !isShipping(o) &&
                  !isProcessing(o);

                return (
                  <Card key={orderId || `${idx}`}>
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="font-extrabold">{kode}</div>
                          <StatusPill label={statusOrderLabel} />
                          <StatusPill label={statusPayLabel} />
                        </div>

                        <div className="text-xs text-white/60 mt-1">
                          Tanggal: {created}
                          <span className="mx-2 text-white/30">•</span>
                          Total: <span className="text-indigo-200 font-bold">{total}</span>
                        </div>

                        {/* Preview items */}
                        {preview.length > 0 ? (
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            {preview.map((it: any, i: number) => {
                              const title = it?.buku?.judul ?? it?.judul ?? `Item ${i + 1}`;
                              const cover = it?.buku?.cover_image ?? it?.cover_image ?? null;
                              const key = String(it?.id_order_item ?? it?.id ?? `${orderId || idx}-${i}`);

                              return (
                                <div
                                  key={key}
                                  className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-2.5 py-2 max-w-full"
                                >
                                  <div className="h-9 w-9 rounded-lg overflow-hidden bg-white/5 border border-white/10 shrink-0">
                                    {cover ? (
                                      <img src={cover} alt={title} className="h-full w-full object-cover" />
                                    ) : (
                                      <div className="h-full w-full flex items-center justify-center text-[10px] text-white/40">
                                        —
                                      </div>
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="text-xs text-white/80 font-medium line-clamp-1">{title}</div>
                                    <div className="text-[11px] text-white/50">Qty: {it?.jumlah ?? "—"}</div>
                                  </div>
                                </div>
                              );
                            })}

                            {moreCount > 0 ? (
                              <div className="text-xs text-white/50">+{moreCount} item lain</div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-2">
                        {/* ✅ Ecommerce: kalau unpaid → Bayar Sekarang ke anchor #payment */}
                        {unpaid && canOpen ? (
                          <Link href={`/orders/${orderId}#payment`}>
                            <Button className="shrink-0">Bayar Sekarang</Button>
                          </Link>
                        ) : null}

                        {/* ✅ Detail selalu pakai id_order (biar endpoint GET /orders/{id} cocok) */}
                        {canOpen ? (
                          <Link href={`/orders/${orderId}`}>
                            <Button variant={unpaid ? "secondary" : undefined} className="shrink-0">
                              Detail
                            </Button>
                          </Link>
                        ) : (
                          <Button variant="secondary" className="shrink-0" disabled title="Order ID tidak valid">
                            Detail
                          </Button>
                        )}

                        {/* ✅ tombol hapus */}
                        <Button
                          variant="ghost"
                          className={[
                            "shrink-0 gap-2",
                            canDelete ? "text-rose-200 hover:bg-rose-500/10" : "text-white/30 cursor-not-allowed",
                          ].join(" ")}
                          disabled={!canDelete || delMut.isPending}
                          onClick={async () => {
                            if (!canDelete) return;
                            const ok = window.confirm(
                              "Hapus pesanan ini dari riwayat?\n\nCatatan: sebaiknya backend menerapkan soft-delete (archive) agar data transaksi tetap aman."
                            );
                            if (!ok) return;

                            delMut.mutate(String(orderId));
                          }}
                          title={
                            canDelete
                              ? "Hapus dari riwayat"
                              : "Tidak bisa dihapus (pesanan sedang diproses/dikirim atau id tidak valid)"
                          }
                        >
                          <Trash2 size={16} />
                          <span className="hidden md:inline">Hapus</span>
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
