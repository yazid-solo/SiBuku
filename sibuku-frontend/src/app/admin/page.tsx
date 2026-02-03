/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import Card from "@/components/ui/card";
import Button from "@/components/ui/button";
import Reveal from "@/components/ui/reveal";

type AdminStats = {
  total_books: number;
  total_users: number;
  total_orders: number;
  pending_payment: number;
};

function toNumber(v: unknown) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function normalizeStats(raw: any): AdminStats {
  // beberapa backend suka membungkus ke {data: {...}}
  const x = raw?.data ?? raw ?? {};

  return {
    total_books: toNumber(x.total_books ?? x.books ?? x.totalBooks),
    total_users: toNumber(x.total_users ?? x.users ?? x.totalUsers),
    total_orders: toNumber(x.total_orders ?? x.orders ?? x.totalOrders),
    pending_payment: toNumber(x.pending_payment ?? x.pendingPayment ?? x.pending_payments),
  };
}

async function fetchStats(): Promise<AdminStats> {
  const res = await fetch("/api/admin/stats", { cache: "no-store" });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.detail || "Gagal memuat stats");
  return normalizeStats(data);
}

function StatBox({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <Card className="relative overflow-hidden">
      <div className="absolute inset-0 bg-linear-to-br from-white/5 to-transparent" />
      <div className="relative">
        <div className="text-xs text-white/60">{label}</div>
        <div className="text-2xl font-extrabold mt-1">{value}</div>
        {hint ? <div className="text-[11px] text-white/40 mt-2">{hint}</div> : null}
      </div>
    </Card>
  );
}

export default function AdminDashboardPage() {
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: fetchStats,
    staleTime: 15_000,
    retry: 1,
    refetchOnWindowFocus: true,
  });

  return (
    <div>
      <Reveal>
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black">Dashboard</h1>
            <p className="text-white/60 mt-1">Ringkasan cepat data SiBuku.</p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => refetch()}
              disabled={isFetching}
              title="Refresh data"
            >
              {isFetching ? "Memuat..." : "Refresh"}
            </Button>

            <Link href="/admin/books">
              <Button>Kelola Buku</Button>
            </Link>
          </div>
        </div>
      </Reveal>

      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <div className="h-3 w-24 bg-white/5 rounded" />
              <div className="h-7 w-16 bg-white/5 rounded mt-3" />
              <div className="h-3 w-32 bg-white/5 rounded mt-3" />
            </Card>
          ))}
        </div>
      ) : isError ? (
        <div className="mt-6">
          <Card className="border border-rose-500/30 bg-rose-500/5">
            <div className="font-semibold text-rose-200">Gagal memuat</div>
            <div className="text-sm text-white/60 mt-1">{(error as Error)?.message}</div>
            <div className="mt-4 flex gap-2">
              <Button variant="secondary" onClick={() => refetch()}>
                Coba lagi
              </Button>
              <Link href="/">
                <Button variant="ghost">Kembali</Button>
              </Link>
            </div>
          </Card>
        </div>
      ) : (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
            <StatBox label="Total Books" value={data?.total_books ?? 0} hint="Data buku aktif di sistem" />
            <StatBox label="Total Users" value={data?.total_users ?? 0} hint="Total akun terdaftar" />
            <StatBox label="Total Orders" value={data?.total_orders ?? 0} hint="Total transaksi tercatat" />
            <StatBox label="Pending Payment" value={data?.pending_payment ?? 0} hint="Order menunggu pembayaran" />
          </div>

          <div className="grid md:grid-cols-3 gap-4 mt-6">
            <Card>
              <div className="font-semibold">Quick Links</div>
              <div className="mt-3 grid gap-2 text-sm">
                <Link className="text-indigo-300 hover:text-indigo-200" href="/admin/books">
                  → Admin Books
                </Link>
                <Link className="text-indigo-300 hover:text-indigo-200" href="/admin/authors">
                  → Admin Authors
                </Link>
                <Link className="text-indigo-300 hover:text-indigo-200" href="/admin/genres">
                  → Admin Genres
                </Link>
                <Link className="text-indigo-300 hover:text-indigo-200" href="/admin/orders">
                  → Admin Orders
                </Link>
              </div>
            </Card>

            <Card>
              <div className="font-semibold">Tips</div>
              <div className="text-sm text-white/60 mt-2">
                Kalau stats sering kosong/401, pastikan <code className="text-white/80">/admin/stats</code>{" "}
                memakai proxy dengan <b>auth</b>.
              </div>
            </Card>

            <Card>
              <div className="font-semibold">Status</div>
              <div className="text-sm text-white/60 mt-2">
                {isFetching ? "Sinkronisasi data..." : "Data terbaru siap digunakan."}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
