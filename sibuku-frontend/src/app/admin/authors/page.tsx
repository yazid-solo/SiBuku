/* eslint-disable @next/next/no-img-element */
"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import Card from "@/components/ui/card";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import Reveal from "@/components/ui/reveal";
import type { Penulis } from "@/lib/types";

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

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const a = (parts[0]?.[0] || "?").toUpperCase();
  const b = (parts[1]?.[0] || "").toUpperCase();
  return (a + b).slice(0, 2);
}

function AuthorAvatar({ name, src }: { name: string; src?: string | null }) {
  const [broken, setBroken] = useState(false);
  const showImg = !!src && !broken;

  return (
    <div className="relative h-14 w-14 rounded-2xl overflow-hidden bg-white/5 ring-1 ring-white/10 flex items-center justify-center">
      {showImg ? (
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

async function fetchAuthors(page: number, limit: number, q: string) {
  const qs = new URLSearchParams();
  qs.set("page", String(page));
  qs.set("limit", String(limit));
  if (q.trim()) qs.set("q", q.trim());

  const res = await fetch(`/api/admin/authors/paged?${qs.toString()}`, { cache: "no-store" });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.detail || "Gagal memuat penulis");
  return normalizePaged<Penulis>(data);
}

async function createAuthor(payload: { nama_penulis: string; biografi?: string }) {
  const res = await fetch("/api/admin/authors", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.detail || "Gagal menambah penulis");
  return data;
}

async function uploadPhoto(authorId: number, file: File) {
  const fd = new FormData();
  fd.append("file", file);

  const res = await fetch(`/api/admin/authors/${authorId}/photo`, { method: "POST", body: fd });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.detail || "Gagal upload foto");
  return data;
}

async function deletePhoto(authorId: number) {
  const res = await fetch(`/api/admin/authors/${authorId}/photo`, { method: "DELETE" });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.detail || "Gagal hapus foto");
  return data;
}

// ✅ NEW: delete author
async function deleteAuthor(authorId: number) {
  const res = await fetch(`/api/admin/authors/${authorId}`, { method: "DELETE" });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.detail || "Gagal hapus penulis");
  return data;
}

export default function AdminAuthorsPage() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [q, setQ] = useState("");

  const [nama, setNama] = useState("");
  const [bio, setBio] = useState("");

  const [uploadTarget, setUploadTarget] = useState<number | null>(null);

  const queryKey = useMemo(() => ["admin-authors", page, limit, q] as const, [page, limit, q]);

  const { data, isLoading, isError, error, isFetching } = useQuery({
    queryKey,
    queryFn: () => fetchAuthors(page, limit, q),
    staleTime: 10_000,
  });

  const authors = data?.data ?? [];
  const meta = data?.meta;

  const headerInfo = useMemo(() => {
    if (!meta) return "";
    return `Page ${meta.page}/${meta.total_pages} • Total ${meta.total}`;
  }, [meta]);

  const createMut = useMutation({
    mutationFn: () => createAuthor({ nama_penulis: nama, biografi: bio || undefined }),
    onSuccess: async () => {
      setNama("");
      setBio("");
      await qc.invalidateQueries({ queryKey: ["admin-authors"], exact: false });
      await qc.refetchQueries({ queryKey: ["admin-authors"], exact: false });
      alert("Penulis berhasil ditambahkan ✅");
    },
    onError: (e: any) => alert(e.message),
  });

  const uploadMut = useMutation({
    mutationFn: ({ authorId, file }: { authorId: number; file: File }) => uploadPhoto(authorId, file),
    onSuccess: async () => {
      setUploadTarget(null);
      if (fileRef.current) fileRef.current.value = "";
      await qc.invalidateQueries({ queryKey: ["admin-authors"], exact: false });
      await qc.refetchQueries({ queryKey: ["admin-authors"], exact: false });
      alert("Foto penulis berhasil diupload ✅");
    },
    onError: (e: any) => alert(e.message),
  });

  const deletePhotoMut = useMutation({
    mutationFn: (authorId: number) => deletePhoto(authorId),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin-authors"], exact: false });
      await qc.refetchQueries({ queryKey: ["admin-authors"], exact: false });
      alert("Foto penulis berhasil dihapus ✅");
    },
    onError: (e: any) => alert(e.message),
  });

  // ✅ NEW: delete author mutation
  const deleteAuthorMut = useMutation({
    mutationFn: (authorId: number) => deleteAuthor(authorId),
    onSuccess: async (_data, authorId) => {
      // kalau ini item terakhir di halaman & page>1, mundurin page biar tidak kosong
      if (authors.length === 1 && page > 1) setPage(page - 1);

      await qc.invalidateQueries({ queryKey: ["admin-authors"], exact: false });
      await qc.refetchQueries({ queryKey: ["admin-authors"], exact: false });

      // kalau yang dihapus adalah target upload, reset
      if (uploadTarget === authorId) {
        setUploadTarget(null);
        if (fileRef.current) fileRef.current.value = "";
      }

      alert("Penulis berhasil dihapus ✅");
    },
    onError: (e: any) => alert(e.message),
  });

  function handleReset() {
    setPage(1);
    setQ("");
    setUploadTarget(null);
    if (fileRef.current) fileRef.current.value = "";

    qc.invalidateQueries({ queryKey: ["admin-authors"], exact: false });
    qc.refetchQueries({ queryKey: ["admin-authors"], exact: false });
  }

  return (
    <div>
      <Reveal>
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black">Admin • Authors</h1>
            <p className="text-white/60 mt-1">Kelola penulis + foto penulis .</p>
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
          placeholder="Cari nama penulis..."
        />
        <Button variant="secondary" onClick={handleReset} className="w-full">
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
              <div className="font-semibold text-rose-200">Gagal memuat penulis</div>
              <div className="text-sm text-white/60 mt-1">{(error as Error)?.message}</div>
            </Card>
          ) : authors.length === 0 ? (
            <Card>
              <div className="font-semibold">Belum ada penulis</div>
              <div className="text-sm text-white/60 mt-1">Tambah penulis dari panel kanan.</div>
            </Card>
          ) : (
            authors.map((a) => (
              <Card key={a.id_penulis} className="flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                  <AuthorAvatar name={a.nama_penulis} src={a.foto_penulis ?? null} />
                  <div className="min-w-0">
                    <div className="font-semibold">{a.nama_penulis}</div>
                    <div className="text-xs text-white/60 line-clamp-2">{a.biografi || "—"}</div>
                    <div className="text-[11px] text-white/40 mt-1">ID: {a.id_penulis}</div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setUploadTarget(a.id_penulis);
                      if (fileRef.current) fileRef.current.value = "";
                      fileRef.current?.click();
                    }}
                    disabled={uploadMut.isPending}
                  >
                    {uploadMut.isPending && uploadTarget === a.id_penulis ? "Uploading..." : "Upload Foto"}
                  </Button>

                  <Button
                    variant="ghost"
                    onClick={() => deletePhotoMut.mutate(a.id_penulis)}
                    disabled={!a.foto_penulis || deletePhotoMut.isPending}
                    title={!a.foto_penulis ? "Belum ada foto" : "Hapus foto"}
                  >
                    {deletePhotoMut.isPending ? "Menghapus..." : "Hapus Foto"}
                  </Button>

                  {/* ✅ NEW: Hapus Penulis */}
                  <Button
                    variant="ghost"
                    className="text-rose-200 hover:text-rose-100 hover:bg-rose-500/10"
                    disabled={deleteAuthorMut.isPending}
                    onClick={() => {
                      const ok = confirm(`Hapus penulis "${a.nama_penulis}"?\nTindakan ini tidak bisa dibatalkan.`);
                      if (!ok) return;
                      deleteAuthorMut.mutate(a.id_penulis);
                    }}
                    title="Hapus penulis dari database"
                  >
                    {deleteAuthorMut.isPending ? "Menghapus..." : "Hapus Penulis"}
                  </Button>
                </div>
              </Card>
            ))
          )}

          {/* pagination */}
          {!!meta && meta.total_pages > 1 && (
            <div className="flex items-center justify-between mt-2">
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
        </div>

        {/* create */}
        <div className="lg:sticky lg:top-24 h-fit">
          <Card>
            <div className="font-semibold">Tambah Penulis</div>
            <p className="text-sm text-white/60 mt-1">
              Silahkan diisi: <code className="text-white/80">admin/authors</code>
            </p>

            <div className="mt-4 grid gap-3">
              <Input value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Nama penulis" />
              <Input value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Biografi (opsional)" />

              <Button
                className="w-full"
                disabled={createMut.isPending || nama.trim().length < 2}
                onClick={() => createMut.mutate()}
              >
                {createMut.isPending ? "Menyimpan..." : "Simpan"}
              </Button>

              <div className="text-xs text-white/50">Setelah penulis dibuat, kamu bisa upload foto dari list.</div>
            </div>
          </Card>
        </div>
      </div>

      {/* hidden file input */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file || !uploadTarget) return;
          uploadMut.mutate({ authorId: uploadTarget, file });
        }}
      />
    </div>
  );
}
