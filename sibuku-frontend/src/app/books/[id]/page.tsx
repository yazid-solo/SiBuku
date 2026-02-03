/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import Card from "@/components/ui/card";
import Button from "@/components/ui/button";
import Reveal from "@/components/ui/reveal";
import Input from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

import { env } from "@/lib/env";
import type { Book, BooksPaged } from "@/lib/types";
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

function normalizeBooksPaged(raw: any): BooksPaged {
  if (raw?.meta && Array.isArray(raw?.data)) return raw as BooksPaged;
  if (raw?.data?.meta && Array.isArray(raw?.data?.data)) return raw.data as BooksPaged;

  return {
    meta: { page: 1, limit: 8, total: 0, total_pages: 1, sort_by: "created_at", order: "desc" },
    data: [],
  };
}

function clampQty(n: number, stok: number) {
  const max = Math.max(1, Number(stok || 0));
  const v = Number.isFinite(n) ? n : 1;
  return Math.min(Math.max(1, v), max);
}

function getGenreId(book: any): number | null {
  const n = Number(book?.id_genre ?? book?.genre?.id_genre ?? book?.genres?.id_genre ?? NaN);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/* ---------------- API ---------------- */

async function fetchBook(id: string): Promise<Book> {
  // ✅ coba lewat Next API dulu (kalau kamu punya /api/books/[id])
  try {
    return (await fetchJson(`/api/books/${id}`)) as Book;
  } catch (e: any) {
    // fallback ke backend langsung (biar project kamu tetap jalan walau /api/books/[id] belum ada)
    return (await fetchJson(`${env.apiBaseUrl}/books/${id}`)) as Book;
  }
}

async function fetchRekomendasiByGenre(genreId: number, currentBookId: number): Promise<Book[]> {
  // ✅ rekomendasi sebaiknya lewat /api/books/paged (lebih konsisten, tidak CORS)
  try {
    const raw = await fetchJson(
      `/api/books/paged?page=1&limit=8&sort_by=created_at&order=desc&genre_id=${genreId}`
    );
    const paged = normalizeBooksPaged(raw);
    return (paged.data || []).filter((b) => b.id_buku !== currentBookId).slice(0, 4);
  } catch {
    // fallback backend langsung
    const raw = await fetchJson(
      `${env.apiBaseUrl}/books/paged?page=1&limit=8&sort_by=created_at&order=desc&genre_id=${genreId}`
    );
    const paged = normalizeBooksPaged(raw);
    return (paged.data || []).filter((b) => b.id_buku !== currentBookId).slice(0, 4);
  }
}

async function addToCart(payload: { id_buku: number; jumlah: number }) {
  // POST /api/cart/items -> proxy -> backend (cookie auth ikut)
  return fetchJson("/api/cart/items", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

/* ---------------- UI small components ---------------- */

function CoverImage({ src, alt }: { src?: string | null; alt: string }) {
  const [broken, setBroken] = useState(false);
  const show = !!src && !broken;

  return (
    <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-white/5 border border-white/10">
      {show ? (
        <img
          src={src!}
          alt={alt}
          className="h-full w-full object-cover"
          onError={() => setBroken(true)}
        />
      ) : (
        <div className="h-full w-full flex items-center justify-center text-sm text-white/50 px-6 text-center">
          {alt}
        </div>
      )}
    </div>
  );
}

/* ---------------- page ---------------- */

export default function BookDetailPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useToast();

  const params = useParams();
  const id = String((params as any)?.id ?? "");

  const [qty, setQty] = useState<number>(1);

  const { data: book, isLoading, isError, error } = useQuery({
    queryKey: ["book", id],
    queryFn: () => fetchBook(String(id)),
    enabled: !!id,
    staleTime: 30_000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const price = useMemo(() => Number(book?.harga || 0), [book?.harga]);
  const stok = useMemo(() => Number(book?.stok || 0), [book?.stok]);
  const safeQty = useMemo(() => clampQty(qty, stok), [qty, stok]);
  const subtotal = useMemo(() => price * safeQty, [price, safeQty]);

  // ✅ FIX: side-effect jangan pakai useMemo
  useEffect(() => {
    if (!book) return;
    setQty((prev) => clampQty(prev, stok));
  }, [book?.id_buku, stok, book]);

  // rekomendasi by genre
  const genreId = useMemo(() => getGenreId(book), [book]);
  const { data: rekomendasi = [], isLoading: loadingRec } = useQuery({
    queryKey: ["book-rekomendasi", book?.id_buku, genreId],
    queryFn: () => fetchRekomendasiByGenre(Number(genreId), Number(book?.id_buku)),
    enabled: !!book?.id_buku && Number(genreId) > 0,
    staleTime: 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const mut = useMutation({
    mutationFn: addToCart,
    onMutate: () => toast({ variant: "info", title: "Memproses", message: "Menambah ke keranjang..." }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["cart"] });
      await qc.invalidateQueries({ queryKey: ["cart-summary"] });
      toast({ variant: "success", title: "Berhasil", message: "Buku masuk keranjang ✅" });
    },
    onError: (e: any) => {
      const status = (e as HttpErr)?.status;
      const msg = (e as Error)?.message || "Gagal menambah ke keranjang";

      if (status === 401 || status === 403) {
        router.push(`/login?next=/books/${id}`);
        return;
      }
      toast({ variant: "error", title: "Gagal", message: msg });
    },
  });

  if (isLoading) {
    return (
      <div className="container py-10">
        <div className="grid lg:grid-cols-2 gap-6">
          <Card className="animate-pulse">
            <div className="aspect-[4/3] rounded-2xl bg-white/5" />
          </Card>
          <Card className="animate-pulse">
            <div className="h-6 w-2/3 bg-white/5 rounded" />
            <div className="h-4 w-1/2 bg-white/5 rounded mt-3" />
            <div className="h-10 w-1/3 bg-white/5 rounded mt-6" />
            <div className="h-28 bg-white/5 rounded mt-6" />
          </Card>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="container py-10">
        <Card className="border border-rose-500/30 bg-rose-500/5">
          <div className="font-semibold text-rose-200">Gagal memuat buku</div>
          <div className="text-sm text-white/60 mt-1">{(error as Error)?.message}</div>
          <div className="mt-4 flex gap-2">
            <Button variant="secondary" onClick={() => window.location.reload()}>
              Coba lagi
            </Button>
            <Link href="/books">
              <Button variant="ghost">Kembali ke katalog</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="container py-10">
        <Card>
          <div className="font-semibold">Buku tidak ditemukan.</div>
          <div className="mt-4">
            <Link href="/books">
              <Button variant="secondary">Kembali ke katalog</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const disabledAdd = mut.isPending || stok <= 0;

  const authorName = book.penulis?.nama_penulis ?? (book as any)?.author?.nama_penulis ?? "—";
  const genreName = (book as any)?.genre?.nama_genre ?? (book as any)?.genres?.nama_genre ?? "—";

  return (
    <div className="container py-10">
      {/* breadcrumb-ish */}
      <Reveal>
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm text-white/50 min-w-0">
            <Link href="/books" className="hover:text-white/80">
              Katalog
            </Link>
            <span className="mx-2 text-white/30">/</span>
            <span className="text-white/80 line-clamp-1">{book.judul}</span>
          </div>

          <Button variant="secondary" onClick={() => router.push("/books")}>
            ← Kembali
          </Button>
        </div>
      </Reveal>

      <div className="mt-6 grid lg:grid-cols-2 gap-6 items-start">
        {/* LEFT */}
        <Reveal>
          <div className="grid gap-4">
            <Card className="relative overflow-hidden">
              <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-500/15 blur-3xl rounded-full" />
              <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-sky-400/10 blur-3xl rounded-full" />
              <div className="relative">
                <CoverImage src={book.cover_image || null} alt={book.judul} />
              </div>
            </Card>

            <Card>
              <div className="font-semibold mb-2">Deskripsi</div>
              <p className="text-sm text-white/70 leading-relaxed">
                {book.deskripsi || "Belum ada deskripsi."}
              </p>
            </Card>
          </div>
        </Reveal>

        {/* RIGHT: buy box */}
        <Reveal delay={0.05}>
          <div className="lg:sticky lg:top-24 grid gap-4">
            <Card className="relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent" />
              <div className="relative">
                <h1 className="text-3xl font-black leading-tight">{book.judul}</h1>

                <div className="text-white/60 mt-2">
                  {authorName}
                  <span className="mx-2 text-white/30">•</span>
                  {genreName}
                </div>

                <div className="mt-5 flex items-end justify-between gap-3">
                  <div>
                    <div className="text-xs text-white/60">Harga</div>
                    <div className="text-2xl font-extrabold text-indigo-200">{formatRupiah(price)}</div>
                  </div>

                  <div className="text-sm text-white/60">
                    Stok: <span className="text-white/90 font-semibold">{stok}</span>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-[1fr_1.2fr] gap-3 items-end">
                  <div>
                    <div className="text-xs text-white/60 mb-2">Jumlah</div>
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => setQty((q) => clampQty(q - 1, stok))}
                        disabled={stok <= 0 || safeQty <= 1}
                        title="Kurangi"
                      >
                        −
                      </Button>

                      <Input
                        type="number"
                        value={safeQty}
                        min={1}
                        max={Math.max(1, stok)}
                        onChange={(e) => setQty(clampQty(Number(e.target.value || 1), stok))}
                      />

                      <Button
                        variant="secondary"
                        onClick={() => setQty((q) => clampQty(q + 1, stok))}
                        disabled={stok <= 0 || safeQty >= Math.max(1, stok)}
                        title="Tambah"
                      >
                        +
                      </Button>
                    </div>
                  </div>

                  <Card className="bg-white/5 border border-white/10">
                    <div className="text-xs text-white/60">Subtotal</div>
                    <div className="text-lg font-extrabold text-white/90">{formatRupiah(subtotal)}</div>
                    <div className="text-[11px] text-white/50 mt-1">
                      {safeQty} × {formatRupiah(price)}
                    </div>
                  </Card>
                </div>

                <div className="mt-5 flex gap-3">
                  <Button
                    className="flex-1"
                    disabled={disabledAdd}
                    onClick={() =>
                      mut.mutate({
                        id_buku: book.id_buku,
                        jumlah: safeQty,
                      })
                    }
                  >
                    {stok <= 0 ? "Stok Habis" : mut.isPending ? "Menambahkan..." : "+ Tambah ke Keranjang"}
                  </Button>

                  <Button variant="secondary" onClick={() => router.push("/cart")}>
                    Lihat Keranjang
                  </Button>
                </div>

                <div className="mt-4 text-xs text-white/50">
                  Status & pembayaran akan mengikuti data backend secara otomatis.
                </div>
              </div>
            </Card>

            {/* specs (opsional) */}
            <div className="grid gap-3 md:grid-cols-2">
              <Card>
                <div className="text-xs text-white/60">ISBN</div>
                <div className="font-semibold mt-1">{(book as any)?.isbn || "—"}</div>
              </Card>
              <Card>
                <div className="text-xs text-white/60">Berat</div>
                <div className="font-semibold mt-1">{(book as any)?.berat ? `${(book as any).berat} gr` : "—"}</div>
              </Card>
            </div>
          </div>
        </Reveal>
      </div>

      {/* REKOMENDASI */}
      <div className="mt-10">
        <Reveal>
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-extrabold">Rekomendasi untuk kamu</h2>
              <p className="text-white/60 mt-1">Buku lain yang satu genre.</p>
            </div>
            <Link
              href={genreId ? `/books?genre_id=${genreId}` : "/books"}
              className="text-sm text-indigo-300 hover:text-indigo-200"
            >
              Lihat semua →
            </Link>
          </div>
        </Reveal>

        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          {loadingRec ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="animate-pulse">
                <div className="aspect-[4/3] rounded-xl bg-white/5" />
                <div className="h-4 bg-white/5 rounded mt-3" />
                <div className="h-3 bg-white/5 rounded mt-2 w-2/3" />
              </Card>
            ))
          ) : rekomendasi.length === 0 ? (
            <Card className="sm:col-span-2 md:col-span-4">
              <div className="font-semibold">Belum ada rekomendasi.</div>
              <div className="text-sm text-white/60 mt-1">Coba lihat katalog atau cari buku lain.</div>
              <div className="mt-4">
                <Link href="/books">
                  <Button variant="secondary">Ke Katalog</Button>
                </Link>
              </div>
            </Card>
          ) : (
            rekomendasi.map((b) => (
              <Reveal key={b.id_buku} delay={0.02}>
                <Link href={`/books/${b.id_buku}`}>
                  <Card className="group hover:bg-white/10 transition">
                    <CoverImage src={b.cover_image || null} alt={b.judul} />
                    <div className="mt-3 font-semibold line-clamp-2">{b.judul}</div>
                    <div className="text-xs text-white/60 mt-1">{b.penulis?.nama_penulis || "—"}</div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div className="font-bold text-indigo-200">{formatRupiah(Number(b.harga || 0))}</div>
                      <div className="text-[11px] text-white/50">
                        Stok: <span className="text-white/70">{b.stok ?? 0}</span>
                      </div>
                    </div>
                  </Card>
                </Link>
              </Reveal>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
