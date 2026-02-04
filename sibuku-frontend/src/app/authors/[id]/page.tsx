"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Image from "next/image";

import Card from "@/components/ui/card";
import Button from "@/components/ui/button";
import Reveal from "@/components/ui/reveal";

type Author = {
  id_penulis: number;
  nama_penulis: string;
  biografi?: string | null;
  foto_penulis?: string | null;
};

async function fetchAuthor(id: string): Promise<Author> {
  const res = await fetch(`/api/authors/${id}`, { cache: "no-store" });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.detail || "Gagal memuat detail penulis");
  return data as Author;
}

export default function AuthorDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id);

  const { data: author, isLoading, isError, error } = useQuery({
    queryKey: ["author", id],
    queryFn: () => fetchAuthor(id),
  });

  return (
    <div className="container py-10 max-w-3xl">
      <Reveal>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black">Profil Penulis</h1>
            <p className="text-white/60 mt-1">Detail informasi penulis.</p>
          </div>
          <Button variant="secondary" onClick={() => router.push("/authors")}>
            ← Kembali
          </Button>
        </div>
      </Reveal>

      {isLoading ? (
        <div className="mt-6 grid gap-3">
          <Card className="animate-pulse">
            <div className="h-20 bg-white/5 rounded-xl" />
          </Card>
        </div>
      ) : isError ? (
        <div className="mt-6">
          <Card className="border border-rose-500/30 bg-rose-500/5">
            <div className="font-semibold text-rose-200">Gagal memuat</div>
            <div className="text-sm text-white/60 mt-1">{(error as Error)?.message}</div>
          </Card>
        </div>
      ) : !author ? null : (
        <div className="mt-6 grid gap-4">
          <Reveal delay={0.03}>
            <Card>
              <div className="flex flex-col sm:flex-row gap-4 items-start">
                <div className="relative h-24 w-24 rounded-2xl overflow-hidden bg-white/5 border border-white/10">
                  <Image
                    src={author.foto_penulis || "/illustrations/hero-books.svg"}
                    alt={author.nama_penulis}
                    fill
                    sizes="96px"
                    className="object-cover"
                  />
                </div>

                <div className="min-w-0">
                  <div className="text-2xl font-extrabold">{author.nama_penulis}</div>
                  <div className="text-sm text-white/60 mt-2 leading-relaxed">
                    {author.biografi || "Belum ada biografi penulis."}
                  </div>
                </div>
              </div>
            </Card>
          </Reveal>

          <Reveal delay={0.05}>
            <Card>
              <div className="font-semibold">Rekomendasi</div>
              <div className="text-sm text-white/60 mt-2">
                (Opsional next step) kita bisa tampilkan daftar buku dari penulis ini kalau nanti menyediakan filter `books?author_id=...`.
              </div>
            </Card>
          </Reveal>
        </div>
      )}
    </div>
  );
}
