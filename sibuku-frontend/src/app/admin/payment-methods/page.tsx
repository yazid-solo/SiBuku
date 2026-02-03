/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import Card from "@/components/ui/card";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import Reveal from "@/components/ui/reveal";

import type { PaymentMethod } from "@/lib/types";

type PagingMeta = { page: number; limit: number; total: number; total_pages: number };
type Paged<T> = { meta: PagingMeta; data: T[] };

function normalizePaged<T>(x: any): Paged<T> {
  if (x?.meta && Array.isArray(x?.data)) return x as Paged<T>;
  if (x?.data?.meta && Array.isArray(x?.data?.data)) return x.data as Paged<T>;
  if (Array.isArray(x)) return { meta: { page: 1, limit: x.length, total: x.length, total_pages: 1 }, data: x };
  return { meta: { page: 1, limit: 10, total: 0, total_pages: 1 }, data: [] };
}

function pill(active: boolean) {
  return active
    ? "bg-emerald-500/15 text-emerald-200 ring-emerald-500/30"
    : "bg-amber-500/15 text-amber-200 ring-amber-500/30";
}

async function fetchPaymentMethodsPaged(page: number, limit: number, q: string) {
  const qs = new URLSearchParams();
  qs.set("page", String(page));
  qs.set("limit", String(limit));
  if (q.trim()) qs.set("q", q.trim());

  const res = await fetch(`/api/admin/payment-methods/paged?${qs.toString()}`, { cache: "no-store" });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.detail || "Gagal memuat payment methods");
  return normalizePaged<PaymentMethod>(data);
}

async function createPaymentMethod(payload: { nama_pembayaran: string; keterangan?: string | null; is_active: boolean }) {
  const res = await fetch("/api/admin/payment-methods", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.detail || "Gagal membuat metode pembayaran");
  return data;
}

async function updatePaymentMethod(id: number, payload: { nama_pembayaran: string; keterangan?: string | null; is_active: boolean }) {
  const res = await fetch(`/api/admin/payment-methods/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.detail || "Gagal update metode pembayaran");
  return data;
}

async function togglePaymentMethod(id: number) {
  const res = await fetch(`/api/admin/payment-methods/${id}/toggle`, { method: "PATCH" });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.detail || "Gagal toggle metode pembayaran");
  return data;
}

export default function AdminPaymentMethodsPage() {
  const qc = useQueryClient();

  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [q, setQ] = useState("");

  const [editing, setEditing] = useState<PaymentMethod | null>(null);

  const [nama, setNama] = useState("");
  const [ket, setKet] = useState("");
  const [active, setActive] = useState(true);

  const { data, isLoading, isError, error, isFetching } = useQuery({
    queryKey: ["admin-payment-methods", page, limit, q],
    queryFn: () => fetchPaymentMethodsPaged(page, limit, q),
    staleTime: 10_000,
  });

  const rows = data?.data ?? [];
  const meta = data?.meta;

  const headerInfo = useMemo(() => {
    if (!meta) return "";
    return `Page ${meta.page}/${meta.total_pages} • Total ${meta.total}`;
  }, [meta]);

  function resetForm() {
    setEditing(null);
    setNama("");
    setKet("");
    setActive(true);
  }

  function refetch() {
    qc.invalidateQueries({ queryKey: ["admin-payment-methods"] });
    qc.refetchQueries({ queryKey: ["admin-payment-methods"] });
  }

  const createMut = useMutation({
    mutationFn: () => createPaymentMethod({ nama_pembayaran: nama.trim(), keterangan: ket.trim() ? ket.trim() : null, is_active: active }),
    onSuccess: async () => {
      resetForm();
      refetch();
      alert("Metode pembayaran berhasil dibuat ✅");
    },
    onError: (e: any) => alert(e.message),
  });

  const updateMut = useMutation({
    mutationFn: () => updatePaymentMethod(editing!.id_jenis_pembayaran, { nama_pembayaran: nama.trim(), keterangan: ket.trim() ? ket.trim() : null, is_active: active }),
    onSuccess: async () => {
      resetForm();
      refetch();
      alert("Metode pembayaran berhasil diupdate ✅");
    },
    onError: (e: any) => alert(e.message),
  });

  const toggleMut = useMutation({
    mutationFn: (id: number) => togglePaymentMethod(id),
    onSuccess: async () => {
      refetch();
    },
    onError: (e: any) => alert(e.message),
  });

  return (
    <div>
      <Reveal>
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black">Admin • Payment Methods</h1>
            <p className="text-white/60 mt-1">Kelola metode pembayaran untuk checkout.</p>
          </div>

          <div className="hidden md:flex items-center gap-2 text-xs text-white/50">
            {isFetching ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-indigo-400 animate-pulse" />
                Memuat...
              </span>
            ) : (
              <span>{headerInfo}</span>
            )}
          </div>
        </div>
      </Reveal>

      {/* toolbar */}
      <div className="glass rounded-2xl p-4 mt-6 grid gap-3 md:grid-cols-[1fr_180px] items-center relative z-30">
        <Input
          value={q}
          onChange={(e) => {
            setPage(1);
            setQ(e.target.value);
          }}
          placeholder="Cari metode pembayaran..."
        />
        <Button
          variant="secondary"
          className="w-full"
          onClick={() => {
            setPage(1);
            setQ("");
          }}
        >
          Reset
        </Button>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
        {/* list */}
        <div className="grid gap-3">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <Card key={i} className="animate-pulse">
                <div className="h-4 bg-white/5 rounded w-56" />
                <div className="h-3 bg-white/5 rounded w-80 mt-3" />
              </Card>
            ))
          ) : isError ? (
            <Card className="border border-rose-500/30 bg-rose-500/5">
              <div className="font-semibold text-rose-200">Gagal memuat</div>
              <div className="text-sm text-white/60 mt-1">{(error as Error)?.message}</div>
            </Card>
          ) : rows.length === 0 ? (
            <Card>
              <div className="font-semibold">Belum ada metode pembayaran</div>
              <div className="text-sm text-white/60 mt-1">Tambah dari panel kanan.</div>
            </Card>
          ) : (
            rows.map((pm) => (
              <Card key={pm.id_jenis_pembayaran} className="flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-semibold">{pm.nama_pembayaran}</div>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs ring-1 ${pill(pm.is_active)}`}>
                      {pm.is_active ? "Active" : "Inactive"}
                    </span>
                    <span className="text-[11px] text-white/40">ID: {pm.id_jenis_pembayaran}</span>
                  </div>
                  <div className="text-xs text-white/60 mt-1 line-clamp-2">{pm.keterangan || "—"}</div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setEditing(pm);
                      setNama(pm.nama_pembayaran || "");
                      setKet(pm.keterangan || "");
                      setActive(!!pm.is_active);
                    }}
                  >
                    Edit
                  </Button>

                  <Button variant="ghost" onClick={() => toggleMut.mutate(pm.id_jenis_pembayaran)}>
                    Toggle
                  </Button>
                </div>
              </Card>
            ))
          )}

          {!!meta && meta.total_pages > 1 && (
            <div className="flex items-center justify-between mt-2">
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

        {/* form */}
        <div className="lg:sticky lg:top-24 h-fit">
          <Card>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-semibold">{editing ? "Edit Metode" : "Tambah Metode"}</div>
                <p className="text-sm text-white/60 mt-1">
                  Endpoint: <code className="text-white/80">{editing ? "PUT /admin/payment-methods/{id}" : "POST /admin/payment-methods"}</code>
                </p>
              </div>

              {editing && (
                <Button variant="secondary" onClick={resetForm}>
                  Batal
                </Button>
              )}
            </div>

            <div className="mt-4 grid gap-3">
              <Input value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Nama metode" />
              <Input value={ket} onChange={(e) => setKet(e.target.value)} placeholder="Keterangan (opsional)" />

              <label className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-2">
                <span className="text-sm text-white/70">Aktif</span>
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="h-4 w-4 accent-indigo-500"
                />
              </label>

              <Button
                className="w-full"
                disabled={(editing ? updateMut.isPending : createMut.isPending) || nama.trim().length < 2}
                onClick={() => (editing ? updateMut.mutate() : createMut.mutate())}
              >
                {editing ? (updateMut.isPending ? "Menyimpan..." : "Simpan Perubahan") : createMut.isPending ? "Menyimpan..." : "Simpan"}
              </Button>

              <div className="text-xs text-white/50">
                Toggle aktif/nonaktif tersedia di list (PATCH <code className="text-white/70">/admin/payment-methods/{`{id}`}/toggle</code>).
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
