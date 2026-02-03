/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import Card from "@/components/ui/card";
import Button from "@/components/ui/button";
import Reveal from "@/components/ui/reveal";
import type { BooksPaged, Book, Penulis } from "@/lib/types";
import { formatRupiah } from "@/lib/utils";

/* ---------------- helpers ---------------- */

function initials(name: string) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const a = (parts[0]?.[0] || "?").toUpperCase();
  const b = (parts[1]?.[0] || "").toUpperCase();
  return (a + b).slice(0, 2);
}

function normalizeBooksPaged(raw: any): BooksPaged {
  if (raw?.meta && Array.isArray(raw?.data)) return raw as BooksPaged;
  if (raw?.data?.meta && Array.isArray(raw?.data?.data)) return raw.data as BooksPaged;

  return {
    meta: { page: 1, limit: 12, total: 0, total_pages: 1, sort_by: "created_at", order: "desc" },
    data: [],
  };
}

async function fetchJson(url: string, init?: RequestInit) {
  const res = await fetch(url, { cache: "no-store", ...init });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = data?.detail || `Request gagal (${res.status})`;
    const err = new Error(msg) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return data;
}

/* ---------------- API ---------------- */

async function fetchAuthorDetail(id: string): Promise<Penulis> {
  const raw = await fetchJson(`/api/authors/${id}`);
  return (raw?.data ?? raw) as Penulis; // aman kalau backend bungkus data
}

/**
 * Ambil buku by author:
 * - pakai /api/books/paged (proxy Next) supaya konsisten
 * - coba beberapa nama param filter author
 * - fallback terakhir pakai search=nama_penulis
 */
async function fetchBooksByAuthor(args: {
  authorId: number;
  authorName: string;
  page: number;
  limit: number;
}): Promise<BooksPaged> {
  const { authorId, authorName, page, limit } = args;

  const candidates = ["id_penulis", "penulis_id", "author_id"] as const;

  for (const key of candidates) {
    try {
      const qs = new URLSearchParams();
      qs.set("page", String(page));
      qs.set("limit", String(limit));
      qs.set("sort_by", "created_at");
      qs.set("order", "desc");
      qs.set(key, String(authorId));

      const raw = await fetchJson(`/api/books/paged?${qs.toString()}`);
      return normalizeBooksPaged(raw);
    } catch {
      // lanjut kandidat berikutnya
    }
  }

  // fallback: search nama penulis (paling aman)
  const qs = new URLSearchParams();
  qs.set("page", String(page));
  qs.set("limit", String(limit));
  qs.set("sort_by", "created_at");
  qs.set("order", "desc");
  if (authorName) qs.set("search", authorName);

  const raw = await fetchJson(`/api/books/paged?${qs.toString()}`);
  return normalizeBooksPaged(raw);
}

async function addToCart(bookId: number) {
  return fetchJson("/api/cart/items", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id_buku: bookId, jumlah: 1 }),
  });
}

/* ---------------- small UI comps ---------------- */

function Avatar({ name, src }: { name: string; src?: string | null }) {
  const [broken, setBroken] = useState(false);
  const show = !!src && !broken;

  return (
    <div className="relative h-20 w-20 sm:h-24 sm:w-24 rounded-3xl overflow-hidden bg-white/5 ring-1 ring-white/10 flex items-center justify-center">
      {show ? (
        <img
          src={src!}
          alt={name}
          className="h-full w-full object-cover"
          onError={() => setBroken(true)}
        />
      ) : (
        <div className="text-lg font-black text-white/70">{initials(name)}</div>
      )}
    </div>
  );
}

function Cover({ title, src }: { title: string; src?: string | null }) {
  const [broken, setBroken] = useState(false);
  const show = !!src && !broken;

  return (
    <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-white/5 border border-white/10">
      {show ? (
        <img
          src={src!}
          alt={title}
          className="h-full w-full object-cover"
          onError={() => setBroken(true)}
        />
      ) : (
        <div className="h-full w-full flex items-center justify-center text-xs text-white/50 px-4 text-center">
          {title}
        </div>
      )}
    </div>
  );
}

/* ---------------- page ---------------- */

export default function AuthorDetailPage() {
  const params = useParams();
  const router = useRouter();
  const qc = useQueryClient();

  const idRaw = (params as any)?.id;
  const id = Number(Array.isArray(idRaw) ? idRaw[0] : idRaw);

  // pagination buku penulis (bisa kamu tampilkan)
  const [page, setPage] = useState(1);
  const limit = 8;

  const {
    data: author,
    isLoading: loadingAuthor,
    isError: authorErr,
    error: authorError,
  } = useQuery({
    queryKey: ["author", id],
    queryFn: () => fetchAuthorDetail(String(id)),
    enabled: Number.isFinite(id) && id > 0,
    staleTime: 30_000,
  });

  const {
    data: booksPaged,
    isLoading: loadingBooks,
    isError: booksErr,
    error: booksError,
    isFetching,
  } = useQuery({
    queryKey: ["author-books", id, page, limit, author?.nama_penulis],
    queryFn: () =>
      fetchBooksByAuthor({
        authorId: id,
        authorName: author?.nama_penulis || "",
        page,
        limit,
      }),
    enabled: !!author,
    staleTime: 20_000,
  });

  const books: Book[] = booksPaged?.data ?? [];
  const meta = booksPaged?.meta;

  const mutAdd = useMutation({
    mutationFn: (bookId: number) => addToCart(bookId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["cart"] });
      await qc.invalidateQueries({ queryKey: ["cart-summary"] });
      alert("Berhasil masuk keranjang ✅");
    },
    onError: (e: any) => {
      const status = (e as Error & { status?: number })?.status;
      const msg = e?.message || "Gagal menambah ke keranjang";

      if (status === 401 || status === 403) {
        router.push(`/login?next=/authors/${id}`);
        return;
      }
      alert(msg);
    },
  });

  const authorName = author?.nama_penulis || "Penulis";
  const moreHref = useMemo(() => {
    const q = encodeURIComponent(author?.nama_penulis || "");
    return q ? `/books?search=${q}` : "/books";
  }, [author?.nama_penulis]);

  return (
    <div className="container py-10">
      <Reveal>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black">Detail Penulis</h1>
            <p className="text-white/60 mt-1">Profil penulis & rekomendasi bukunya.</p>
          </div>

          <Button variant="secondary" onClick={() => router.push("/authors")}>
            ← Kembali
          </Button>
        </div>
      </Reveal>

      {/* AUTHOR HEADER */}
      <div className="mt-6">
        {loadingAuthor ? (
          <Card className="animate-pulse">
            <div className="h-6 bg-white/5 rounded w-56" />
            <div className="h-4 bg-white/5 rounded w-72 mt-3" />
          </Card>
        ) : authorErr ? (
          <Card className="border border-rose-500/30 bg-rose-500/5">
            <div className="font-semibold text-rose-200">Gagal memuat penulis</div>
            <div className="text-sm text-white/60 mt-1">{(authorError as Error)?.message}</div>
          </Card>
        ) : !author ? null : (
          <Reveal delay={0.02}>
            <Card className="relative overflow-hidden">
              <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-500/15 blur-3xl rounded-full" />
              <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-sky-400/10 blur-3xl rounded-full" />

              <div className="relative flex flex-col sm:flex-row gap-5 sm:items-center">
                <Avatar name={author.nama_penulis} src={author.foto_penulis ?? null} />

                <div className="min-w-0">
                  <div className="text-2xl font-extrabold leading-tight">{author.nama_penulis}</div>
                  <div className="text-sm text-white/60 mt-1 max-w-2xl">
                    {author.biografi || "Belum ada biografi penulis."}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link href={moreHref}>
                      <Button>Belanja Buku Penulis</Button>
                    </Link>
                    <Link href="/books">
                      <Button variant="secondary">Lihat Semua Buku</Button>
                    </Link>
                  </div>
                </div>
              </div>
            </Card>
          </Reveal>
        )}
      </div>

      {/* BOOKS GRID */}
      <div className="mt-8">
        <Reveal>
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-extrabold">Buku dari {authorName}</h2>
              <p className="text-white/60 mt-1">Rekomendasi terbaru yang tersedia di katalog.</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden md:inline text-xs text-white/50">
                {isFetching && meta ? "Memuat..." : meta ? `Page ${meta.page}/${meta.total_pages}` : ""}
              </span>
              <Link href={moreHref} className="text-sm text-indigo-300 hover:text-indigo-200">
                Lihat semua →
              </Link>
            </div>
          </div>
        </Reveal>

        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          {loadingBooks ? (
            Array.from({ length: 8 }).map((_, i) => (
              <Card key={i} className="animate-pulse">
                <div className="aspect-[4/3] rounded-xl bg-white/5" />
                <div className="h-4 bg-white/5 rounded mt-3" />
                <div className="h-3 bg-white/5 rounded mt-2 w-2/3" />
              </Card>
            ))
          ) : booksErr ? (
            <Card className="sm:col-span-2 md:col-span-4 border border-rose-500/30 bg-rose-500/5">
              <div className="font-semibold text-rose-200">Gagal memuat buku penulis</div>
              <div className="text-sm text-white/60 mt-1">{(booksError as Error)?.message}</div>
            </Card>
          ) : books.length === 0 ? (
            <Card className="sm:col-span-2 md:col-span-4">
              <div className="font-semibold">Belum ada buku ditemukan</div>
              <div className="text-sm text-white/60 mt-1">
                Jika backend belum support filter penulis, klik “Lihat semua” untuk cari via search.
              </div>
              <div className="mt-4">
                <Link href={moreHref}>
                  <Button variant="secondary">Cari di katalog</Button>
                </Link>
              </div>
            </Card>
          ) : (
            books.map((b) => (
              <Reveal key={b.id_buku} delay={0.02}>
                <Card className="group hover:bg-white/10 transition">
                  <Link href={`/books/${b.id_buku}`}>
                    <Cover title={b.judul} src={b.cover_image ?? null} />
                  </Link>

                  <div className="mt-3 font-semibold line-clamp-2">{b.judul}</div>
                  <div className="text-xs text-white/60 mt-1">{b.genre?.nama_genre || "—"}</div>

                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="font-bold text-indigo-200">{formatRupiah(Number(b.harga || 0))}</div>
                    <div className="text-[11px] text-white/50">
                      Stok: <span className="text-white/70">{Number(b.stok ?? 0)}</span>
                    </div>
                  </div>

                  <div className="mt-3 flex gap-2">
                    <Button
                      className="w-full"
                      disabled={mutAdd.isPending || Number(b.stok ?? 0) <= 0}
                      onClick={() => mutAdd.mutate(b.id_buku)}
                      title={Number(b.stok ?? 0) <= 0 ? "Stok habis" : "Tambah ke keranjang"}
                    >
                      {Number(b.stok ?? 0) <= 0 ? "Stok Habis" : mutAdd.isPending ? "Menambah..." : "Tambah ke Cart"}
                    </Button>

                    <Link href={`/books/${b.id_buku}`} className="w-full">
                      <Button variant="secondary" className="w-full">
                        Detail
                      </Button>
                    </Link>
                  </div>
                </Card>
              </Reveal>
            ))
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

            <Button
              variant="secondary"
              disabled={meta.page >= meta.total_pages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next →
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
