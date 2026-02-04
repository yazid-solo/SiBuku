/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @next/next/no-img-element */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import Card from "@/components/ui/card";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import Reveal from "@/components/ui/reveal";
import Select, { type SelectOption } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";

import type { Book, Genre, Penulis } from "@/lib/types";
import { formatRupiah } from "@/lib/utils";

/** ---------- helpers ---------- */
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

function safeArray<T>(x: any): T[] {
  if (Array.isArray(x)) return x;
  if (x && Array.isArray(x.data)) return x.data;
  if (x?.data?.data && Array.isArray(x.data.data)) return x.data.data;
  return [];
}

function bookStatusLabel(s?: string | null) {
  const v = (s ?? "").toLowerCase();
  if (!v) return "—";
  if (v.includes("non")) return "Nonaktif";
  if (v.includes("aktif")) return "Aktif";
  return s ?? "—";
}

function statusPillClass(s?: string | null) {
  const v = (s ?? "").toLowerCase();
  if (v.includes("aktif") && !v.includes("non")) return "bg-emerald-500/15 text-emerald-200 ring-emerald-500/30";
  if (v.includes("non")) return "bg-amber-500/15 text-amber-200 ring-amber-500/30";
  return "bg-white/10 text-white/70 ring-white/15";
}

function CoverThumb({ title, src }: { title: string; src?: string | null }) {
  const [broken, setBroken] = useState(false);
  const show = !!src && !broken;

  return (
    <div className="relative h-14 w-14 rounded-2xl overflow-hidden bg-white/5 ring-1 ring-white/10 flex items-center justify-center">
      {show ? (
        <img
          src={src!}
          alt={title}
          className="h-full w-full object-cover"
          onError={() => setBroken(true)}
        />
      ) : (
        <div className="text-[11px] font-bold text-white/60 px-2 text-center line-clamp-2">
          {(title || "BK").slice(0, 2).toUpperCase()}
        </div>
      )}
    </div>
  );
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="grid gap-1">
      <div className="text-xs text-white/60">{label}</div>
      {children}
      {hint ? <div className="text-[11px] text-white/40">{hint}</div> : null}
    </div>
  );
}

function onlyDigits(s: string) {
  return s.replace(/[^\d]/g, "");
}

function toNumberOr0(s: string) {
  const n = Number(s || 0);
  return Number.isFinite(n) ? n : 0;
}

/** ---------- API (via Next /api/*) ---------- */
async function fetchAdminBooks(page: number, limit: number, q: string) {
  const qs = new URLSearchParams();
  qs.set("page", String(page));
  qs.set("limit", String(limit));
  if (q.trim()) qs.set("q", q.trim());

  const res = await fetch(`/api/admin/books/paged?${qs.toString()}`, { cache: "no-store" });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.detail || "Gagal memuat buku");
  return normalizePaged<Book>(data);
}

async function fetchGenres(): Promise<Genre[]> {
  const res = await fetch(`/api/genres`, { cache: "no-store" });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.detail || "Gagal memuat genre");
  return safeArray<Genre>(data);
}

async function fetchAuthors(): Promise<Penulis[]> {
  const res = await fetch(`/api/authors`, { cache: "no-store" });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.detail || "Gagal memuat penulis");
  return safeArray<Penulis>(data);
}

async function createBook(payload: any) {
  const res = await fetch("/api/admin/books", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.detail || "Gagal membuat buku");
  return data;
}

async function updateBook(bookId: number, payload: any) {
  const res = await fetch(`/api/admin/books/${bookId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.detail || "Gagal update buku");
  return data;
}

async function deleteBook(bookId: number) {
  const res = await fetch(`/api/admin/books/${bookId}`, { method: "DELETE" });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.detail || "Gagal hapus buku");
  return data;
}

async function toggleBook(bookId: number) {
  const res = await fetch(`/api/admin/books/${bookId}/toggle`, { method: "PATCH" });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.detail || "Gagal toggle buku");
  return data;
}

async function restoreBook(bookId: number) {
  const res = await fetch(`/api/admin/books/${bookId}/restore`, { method: "PATCH" });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.detail || "Gagal restore buku");
  return data;
}

async function uploadCover(bookId: number, file: File) {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`/api/admin/books/${bookId}/cover`, { method: "POST", body: fd });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.detail || "Gagal upload cover");
  return data;
}

async function deleteCover(bookId: number) {
  const res = await fetch(`/api/admin/books/${bookId}/cover`, { method: "DELETE" });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.detail || "Gagal hapus cover");
  return data;
}

/** ---------- Page ---------- */
export default function AdminBooksPage() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const coverRef = useRef<HTMLInputElement | null>(null);
  const [coverTarget, setCoverTarget] = useState<number | null>(null);

  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [q, setQ] = useState("");

  // form state
  const [editing, setEditing] = useState<Book | null>(null);

  const [judul, setJudul] = useState("");
  const [harga, setHarga] = useState<string>(""); // string supaya UX input bagus
  const [stok, setStok] = useState<string>("");
  const [berat, setBerat] = useState<string>("");
  const [isbn, setIsbn] = useState("");
  const [idGenre, setIdGenre] = useState<string>("");
  const [idPenulis, setIdPenulis] = useState<string>("");
  const [deskripsi, setDeskripsi] = useState("");

  const booksKey = useMemo(() => ["admin-books", page, limit, q] as const, [page, limit, q]);

  const { data, isLoading, isError, error, isFetching } = useQuery({
    queryKey: booksKey,
    queryFn: () => fetchAdminBooks(page, limit, q),
    staleTime: 10_000,
  });

  const { data: genres = [], isLoading: loadingGenres } = useQuery({
    queryKey: ["genres"],
    queryFn: fetchGenres,
    staleTime: 60_000,
  });

  const { data: authors = [], isLoading: loadingAuthors } = useQuery({
    queryKey: ["authors"],
    queryFn: fetchAuthors,
    staleTime: 60_000,
  });

  const books = data?.data ?? [];
  const meta = data?.meta;

  const genreOptions: SelectOption[] = useMemo(() => {
    const base: SelectOption[] = [{ value: "", label: "Pilih Genre", subLabel: "Wajib dipilih" }];
    const mapped = (Array.isArray(genres) ? genres : []).map((g) => ({
      value: String(g.id_genre),
      label: g.nama_genre,
      subLabel: g.deskripsi_genre ?? undefined,
    }));
    return base.concat(mapped);
  }, [genres]);

  const authorOptions: SelectOption[] = useMemo(() => {
    const base: SelectOption[] = [{ value: "", label: "Pilih Penulis", subLabel: "Wajib dipilih" }];
    const mapped = (Array.isArray(authors) ? authors : []).map((a) => ({
      value: String(a.id_penulis),
      label: a.nama_penulis,
      subLabel: a.biografi ?? undefined,
    }));
    return base.concat(mapped);
  }, [authors]);

  // sync form when choose edit
  useEffect(() => {
    if (!editing) return;
    setJudul(editing.judul ?? "");
    setHarga(editing.harga != null ? String(editing.harga) : "");
    setStok(editing.stok != null ? String(editing.stok) : "");
    setBerat(editing.berat != null ? String(editing.berat) : "");
    setIsbn(editing.isbn ?? "");
    setIdGenre(editing.id_genre != null ? String(editing.id_genre) : "");
    setIdPenulis(editing.id_penulis != null ? String(editing.id_penulis) : "");
    setDeskripsi(editing.deskripsi ?? "");
  }, [editing]);

  function resetForm() {
    setEditing(null);
    setJudul("");
    setHarga("");
    setStok("");
    setBerat("");
    setIsbn("");
    setIdGenre("");
    setIdPenulis("");
    setDeskripsi("");
  }

  async function refetchBooks() {
    await qc.invalidateQueries({ queryKey: ["admin-books"] });
    await qc.refetchQueries({ queryKey: ["admin-books"] });
  }

  function buildPayload() {
    const hargaNum = toNumberOr0(harga);
    const stokNum = toNumberOr0(stok);
    const beratNum = berat === "" ? null : toNumberOr0(berat);

    return {
      judul: judul.trim(),
      harga: hargaNum,
      stok: stokNum,
      berat: beratNum,
      isbn: isbn.trim() || null,
      id_genre: idGenre ? Number(idGenre) : null,
      id_penulis: idPenulis ? Number(idPenulis) : null,
      deskripsi: deskripsi.trim() || null,
    };
  }

  const createMut = useMutation({
    mutationFn: () => createBook(buildPayload()),
    onSuccess: async () => {
      resetForm();
      await refetchBooks();
      toast({ variant: "success", title: "Berhasil", message: "Buku berhasil dibuat." });
    },
    onError: (e: any) => toast({ variant: "error", title: "Gagal", message: e?.message || "Gagal membuat buku" }),
  });

  const updateMut = useMutation({
    mutationFn: () => updateBook(editing!.id_buku, buildPayload()),
    onSuccess: async () => {
      resetForm();
      await refetchBooks();
      toast({ variant: "success", title: "Berhasil", message: "Buku berhasil diupdate." });
    },
    onError: (e: any) => toast({ variant: "error", title: "Gagal", message: e?.message || "Gagal update buku" }),
  });

  const delMut = useMutation({
    mutationFn: (bookId: number) => deleteBook(bookId),
    onSuccess: async () => {
      if (editing) resetForm();
      await refetchBooks();
      toast({ variant: "success", title: "Berhasil", message: "Buku berhasil dihapus." });
    },
    onError: (e: any) => toast({ variant: "error", title: "Gagal", message: e?.message || "Gagal hapus buku" }),
  });

  const toggleMut = useMutation({
    mutationFn: (bookId: number) => toggleBook(bookId),
    onSuccess: async () => {
      await refetchBooks();
      toast({ variant: "success", title: "Berhasil", message: "Status buku berhasil diubah." });
    },
    onError: (e: any) => toast({ variant: "error", title: "Gagal", message: e?.message || "Gagal toggle buku" }),
  });

  const restoreMut = useMutation({
    mutationFn: (bookId: number) => restoreBook(bookId),
    onSuccess: async () => {
      await refetchBooks();
      toast({ variant: "success", title: "Berhasil", message: "Buku berhasil direstore." });
    },
    onError: (e: any) => toast({ variant: "error", title: "Gagal", message: e?.message || "Gagal restore buku" }),
  });

  const uploadCoverMut = useMutation({
    mutationFn: ({ bookId, file }: { bookId: number; file: File }) => uploadCover(bookId, file),
    onSuccess: async () => {
      setCoverTarget(null);
      if (coverRef.current) coverRef.current.value = "";
      await refetchBooks();
      toast({ variant: "success", title: "Berhasil", message: "Cover berhasil diupload." });
    },
    onError: (e: any) => toast({ variant: "error", title: "Gagal", message: e?.message || "Gagal upload cover" }),
  });

  const deleteCoverMut = useMutation({
    mutationFn: (bookId: number) => deleteCover(bookId),
    onSuccess: async () => {
      await refetchBooks();
      toast({ variant: "success", title: "Berhasil", message: "Cover berhasil dihapus." });
    },
    onError: (e: any) => toast({ variant: "error", title: "Gagal", message: e?.message || "Gagal hapus cover" }),
  });

  const headerInfo = useMemo(() => {
    if (!meta) return "";
    return `Page ${meta.page}/${meta.total_pages} • Total ${meta.total}`;
  }, [meta]);

  const hargaNum = toNumberOr0(harga);
  const stokNum = toNumberOr0(stok);

  const canSubmit =
    judul.trim().length >= 2 &&
    Number.isFinite(hargaNum) &&
    hargaNum >= 0 &&
    Number.isFinite(stokNum) &&
    stokNum >= 0 &&
    !!idGenre &&
    !!idPenulis &&
    !loadingGenres &&
    !loadingAuthors;

  return (
    <div>
      <Reveal>
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black">Admin • Books</h1>
            <p className="text-white/60 mt-1">Buku + cover sesuai dengan kamu.</p>
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
          placeholder="Cari judul / ISBN..."
        />
        <Button
          variant="secondary"
          onClick={() => {
            setPage(1);
            setQ("");
          }}
          className="w-full"
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
                <div className="h-4 bg-white/5 rounded w-64" />
                <div className="h-3 bg-white/5 rounded w-80 mt-3" />
              </Card>
            ))
          ) : isError ? (
            <Card className="border border-rose-500/30 bg-rose-500/5">
              <div className="font-semibold text-rose-200">Gagal memuat buku</div>
              <div className="text-sm text-white/60 mt-1">{(error as Error)?.message}</div>
            </Card>
          ) : books.length === 0 ? (
            <Card>
              <div className="font-semibold">Belum ada buku</div>
              <div className="text-sm text-white/60 mt-1">Buat buku dari panel kanan.</div>
            </Card>
          ) : (
            books.map((b) => (
              <Card key={b.id_buku} className="flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
                <div className="flex items-center gap-4 min-w-0">
                  <CoverThumb title={b.judul} src={b.cover_image ?? null} />
                  <div className="min-w-0">
                    <div className="font-semibold line-clamp-1">{b.judul}</div>

                    <div className="text-xs text-white/60 mt-0.5 line-clamp-1">
                      {b.penulis?.nama_penulis || "—"} • {b.genre?.nama_genre || "—"}
                    </div>

                    <div className="text-xs text-white/60 mt-1 flex flex-wrap gap-2 items-center">
                      <span className="text-white/80 font-semibold">{formatRupiah(Number(b.harga || 0))}</span>
                      <span className="text-white/40">•</span>
                      <span>
                        Stok: <span className="text-white/80 font-semibold">{b.stok ?? 0}</span>
                      </span>
                      <span className="text-white/40">•</span>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] ring-1 ${statusPillClass(
                          b.status ?? null
                        )}`}
                      >
                        {bookStatusLabel(b.status ?? null)}
                      </span>
                      <span className="text-white/40">•</span>
                      <span className="text-[11px] text-white/40">ID: {b.id_buku}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setCoverTarget(b.id_buku);
                      if (coverRef.current) coverRef.current.value = "";
                      coverRef.current?.click();
                    }}
                    disabled={uploadCoverMut.isPending}
                  >
                    {uploadCoverMut.isPending && coverTarget === b.id_buku ? "Uploading..." : "Upload Cover"}
                  </Button>

                  <Button
                    variant="ghost"
                    onClick={() => deleteCoverMut.mutate(b.id_buku)}
                    disabled={!b.cover_image || deleteCoverMut.isPending}
                  >
                    {deleteCoverMut.isPending ? "Menghapus..." : "Hapus Cover"}
                  </Button>

                  <Button variant="secondary" onClick={() => setEditing(b)}>
                    Edit
                  </Button>

                  <Button variant="ghost" onClick={() => toggleMut.mutate(b.id_buku)} disabled={toggleMut.isPending}>
                    Toggle
                  </Button>

                  <Button variant="ghost" onClick={() => restoreMut.mutate(b.id_buku)} disabled={restoreMut.isPending}>
                    Restore
                  </Button>

                  <Button
                    variant="ghost"
                    className="text-rose-200"
                    onClick={() => {
                      if (!confirm(`Hapus buku "${b.judul}"?`)) return;
                      delMut.mutate(b.id_buku);
                    }}
                    disabled={delMut.isPending}
                  >
                    {delMut.isPending ? "Menghapus..." : "Delete"}
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

        {/* form */}
        <div className="lg:sticky lg:top-24 h-fit">
          <Card className="relative z-40">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-semibold">{editing ? "Edit Buku" : "Tambah Buku"}</div>
                <p className="text-sm text-white/60 mt-1">
                  Endpoint:{" "}
                  <code className="text-white/80">{editing ? "PUT /admin/books/{id}" : "POST /admin/books"}</code>
                </p>
              </div>

              {editing && (
                <Button variant="secondary" onClick={resetForm}>
                  Batal
                </Button>
              )}
            </div>

            <div className="mt-4 grid gap-3">
              <Field label="Judul Buku">
                <Input value={judul} onChange={(e) => setJudul(e.target.value)} placeholder="Misal: Atomic Habits" />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Harga (Rp)" hint={harga ? `Preview: ${formatRupiah(hargaNum)}` : undefined}>
                  <Input
                    value={harga}
                    onChange={(e) => setHarga(onlyDigits(e.target.value))}
                    inputMode="numeric"
                    placeholder="Contoh: 75000"
                  />
                </Field>

                <Field label="Stok">
                  <Input
                    value={stok}
                    onChange={(e) => setStok(onlyDigits(e.target.value))}
                    inputMode="numeric"
                    placeholder="Contoh: 10"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Berat (gram)" hint="Opsional">
                  <Input
                    value={berat}
                    onChange={(e) => setBerat(onlyDigits(e.target.value))}
                    inputMode="numeric"
                    placeholder="Contoh: 300"
                  />
                </Field>

                <Field label="ISBN" hint="Opsional">
                  <Input value={isbn} onChange={(e) => setIsbn(e.target.value)} placeholder="Contoh: 978..." />
                </Field>
              </div>

              <Field label="Genre">
                <Select
                  value={idGenre}
                  onChange={setIdGenre}
                  options={genreOptions}
                  placeholder={loadingGenres ? "Memuat genre..." : "Pilih genre"}
                  disabled={loadingGenres}
                />
              </Field>

              <Field label="Penulis">
                <Select
                  value={idPenulis}
                  onChange={setIdPenulis}
                  options={authorOptions}
                  placeholder={loadingAuthors ? "Memuat penulis..." : "Pilih penulis"}
                  disabled={loadingAuthors}
                />
              </Field>

              <Field label="Deskripsi" hint="Opsional">
                <textarea
                  value={deskripsi}
                  onChange={(e) => setDeskripsi(e.target.value)}
                  placeholder="Deskripsi singkat buku..."
                  className="w-full min-h-[110px] rounded-xl bg-white/5 border border-white/10 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/40"
                />
              </Field>

              <Button
                className="w-full"
                disabled={(editing ? updateMut.isPending : createMut.isPending) || !canSubmit}
                onClick={() => (editing ? updateMut.mutate() : createMut.mutate())}
              >
                {editing
                  ? updateMut.isPending
                    ? "Menyimpan..."
                    : "Simpan Perubahan"
                  : createMut.isPending
                    ? "Menyimpan..."
                    : "Buat Buku"}
              </Button>

              <div className="text-xs text-white/50">
                * Genre & Penulis wajib dipilih. Setelah buku dibuat, cover bisa diupload dari list kiri.
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* hidden cover input */}
      <input
        ref={coverRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f || !coverTarget) return;
          uploadCoverMut.mutate({ bookId: coverTarget, file: f });
        }}
      />
    </div>
  );
}
