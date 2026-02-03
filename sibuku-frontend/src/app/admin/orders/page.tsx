/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import Card from "@/components/ui/card";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import Reveal from "@/components/ui/reveal";
import { formatRupiah } from "@/lib/utils";
import type { Order } from "@/lib/types";

type PagingMeta = { page: number; limit: number; total: number; total_pages: number };
type Paged<T> = { meta: PagingMeta; data: T[] };

function normalizePaged<T>(x: any): Paged<T> {
  if (x?.meta && Array.isArray(x?.data)) return x as Paged<T>;
  if (x?.data?.meta && Array.isArray(x?.data?.data)) return x.data as Paged<T>;
  if (Array.isArray(x)) {
    return { meta: { page: 1, limit: x.length, total: x.length, total_pages: 1 }, data: x };
  }
  return { meta: { page: 1, limit: 10, total: 0, total_pages: 1 }, data: [] };
}

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(d);
}

function pillClass(label: string) {
  const s = (label || "").toLowerCase();
  if (s.includes("lunas") || s.includes("selesai")) return "bg-emerald-500/15 text-emerald-200 ring-emerald-500/30";
  if (s.includes("batal") || s.includes("gagal")) return "bg-rose-500/15 text-rose-200 ring-rose-500/30";
  if (s.includes("dikirim") || s.includes("proses")) return "bg-sky-500/15 text-sky-200 ring-sky-500/30";
  return "bg-amber-500/15 text-amber-200 ring-amber-500/30";
}

function StatusPill({ label }: { label?: string }) {
  const text = label || "—";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs ring-1 ${pillClass(text)}`}>
      {text}
    </span>
  );
}

async function fetchOrders(params: { page: number; limit: number; q?: string }) {
  const qs = new URLSearchParams();
  qs.set("page", String(params.page));
  qs.set("limit", String(params.limit));
  if (params.q?.trim()) qs.set("q", params.q.trim());

  // tetap pakai route yang kamu gunakan sekarang
  const res = await fetch(`/api/admin/orders?${qs.toString()}`, { cache: "no-store" });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.detail || "Gagal memuat orders");
  return normalizePaged<Order>(data);
}

export default function AdminOrdersPage() {
  const [page, setPage] = useState(1);
  const [limit] = useState(10);

  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q), 350);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    setPage(1);
  }, [qDebounced]);

  const queryParams = useMemo(
    () => ({ page, limit, q: qDebounced || undefined }),
    [page, limit, qDebounced]
  );

  const { data, isLoading, isError, error, isFetching } = useQuery({
    queryKey: ["admin-orders", queryParams],
    queryFn: () => fetchOrders(queryParams),
    staleTime: 10_000,
  });

  const rows = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div>
      <Reveal>
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black">Admin • Orders</h1>
            <p className="text-white/60 mt-1">Kelola pesanan: lihat detail & update status.</p>
          </div>

          <div className="hidden md:flex items-center gap-2 text-xs text-white/50">
            {isFetching ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-indigo-400 animate-pulse" />
                Memuat...
              </span>
            ) : meta ? (
              <span>
                Page {meta.page}/{meta.total_pages} • Total {meta.total}
              </span>
            ) : null}
          </div>
        </div>
      </Reveal>

      <div className="glass rounded-2xl p-4 mt-6 grid gap-3 md:grid-cols-[1fr_180px] items-center relative z-30">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari kode order / email / nama..." />
        <Button
          variant="secondary"
          onClick={() => {
            setQ("");
            setPage(1);
          }}
          className="w-full"
        >
          Reset
        </Button>
      </div>

      <div className="mt-6 grid gap-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <div className="h-4 bg-white/5 rounded w-56" />
              <div className="h-3 bg-white/5 rounded w-80 mt-3" />
            </Card>
          ))
        ) : isError ? (
          <Card className="border border-rose-500/30 bg-rose-500/5">
            <div className="font-semibold text-rose-200">Gagal memuat orders</div>
            <div className="text-sm text-white/60 mt-1">{(error as Error)?.message}</div>
          </Card>
        ) : rows.length === 0 ? (
          <Card>
            <div className="font-semibold">Belum ada orders</div>
            <div className="text-sm text-white/60 mt-1">Coba reset filter atau buat order dari checkout.</div>
          </Card>
        ) : (
          rows.map((o) => {
            const so = o.status_order?.nama_status || "—";
            const sp = o.status_pembayaran?.nama_status || "—";

            return (
              <Reveal key={o.id_order} delay={0.02}>
                <Card className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="font-semibold">{o.kode_order}</div>
                      <StatusPill label={so} />
                      <StatusPill label={sp} />
                    </div>

                    <div className="text-sm text-white/60 mt-1">
                      <span>Tanggal: {fmtDate(o.created_at ?? null)}</span>
                      <span className="mx-2 text-white/30">•</span>
                      <span>
                        Total:{" "}
                        <span className="text-white/80 font-semibold">
                          {formatRupiah(Number(o.total_harga || 0))}
                        </span>
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Link href={`/admin/orders/${o.id_order}`}>
                      <Button>Detail</Button>
                    </Link>
                  </div>
                </Card>
              </Reveal>
            );
          })
        )}
      </div>

      {!!meta && meta.total_pages > 1 && (
        <div className="flex items-center justify-between mt-8">
          <Button variant="secondary" disabled={meta.page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            ← Prev
          </Button>

          <div className="text-sm text-white/60">
            Page <b className="text-white/80">{meta.page}</b> / <b className="text-white/80">{meta.total_pages}</b>
          </div>

          <Button variant="secondary" disabled={meta.page >= meta.total_pages} onClick={() => setPage((p) => p + 1)}>
            Next →
          </Button>
        </div>
      )}
    </div>
  );
}
