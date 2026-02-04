/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import Card from "@/components/ui/card";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import Reveal from "@/components/ui/reveal";

import type { Genre } from "@/lib/types";

type PagingMeta = { page: number; limit: number; total: number; total_pages: number };
type Paged<T> = { meta: PagingMeta; data: T[] };

function normalizePaged<T>(x: any): Paged<T> {
  if (x?.meta && Array.isArray(x?.data)) return x as Paged<T>;
  if (x?.data?.meta && Array.isArray(x?.data?.data)) return x.data as Paged<T>;
  if (Array.isArray(x)) return { meta: { page: 1, limit: x.length, total: x.length, total_pages: 1 }, data: x };
  return { meta: { page: 1, limit: 10, total: 0, total_pages: 1 }, data: [] };
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

async function fetchGenresPaged(page: number, limit: number, q: string) {
  const qs = new URLSearchParams();
  qs.set("page", String(page));
  qs.set("limit", String(limit));
  if (q.trim()) qs.set("q", q.trim());

  const res = await fetch(`/api/admin/genres/paged?${qs.toString()}`, { cache: "no-store" });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.detail || "Gagal memuat genre");
  return normalizePaged<Genre>(data);
}

async function createGenre(payload: { nama_genre: string; deskripsi_genre?: string | null; slug?: string | null }) {
  const res = await fetch("/api/admin/genres", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.detail || "Gagal membuat genre");
  return data;
}

export default function AdminGenresPage() {
  const qc = useQueryClient();

  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [q, setQ] = useState("");

  // form
  const [nama, setNama] = useState("");
  const [desc, setDesc] = useState("");
  const slug = useMemo(() => (nama.trim() ? slugify(nama) : ""), [nama]);

  const { data, isLoading, isError, error, isFetching } = useQuery({
    queryKey: ["admin-genres", page, limit, q],
    queryFn: () => fetchGenresPaged(page, limit, q),
    staleTime: 10_000,
  });

  const genres = data?.data ?? [];
  const meta = data?.meta;

  const createMut = useMutation({
    mutationFn: () =>
      createGenre({
        nama_genre: nama.trim(),
        deskripsi_genre: desc.trim() ? desc.trim() : null,
        slug: slug || null, // ✅ otomatis
      }),
    onSuccess: async () => {
      setNama("");
      setDesc("");
      await qc.invalidateQueries({ queryKey: ["admin-genres"] });
      await qc.refetchQueries({ queryKey: ["admin-genres"] });
      alert("Genre berhasil dibuat ✅");
    },
    onError: (e: any) => alert(e.message),
  });

  return (
    <div>
      <Reveal>
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black">Admin • Genres</h1>
            <p className="text-white/60 mt-1">Kategori (genre) untuk filter katalog.</p>
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

      {/* toolbar */}
      <div className="glass rounded-2xl p-4 mt-6 grid gap-3 md:grid-cols-[1fr_180px] items-center relative z-30">
        <Input
          value={q}
          onChange={(e) => {
            setPage(1);
            setQ(e.target.value);
          }}
          placeholder="Cari genre..."
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
              <div className="font-semibold text-rose-200">Gagal memuat genre</div>
              <div className="text-sm text-white/60 mt-1">{(error as Error)?.message}</div>
            </Card>
          ) : genres.length === 0 ? (
            <Card>
              <div className="font-semibold">Belum ada genre</div>
              <div className="text-sm text-white/60 mt-1">Buat genre dari panel kanan.</div>
            </Card>
          ) : (
            genres.map((g) => (
              <Card key={g.id_genre} className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-semibold">{g.nama_genre}</div>
                  <div className="text-xs text-white/60 mt-1 line-clamp-2">
                    {g.deskripsi_genre || "—"}
                  </div>
                  <div className="text-[11px] text-white/40 mt-1">
                    ID: {g.id_genre} • Slug: <span className="text-white/60">{g.slug || "—"}</span>
                  </div>
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

        {/* create */}
        <div className="lg:sticky lg:top-24 h-fit">
          <Card>
            <div className="font-semibold">Tambah Genre</div>
            <p className="text-sm text-white/60 mt-1">
              Slug dibuat otomatis dari nama (bisa kamu biarkan).
            </p>

            <div className="mt-4 grid gap-3">
              <Input value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Nama genre" />
              <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Deskripsi (opsional)" />

              <div className="text-xs text-white/50">
                Preview slug: <span className="text-white/80">{slug || "—"}</span>
              </div>

              <Button
                className="w-full"
                disabled={createMut.isPending || nama.trim().length < 2}
                onClick={() => createMut.mutate()}
              >
                {createMut.isPending ? "Menyimpan..." : "Simpan"}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
