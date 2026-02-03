/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import Image from "next/image";

import Card from "@/components/ui/card";
import Input from "@/components/ui/input";
import Button from "@/components/ui/button";
import Reveal from "@/components/ui/reveal";
import Select, { type SelectOption } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";

import type { BooksPaged, Genre } from "@/lib/types";
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

async function fetchJson(url: string, init?: RequestInit) {
  const res = await fetch(url, {
    cache: "no-store",
    credentials: "include",
    ...init,
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const msg =
      toPlainMessage(data?.detail) ||
      toPlainMessage(data?.message) ||
      `Request gagal (${res.status})`;
    const err = new Error(msg) as HttpErr;
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

function normalizeGenres(raw: any): Genre[] {
  if (Array.isArray(raw)) return raw;
  if (raw && Array.isArray(raw.data)) return raw.data;
  if (raw && Array.isArray(raw.genres)) return raw.genres;
  if (raw?.data?.data && Array.isArray(raw.data.data)) return raw.data.data;
  return [];
}

function normalizeBooksPaged(raw: any): BooksPaged {
  if (raw?.meta && Array.isArray(raw?.data)) return raw as BooksPaged;
  if (raw?.data?.meta && Array.isArray(raw?.data?.data)) return raw.data as BooksPaged;

  return {
    meta: { page: 1, limit: 12, total: 0, total_pages: 1, sort_by: "created_at", order: "desc" },
    data: [],
  };
}

function buildQuery(obj: Record<string, string | number | undefined>) {
  const qs = new URLSearchParams();
  Object.entries(obj).forEach(([k, v]) => {
    if (v === undefined || v === null || String(v).length === 0) return;
    qs.set(k, String(v));
  });
  return qs.toString();
}

function isRemoteUrl(src?: string | null) {
  const s = String(src ?? "").trim();
  return s.startsWith("http://") || s.startsWith("https://");
}
function isSvg(path?: string | null) {
  return String(path ?? "").toLowerCase().endsWith(".svg");
}

function toIntOrNull(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/* ---------------- API fetchers ---------------- */

async function fetchGenres(): Promise<Genre[]> {
  // ✅ pakai Next API route (lebih aman & konsisten)
  const raw = await fetchJson("/api/genres");
  return normalizeGenres(raw);
}

async function fetchBooks(params: Record<string, string | number | undefined>): Promise<BooksPaged> {
  const qs = buildQuery(params);
  const raw = await fetchJson(`/api/books/paged?${qs}`);
  return normalizeBooksPaged(raw);
}

async function addToCart(id_buku: number) {
  return fetchJson(`/api/cart/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id_buku, jumlah: 1 }),
  });
}

/* ---------------- page ---------------- */

type SortKey = "newest" | "price_asc" | "price_desc";

function sortToParams(sort: SortKey): { sort_by: string; order: "asc" | "desc" } {
  if (sort === "price_asc") return { sort_by: "harga", order: "asc" };
  if (sort === "price_desc") return { sort_by: "harga", order: "desc" };
  return { sort_by: "created_at", order: "desc" };
}

function paramsToSort(sort_by?: string | null, order?: string | null): SortKey {
  const sb = String(sort_by ?? "").toLowerCase();
  const od = String(order ?? "").toLowerCase();
  if (sb === "harga" && od === "asc") return "price_asc";
  if (sb === "harga" && od === "desc") return "price_desc";
  return "newest";
}

export default function BooksPage() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  // URL source (support alias biar nyambung dari halaman lain)
  const urlSearch = sp.get("search") ?? sp.get("q") ?? "";
  const urlGenreId = sp.get("genre_id") ?? ""; // id
  const urlGenreName = sp.get("genre") ?? ""; // nama (opsional)
  const urlPage = Number(sp.get("page") ?? 1);

  // sort dari URL (support sort_by & order)
  const urlSort = paramsToSort(sp.get("sort_by"), sp.get("order"));

  // editable state
  const [search, setSearch] = useState(urlSearch);
  const [genreId, setGenreId] = useState(urlGenreId);
  const [page, setPage] = useState(urlPage);
  const [sort, setSort] = useState<SortKey>(urlSort);

  // sync state from URL
  useEffect(() => setSearch(urlSearch), [urlSearch]);
  useEffect(() => setGenreId(urlGenreId), [urlGenreId]);
  useEffect(() => setPage(urlPage), [urlPage]);
  useEffect(() => setSort(urlSort), [urlSort]);

  // genres
  const {
    data: genres = [],
    isLoading: loadingGenres,
    isError: genresError,
  } = useQuery({
    queryKey: ["genres"],
    queryFn: fetchGenres,
    staleTime: 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  // kalau user datang dari link yang cuma bawa "genre" (nama), mapping ke id
  useEffect(() => {
    if (!urlGenreName || genreId) return;
    if (!Array.isArray(genres) || genres.length === 0) return;

    const hit = genres.find(
      (g) => String(g.nama_genre ?? "").trim().toLowerCase() === String(urlGenreName).trim().toLowerCase()
    );
    if (hit?.id_genre) setGenreId(String(hit.id_genre));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlGenreName, genres]);

  const genreOptions: SelectOption[] = useMemo(() => {
    const base: SelectOption[] = [
      { value: "", label: "Semua Genre", subLabel: "Tampilkan semua kategori" },
    ];
    const mapped: SelectOption[] = (Array.isArray(genres) ? genres : []).map((g) => ({
      value: String(g.id_genre),
      label: g.nama_genre,
      subLabel: g.deskripsi_genre ?? undefined,
    }));
    return base.concat(mapped);
  }, [genres]);

  const sortOptions: SelectOption[] = useMemo(
    () => [
      { value: "newest", label: "Terbaru", subLabel: "Sort by created_at desc" },
      { value: "price_asc", label: "Harga Termurah", subLabel: "Sort by harga asc" },
      { value: "price_desc", label: "Harga Termahal", subLabel: "Sort by harga desc" },
    ],
    []
  );

  const { sort_by, order } = useMemo(() => sortToParams(sort), [sort]);

  // books params
  const queryParams = useMemo(
    () => ({
      page,
      limit: 12,
      search: search || undefined,
      genre_id: genreId ? Number(genreId) : undefined,
      sort_by,
      order,
    }),
    [page, search, genreId, sort_by, order]
  );

  const { data: booksPaged, isLoading, isFetching, isError, error } = useQuery({
    queryKey: ["books", queryParams],
    queryFn: () => fetchBooks(queryParams),
    placeholderData: (prev) => prev,
    staleTime: 10_000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const books = booksPaged?.data ?? [];
  const meta = booksPaged?.meta;

  function navigate(nextPage: number) {
    const q = buildQuery({
      search: search || undefined,
      genre_id: genreId || undefined,
      page: nextPage,
      sort_by,
      order,
    });
    const href = q ? `${pathname}?${q}` : pathname;
    startTransition(() => router.push(href));
  }

  // auto debounce search
  useEffect(() => {
    if (search === urlSearch) return;
    const t = setTimeout(() => navigate(1), 450);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // auto apply genre
  useEffect(() => {
    if (genreId === urlGenreId) return;
    navigate(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [genreId]);

  // auto apply sort
  useEffect(() => {
    if (sort === urlSort) return;
    navigate(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort]);

  function resetFilters() {
    setSearch("");
    setGenreId("");
    setSort("newest");
    setPage(1);
    startTransition(() => router.push(pathname));
  }

  const addMut = useMutation({
    mutationFn: (id_buku: number) => addToCart(id_buku),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["cart"] });
      await qc.invalidateQueries({ queryKey: ["cart-summary"] });
      toast({ variant: "success", title: "Berhasil", message: "Buku masuk ke keranjang." });
    },
    onError: (e: any) => {
      const status = (e as HttpErr)?.status;

      if (status === 401 || status === 403) {
        const current = sp.toString() ? `${pathname}?${sp.toString()}` : pathname;
        toast({
          variant: "info",
          title: "Login dulu",
          message: "Silakan login untuk menambah buku ke keranjang.",
        });
        router.push(`/login?next=${encodeURIComponent(current)}`);
        return;
      }

      toast({
        variant: "error",
        title: "Gagal",
        message: (e as Error)?.message || "Terjadi kesalahan saat menambah ke keranjang.",
      });
    },
  });

  return (
    <div className="container py-10">
      <Reveal>
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black">Katalog Buku</h1>
            <p className="text-white/60 mt-1">Cari buku favoritmu dengan cepat.</p>
          </div>

          <div className="hidden md:flex items-center gap-2 text-xs text-white/50">
            {isFetching ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-indigo-400 animate-pulse" />
                Memuat...
              </span>
            ) : meta ? (
              <span>
                Page <b className="text-white/80">{meta.page}</b>/{meta.total_pages}
              </span>
            ) : null}
          </div>
        </div>
      </Reveal>

      <Reveal delay={0.05}>
        {/* ✅ tambah sort kecil, masih satu bar dan tidak merusak layout */}
        <div className="glass rounded-2xl p-4 mt-6 grid gap-3 md:grid-cols-[1.2fr_1fr_1fr_160px] items-center relative z-30">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari judul buku..." />

          <div className="min-w-0">
            <Select
              value={genreId}
              onChange={(v) => setGenreId(v)}
              options={genreOptions}
              placeholder={loadingGenres ? "Memuat genre..." : "Pilih genre"}
              disabled={Boolean(loadingGenres || genresError)}
            />
          </div>

          <div className="min-w-0">
            <Select
              value={sort}
              onChange={(v) => setSort((v as SortKey) || "newest")}
              options={sortOptions}
              placeholder="Urutkan"
              disabled={false}
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={() => navigate(1)} className="w-full" disabled={isPending}>
              Terapkan
            </Button>
            <Button variant="secondary" onClick={resetFilters} className="hidden md:inline-flex" disabled={isPending}>
              Reset
            </Button>
          </div>
        </div>
      </Reveal>

      {isError && (
        <div className="mt-6">
          <Card className="border border-red-500/30 bg-red-500/5">
            <div className="font-semibold text-red-200">Gagal memuat buku</div>
            <div className="text-sm text-white/60 mt-1">{(error as Error)?.message}</div>
            <div className="mt-4 flex gap-2">
              <Button variant="secondary" onClick={() => navigate(page)}>
                Coba lagi
              </Button>
              <Button variant="ghost" onClick={resetFilters}>
                Reset
              </Button>
            </div>
          </Card>
        </div>
      )}

      <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4 mt-6">
        {isLoading && books.length === 0 ? (
          Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <div className="aspect-4/3 rounded-xl bg-white/5" />
              <div className="h-4 bg-white/5 rounded mt-3" />
              <div className="h-3 bg-white/5 rounded mt-2 w-2/3" />
            </Card>
          ))
        ) : books.length === 0 ? (
          <Card className="sm:col-span-2 md:col-span-4">
            <div className="font-semibold">Tidak ada buku ditemukan</div>
            <div className="text-sm text-white/60 mt-1">Coba kata kunci lain atau reset filter.</div>
            <div className="mt-4 flex gap-2">
              <Button variant="secondary" onClick={resetFilters}>
                Reset filter
              </Button>
              <Link href="/">
                <Button variant="ghost">Kembali</Button>
              </Link>
            </div>
          </Card>
        ) : (
          books.map((b) => {
            const stok = Number(b.stok ?? 0);
            const cover = b.cover_image || "/illustrations/hero-books.svg";
            const unoptimized = isRemoteUrl(cover) || isSvg(cover);

            return (
              <Reveal key={b.id_buku} delay={0.02}>
                <Link href={`/books/${b.id_buku}`}>
                  <Card className="group hover:bg-white/10 transition">
                    <div className="relative aspect-4/3 rounded-xl overflow-hidden bg-white/5 border border-white/10">
                      <Image
                        src={cover}
                        alt={b.judul}
                        fill
                        unoptimized={unoptimized}
                        sizes="(max-width: 768px) 100vw, 25vw"
                        className="object-cover transition duration-300 group-hover:scale-[1.03]"
                      />

                      <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/55 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition" />

                      {stok <= 0 && (
                        <div className="absolute left-3 top-3 rounded-full bg-rose-500/20 text-rose-100 text-xs px-2.5 py-1 ring-1 ring-rose-500/30">
                          Stok habis
                        </div>
                      )}

                      <button
                        className="absolute right-3 bottom-3 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-100 px-3 py-2 text-xs ring-1 ring-indigo-500/30 transition opacity-0 group-hover:opacity-100 disabled:opacity-40"
                        disabled={stok <= 0 || addMut.isPending}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          addMut.mutate(toIntOrNull(b.id_buku) ?? b.id_buku);
                        }}
                        title={stok <= 0 ? "Stok habis" : "Tambah ke keranjang"}
                      >
                        + Keranjang
                      </button>
                    </div>

                    <div className="mt-3 font-semibold line-clamp-2">{b.judul}</div>
                    <div className="text-xs text-white/60 mt-1">{b.penulis?.nama_penulis || "—"}</div>

                    <div className="mt-2 flex items-center justify-between gap-3">
                      <div className="font-bold text-indigo-200">{formatRupiah(Number(b.harga || 0))}</div>
                      <div className="text-[11px] text-white/50">
                        Stok: <span className="text-white/70 font-semibold">{stok}</span>
                      </div>
                    </div>
                  </Card>
                </Link>
              </Reveal>
            );
          })
        )}
      </div>

      {!!meta && meta.total_pages > 1 && (
        <div className="flex items-center justify-between mt-8">
          <Button variant="secondary" disabled={meta.page <= 1 || isPending} onClick={() => navigate(meta.page - 1)}>
            ← Prev
          </Button>

          <div className="text-sm text-white/60">
            Page <b className="text-white/80">{meta.page}</b> / <b className="text-white/80">{meta.total_pages}</b>
          </div>

          <Button
            variant="secondary"
            disabled={meta.page >= meta.total_pages || isPending}
            onClick={() => navigate(meta.page + 1)}
          >
            Next →
          </Button>
        </div>
      )}
    </div>
  );
}
