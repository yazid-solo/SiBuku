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

type PagingMeta = { page: number; limit: number; total: number; total_pages: number };
type Paged<T> = { meta: PagingMeta; data: T[] };

function normalizePaged<T>(raw: any, fallbackPage = 1, fallbackLimit = 12): Paged<T> {
  if (raw?.meta && Array.isArray(raw?.data)) return raw as Paged<T>;
  if (raw?.data?.meta && Array.isArray(raw?.data?.data)) return raw.data as Paged<T>;
  if (Array.isArray(raw)) {
    return {
      meta: { page: 1, limit: raw.length, total: raw.length, total_pages: 1 },
      data: raw as T[],
    };
  }
  return {
    meta: { page: fallbackPage, limit: fallbackLimit, total: 0, total_pages: 1 },
    data: [],
  };
}

function initials(name: string) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const a = (parts[0]?.[0] || "?").toUpperCase();
  const b = (parts[1]?.[0] || "").toUpperCase();
  return (a + b).slice(0, 2);
}

function AuthorAvatar({ name, src }: { name: string; src?: string | null }) {
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
        <div className="text-sm font-bold text-white/70">{initials(name)}</div>
      )}
    </div>
  );
}

async function fetchAuthorsPaged(params: { page: number; limit: number; q?: string }): Promise<Paged<Penulis>> {
  const qs = new URLSearchParams();
  qs.set("page", String(params.page));
  qs.set("limit", String(params.limit));
  if (params.q?.trim()) qs.set("q", params.q.trim());

  const res = await fetch(`/api/authors/paged?${qs.toString()}`, { cache: "no-store" });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.detail || "Gagal memuat penulis");
  return normalizePaged<Penulis>(data, params.page, params.limit);
}

export default function AuthorsPage() {
  const [page, setPage] = useState(1);
  const limit = 12;

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
    queryKey: ["authors", queryParams],
    queryFn: () => fetchAuthorsPaged(queryParams),
    staleTime: 15_000,
  });

  const rows = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="container py-10">
      <Reveal>
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black">Penulis</h1>
            <p className="text-white/60 mt-1">Temukan penulis favorit & lihat buku-bukunya.</p>
          </div>

          <div className="hidden md:flex items-center gap-2 text-xs text-white/50">
            {isFetching ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-indigo-400 animate-pulse" />
                Memuat...
              </span>
            ) : meta ? (
              <span>
                Page <b className="text-white/80">{meta.page}</b>/{meta.total_pages} • Total{" "}
                <b className="text-white/80">{meta.total}</b>
              </span>
            ) : null}
          </div>
        </div>
      </Reveal>

      {/* toolbar */}
      <Reveal delay={0.05}>
        <div className="glass rounded-2xl p-4 mt-6 grid gap-3 md:grid-cols-[1fr_180px] items-center relative z-30">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama penulis..." />
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
      </Reveal>

      {/* content */}
      <div className="mt-6">
        {isLoading ? (
          <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Card key={i} className="animate-pulse">
                <div className="h-14 w-14 rounded-2xl bg-white/5" />
                <div className="h-4 bg-white/5 rounded mt-4 w-2/3" />
                <div className="h-3 bg-white/5 rounded mt-2 w-full" />
              </Card>
            ))}
          </div>
        ) : isError ? (
          <Card className="border border-rose-500/30 bg-rose-500/5">
            <div className="font-semibold text-rose-200">Gagal memuat penulis</div>
            <div className="text-sm text-white/60 mt-1">{(error as Error)?.message}</div>
          </Card>
        ) : rows.length === 0 ? (
          <Card>
            <div className="font-semibold">Penulis tidak ditemukan</div>
            <div className="text-sm text-white/60 mt-1">Coba kata kunci lain atau reset filter.</div>
          </Card>
        ) : (
          <>
            <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {rows.map((a) => (
                <Reveal key={a.id_penulis} delay={0.02}>
                  <Card className="group hover:bg-white/10 transition relative overflow-hidden">
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition bg-gradient-to-br from-indigo-500/10 to-transparent" />
                    <div className="relative">
                      <div className="flex items-center gap-3">
                        <AuthorAvatar name={a.nama_penulis} src={a.foto_penulis ?? null} />
                        <div className="min-w-0">
                          <div className="font-semibold line-clamp-1">{a.nama_penulis}</div>
                          <div className="text-xs text-white/60 line-clamp-2">
                            {a.biografi || "Belum ada biografi."}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 flex gap-2">
                        <Link href={`/authors/${a.id_penulis}`} className="w-full">
                          <Button className="w-full">Detail</Button>
                        </Link>
                        <Link
                          href={`/books?search=${encodeURIComponent(a.nama_penulis)}`}
                          className="w-full"
                        >
                          <Button variant="secondary" className="w-full">
                            Cari Buku
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </Card>
                </Reveal>
              ))}
            </div>

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
