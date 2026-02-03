/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import Card from "@/components/ui/card";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import Reveal from "@/components/ui/reveal";

import type { Penulis } from "@/lib/types";

/** ---------------- types ---------------- */
type PagingMeta = { page: number; limit: number; total: number; total_pages: number };
type Paged<T> = { meta: PagingMeta; data: T[] };

/** ---------------- helpers ---------------- */
async function fetchJson(url: string, init?: RequestInit) {
  const res = await fetch(url, { cache: "no-store", ...init });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.detail || `Request gagal (${res.status})`);
  return data;
}

function normalizeArray<T>(x: any): T[] {
  if (Array.isArray(x)) return x as T[];
  if (x && Array.isArray(x.data)) return x.data as T[];
  if (x?.data && Array.isArray(x.data.data)) return x.data.data as T[];
  return [];
}

function normalizePaged<T>(x: any): Paged<T> {
  if (x?.meta && Array.isArray(x?.data)) return x as Paged<T>;
  if (x?.data?.meta && Array.isArray(x?.data?.data)) return x.data as Paged<T>;

  // fallback aman
  return {
    meta: { page: 1, limit: 12, total: 0, total_pages: 1 },
    data: [],
  };
}

function initials(name: string) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  const a = (parts[0]?.[0] || "?").toUpperCase();
  const b = (parts[1]?.[0] || "").toUpperCase();
  return (a + b).slice(0, 2);
}

function Avatar({ name, src }: { name: string; src?: string | null }) {
  const [broken, setBroken] = useState(false);
  const show = !!src && !broken;

  return (
    <div className="relative h-14 w-14 rounded-2xl overflow-hidden bg-white/5 ring-1 ring-white/10 flex items-center justify-center">
      {show ? (
        <img
          src={src!}
          alt={name}
          className="h-full w-full object-cover"
          onError={() => setBroken(true)}
        />
      ) : (
        <div className="text-sm font-black text-white/70">{initials(name)}</div>
      )}
    </div>
  );
}

/**
 * Smart fetch:
 * 1) coba /api/authors/paged (kalau backend ada)
 * 2) kalau 404 -> fallback /api/authors lalu pagination+filter di frontend
 */
async function fetchAuthorsSmart(params: { page: number; limit: number; q?: string }): Promise<Paged<Penulis>> {
  const qs = new URLSearchParams();
  qs.set("page", String(params.page));
  qs.set("limit", String(params.limit));
  if (params.q?.trim()) qs.set("q", params.q.trim());

  // 1) TRY PAGED
  try {
    const res = await fetch(`/api/authors/paged?${qs.toString()}`, { cache: "no-store" });
    const data = await res.json().catch(() => null);

    if (res.ok) return normalizePaged<Penulis>(data);

    // kalau bukan 404, lempar error beneran
    if (res.status !== 404) throw new Error(data?.detail || `Request gagal (${res.status})`);
  } catch {
    // lanjut fallback
  }

  // 2) FALLBACK: ambil semua
  const raw = await fetchJson("/api/authors");
  const all = normalizeArray<Penulis>(raw);

  const q = (params.q || "").trim().toLowerCase();
  const filtered = q
    ? all.filter((a) => String(a.nama_penulis || "").toLowerCase().includes(q))
    : all;

  const total = filtered.length;
  const total_pages = Math.max(1, Math.ceil(total / params.limit));
  const page = Math.min(Math.max(1, params.page), total_pages);

  const start = (page - 1) * params.limit;
  const data = filtered.slice(start, start + params.limit);

  return {
    meta: { page, limit: params.limit, total, total_pages },
    data,
  };
}

/** ---------------- page ---------------- */
export default function AuthorsPage() {
  const [page, setPage] = useState(1);
  const [limit] = useState(12);

  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");

  // debounce search (otomatis)
  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q), 350);
    return () => clearTimeout(t);
  }, [q]);

  // setiap keyword berubah -> balik ke page 1
  useEffect(() => {
    setPage(1);
  }, [qDebounced]);

  const queryParams = useMemo(
    () => ({ page, limit, q: qDebounced || undefined }),
    [page, limit, qDebounced]
  );

  const { data, isLoading, isError, error, isFetching } = useQuery({
    queryKey: ["authors", queryParams],
    queryFn: () => fetchAuthorsSmart(queryParams),
    staleTime: 30_000,
  });

  const rows = data?.data ?? [];
  const meta = data?.meta;

  const headerInfo = useMemo(() => {
    if (!meta) return "";
    return `Page ${meta.page}/${meta.total_pages} • Total ${meta.total}`;
  }, [meta]);

  function reset() {
    setQ("");
    setPage(1);
  }

  return (
    <div className="container py-10">
      <Reveal>
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black">Penulis</h1>
            <p className="text-white/60 mt-1">Jelajahi profil penulis & lihat koleksi bukunya.</p>
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
      <Reveal delay={0.03}>
        <div className="glass rounded-2xl p-4 mt-6 grid gap-3 md:grid-cols-[1fr_180px] items-center relative z-30">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama penulis..." />
          <Button variant="secondary" onClick={reset} className="w-full">
            Reset
          </Button>
        </div>
      </Reveal>

      {/* states */}
      <div className="mt-6">
        {isLoading ? (
          <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Card key={i} className="animate-pulse">
                <div className="h-14 w-14 rounded-2xl bg-white/5" />
                <div className="h-4 bg-white/5 rounded mt-4 w-2/3" />
                <div className="h-3 bg-white/5 rounded mt-2" />
                <div className="h-3 bg-white/5 rounded mt-2 w-4/5" />
                <div className="h-9 bg-white/5 rounded mt-4" />
              </Card>
            ))}
          </div>
        ) : isError ? (
          <Card className="border border-rose-500/30 bg-rose-500/5">
            <div className="font-semibold text-rose-200">Gagal memuat penulis</div>
            <div className="text-sm text-white/60 mt-1">{(error as Error)?.message}</div>
            <div className="mt-4">
              <Button variant="secondary" onClick={() => window.location.reload()}>
                Coba lagi
              </Button>
            </div>
          </Card>
        ) : rows.length === 0 ? (
          <Card>
            <div className="font-semibold">Tidak ada penulis ditemukan</div>
            <div className="text-sm text-white/60 mt-1">Coba kata kunci lain atau reset filter.</div>
            <div className="mt-4">
              <Button variant="secondary" onClick={reset}>
                Reset
              </Button>
            </div>
          </Card>
        ) : (
          <>
            <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {rows.map((a, i) => (
                <Reveal key={a.id_penulis} delay={0.02 + i * 0.01}>
                  <Card className="group relative overflow-hidden">
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition duration-300 bg-gradient-to-br from-indigo-500/10 via-sky-400/5 to-transparent" />

                    <div className="relative">
                      <div className="flex items-center gap-3">
                        <Avatar name={a.nama_penulis} src={a.foto_penulis ?? null} />
                        <div className="min-w-0">
                          <div className="font-semibold line-clamp-1">{a.nama_penulis}</div>
                          <div className="text-[11px] text-white/40">ID: {a.id_penulis}</div>
                        </div>
                      </div>

                      <div className="text-sm text-white/60 mt-3 line-clamp-3">
                        {a.biografi || "Belum ada biografi penulis."}
                      </div>

                      <div className="mt-4 grid gap-2">
                        <Link href={`/authors/${a.id_penulis}`}>
                          <Button className="w-full">Lihat Profil</Button>
                        </Link>
                        <Link href={`/books?search=${encodeURIComponent(a.nama_penulis || "")}`}>
                          <Button variant="secondary" className="w-full">
                            Cari Buku Penulis
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </Card>
                </Reveal>
              ))}
            </div>

            {/* pagination */}
            {!!meta && meta.total_pages > 1 && (
              <div className="flex items-center justify-between mt-8">
                <Button
                  variant="secondary"
                  disabled={meta.page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  ← Prev
                </Button>

                <div className="text-sm text-white/60">
                  Page <b className="text-white/80">{meta.page}</b> /{" "}
                  <b className="text-white/80">{meta.total_pages}</b>
                </div>

                <Button
                  variant="secondary"
                  disabled={meta.page >= meta.total_pages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next →
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
