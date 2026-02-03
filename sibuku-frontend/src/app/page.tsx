/* eslint-disable @typescript-eslint/no-explicit-any */
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import Reveal from "@/components/ui/reveal";
import Button from "@/components/ui/button";
import Card from "@/components/ui/card";
import Badge from "@/components/ui/badge";

import { backendFetch } from "@/lib/server/backend";
import type { Book, Genre, BooksPaged } from "@/lib/types";
import { formatRupiah } from "@/lib/utils";

export const dynamic = "force-dynamic";

/* ---------------- safe normalizers (biar tidak tiba-tiba kosong) ---------------- */

function normalizeArrayAny(x: any): any[] {
  if (Array.isArray(x)) return x;
  if (x && Array.isArray(x.data)) return x.data;
  if (x?.data?.data && Array.isArray(x.data.data)) return x.data.data;
  if (x?.results && Array.isArray(x.results)) return x.results;
  if (x?.items && Array.isArray(x.items)) return x.items;
  return [];
}

function isRemoteUrl(src?: string | null) {
  const s = String(src ?? "").trim();
  return s.startsWith("http://") || s.startsWith("https://");
}

function isSvg(path?: string | null) {
  return String(path ?? "").toLowerCase().endsWith(".svg");
}

/* ---------------- API fetchers ---------------- */

async function getFeatured(): Promise<Book[]> {
  try {
    const data = await backendFetch<BooksPaged | any>(
      "/books/paged?page=1&limit=8&sort_by=created_at&order=desc"
    );

    // support: BooksPaged { data: Book[] } / { data: { data: Book[] } } / { results: [] } dll
    const arr = normalizeArrayAny(data?.data ?? data);
    return arr as Book[];
  } catch {
    return [];
  }
}

async function getGenres(): Promise<Genre[]> {
  try {
    const raw = await backendFetch<any>("/genres");
    const arr = normalizeArrayAny(raw);
    return arr as Genre[];
  } catch {
    return [];
  }
}

/* ---------------- static data (boleh tetap manual) ---------------- */

const team = [
  { name: "Dimas Husain Rabani", role: "Product & UI/UX", avatar: "/avatars/dev1.svg" },
  { name: "Berlian Fatma Riyani", role: "Backend Engineer", avatar: "/avatars/dev2.svg" },
  { name: "Ibnu Abbas", role: "Frontend Engineer & Project Manager", avatar: "/avatars/dev3.svg" },
  { name: "Muchamad Yazid Ardani", role: "Database", avatar: "/avatars/dev4.svg" },
  { name: "Wafa", role: "UI/UX Designer", avatar: "/avatars/dev5.svg" },
];

function SectionDivider() {
  return (
    <div className="container">
      <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    </div>
  );
}

function SectionHeader(props: {
  eyebrow?: string;
  title: string;
  desc?: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        {props.eyebrow ? (
          <div className="text-xs uppercase tracking-widest text-white/50">{props.eyebrow}</div>
        ) : null}
        <h2 className="text-2xl md:text-3xl font-extrabold mt-1">{props.title}</h2>
        {props.desc ? <p className="text-white/60 mt-2 max-w-2xl">{props.desc}</p> : null}
      </div>
      {props.right ? <div className="hidden sm:block">{props.right}</div> : null}
    </div>
  );
}

function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
      {children}
    </span>
  );
}

export default async function HomePage() {
  const [featured, genres] = await Promise.all([getFeatured(), getGenres()]);

  const stats = [
    { k: "Genre", v: String(genres?.length ?? 0) },
    { k: "Buku Terbaru", v: String(featured?.length ?? 0) },
    { k: "Checkout", v: "RPC Atomic" },
  ];

  return (
    <div className="relative">
      {/* Ambient background */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-220px] h-[560px] w-[560px] -translate-x-1/2 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="absolute right-[-160px] top-[240px] h-[560px] w-[560px] rounded-full bg-sky-400/10 blur-3xl" />
        <div className="absolute left-[-160px] top-[980px] h-[560px] w-[560px] rounded-full bg-fuchsia-500/10 blur-3xl" />
      </div>

      {/* HERO */}
      <section className="container pt-12 md:pt-16 pb-10">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-12 items-center">
          <Reveal>
            <div className="flex flex-wrap items-center gap-2">
              <Badge>Platform E-Commerce Buku Modern</Badge>
              <Pill>FastAPI + Supabase</Pill>
              <Pill>Next.js</Pill>
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black mt-5 leading-[1.05] tracking-tight">
              Temukan buku terbaik,
              <br />
              checkout cepat, pengalaman belanja
              <br />
              nyaman di <span className="text-indigo-400">SiBuku</span>.
            </h1>

            <p className="text-white/70 mt-5 max-w-xl leading-relaxed">
              Katalog rapi, filter cepat, keranjang & checkout otomatis, plus riwayat pesanan yang jelas—semua dibuat
              untuk pengalaman belanja yang nyaman.
            </p>

            <div className="flex flex-wrap gap-3 mt-7">
              <Link href="/books">
                <Button className="min-w-[150px]">Mulai Belanja</Button>
              </Link>
              <Link href="/register">
                <Button variant="secondary" className="min-w-[150px]">
                  Buat Akun
                </Button>
              </Link>
            </div>

            {/* mini stats */}
            <div className="mt-8 grid grid-cols-3 gap-3 max-w-lg">
              {stats.map((s) => (
                <div key={s.k} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur">
                  <div className="text-lg md:text-xl font-extrabold text-white">{s.v}</div>
                  <div className="text-xs text-white/50 mt-0.5">{s.k}</div>
                </div>
              ))}
            </div>

            <div className="mt-6 text-xs text-white/50">
              Checkout aman: stok terkunci & transaksi atomic via{" "}
              <span className="text-white/70">create_order_atomic</span>.
            </div>
          </Reveal>

          <Reveal delay={0.08}>
            <div className="glass rounded-3xl p-6 md:p-7 relative overflow-hidden">
              <div className="absolute -top-24 -right-24 w-56 h-56 bg-indigo-500/30 blur-3xl rounded-full" />
              <div className="absolute -bottom-24 -left-24 w-56 h-56 bg-sky-400/20 blur-3xl rounded-full" />

              <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-white/5">
                <Image
                  src="/illustrations/hero-books.svg"
                  alt="Ilustrasi SiBuku"
                  width={1100}
                  height={800}
                  className="w-full h-auto"
                  priority
                />
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <div className="text-sm font-semibold">Katalog</div>
                  <div className="text-xs text-white/60 mt-1">Search & filter super cepat.</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <div className="text-sm font-semibold">Checkout</div>
                  <div className="text-xs text-white/60 mt-1">Alamat + pembayaran, selesai.</div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <SectionDivider />

      {/* GENRES */}
      <section className="container py-10 md:py-12">
        <Reveal>
          <SectionHeader
            eyebrow="Explore"
            title="Kategori Populer"
            desc="Filter cepat berdasarkan genre untuk menemukan buku yang kamu suka."
            right={
              <Link href="/books" className="text-sm text-indigo-300 hover:text-indigo-200">
                Buka katalog →
              </Link>
            }
          />
        </Reveal>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-7">
          {(genres || []).slice(0, 8).map((g, idx) => (
            <Reveal key={String(g.id_genre)} delay={0.02 * idx}>
              {/* ✅ aman untuk berbagai implementasi filter: kirim genre_id & genre */}
              <Link href={`/books?genre_id=${g.id_genre}&genre=${encodeURIComponent(g.nama_genre)}`}>
                <Card className="group relative overflow-hidden hover:bg-white/10 transition">
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition bg-gradient-to-br from-indigo-500/12 via-sky-400/8 to-transparent" />
                  <div className="relative">
                    <div className="flex items-start justify-between gap-3">
                      <div className="font-semibold leading-snug">{g.nama_genre}</div>
                      <span className="text-[10px] rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-white/60">
                        #{String(g.id_genre).padStart(2, "0")}
                      </span>
                    </div>
                    <div className="text-xs text-white/60 mt-2 line-clamp-2">
                      {g.deskripsi_genre || "Jelajahi buku terbaik di kategori ini."}
                    </div>

                    <div className="mt-4 text-xs text-indigo-200/90 opacity-0 group-hover:opacity-100 transition">
                      Lihat buku →
                    </div>
                  </div>
                </Card>
              </Link>
            </Reveal>
          ))}
        </div>

        {!genres?.length && (
          <div className="text-sm text-white/50 mt-7">Kategori belum tersedia (cek backend / seed genre).</div>
        )}
      </section>

      <SectionDivider />

      {/* FEATURED BOOKS */}
      <section className="container py-10 md:py-12">
        <Reveal>
          <SectionHeader
            eyebrow="New Arrival"
            title="Buku Terbaru"
            desc="Update katalog yang siap kamu baca. Klik kartu untuk detail."
            right={
              <Link href="/books" className="text-sm text-indigo-300 hover:text-indigo-200">
                Lihat semua →
              </Link>
            }
          />
        </Reveal>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-7">
          {(featured || []).map((b, idx) => {
            const cover = b.cover_image || "/illustrations/hero-books.svg";
            const unoptimized = isRemoteUrl(cover) || isSvg(cover);

            return (
              <Reveal key={String(b.id_buku)} delay={0.02 * idx}>
                <Link href={`/books/${b.id_buku}`}>
                  <Card className="group hover:bg-white/10 transition">
                    <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-white/5 border border-white/10">
                      <Image
                        src={cover}
                        alt={b.judul}
                        fill
                        unoptimized={unoptimized}
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                        className="object-cover transition duration-300 group-hover:scale-[1.04]"
                      />
                      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition bg-gradient-to-t from-black/55 via-transparent to-transparent" />
                      <div className="absolute left-3 bottom-3 right-3 flex items-center justify-between gap-2 opacity-0 group-hover:opacity-100 transition">
                        <span className="text-[11px] rounded-full bg-white/10 border border-white/15 px-2 py-1 text-white/80">
                          Detail →
                        </span>
                        <span className="text-[11px] rounded-full bg-indigo-500/20 border border-indigo-400/20 px-2 py-1 text-indigo-200">
                          ID {b.id_buku}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 font-semibold line-clamp-2 leading-snug">{b.judul}</div>
                    <div className="text-xs text-white/60 mt-1">{b.penulis?.nama_penulis || "—"}</div>

                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div className="font-bold text-indigo-200">{formatRupiah(Number(b.harga || 0))}</div>
                      <div className="text-[11px] text-white/50">
                        Stok: <span className="text-white/75 font-semibold">{b.stok ?? 0}</span>
                      </div>
                    </div>
                  </Card>
                </Link>
              </Reveal>
            );
          })}
        </div>

        {!featured?.length && (
          <div className="text-sm text-white/50 mt-7">Buku belum tersedia (cek backend / seed buku).</div>
        )}
      </section>

      <SectionDivider />

      {/* HOW IT WORKS */}
      <section className="container py-10 md:py-12">
        <Reveal>
          <SectionHeader eyebrow="Flow" title="Belanja 3 Langkah" desc="Alur sederhana seperti e-commerce modern: browse, cart, checkout." />
        </Reveal>

        <div className="grid md:grid-cols-3 gap-4 mt-7">
          {[
            { n: "01", t: "Jelajahi Katalog", d: "Cari judul buku & filter berdasarkan genre dengan cepat." },
            { n: "02", t: "Masukkan ke Keranjang", d: "Tambah / kurangi jumlah item, subtotal dihitung otomatis." },
            { n: "03", t: "Checkout", d: "Isi alamat, pilih pembayaran, order dibuat via RPC atomic." },
          ].map((x, i) => (
            <Reveal key={x.n} delay={i * 0.05}>
              <Card className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-white/6 to-transparent" />
                <div className="relative">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-white/45 tracking-widest">STEP</div>
                    <div className="text-sm font-black text-white/70">{x.n}</div>
                  </div>
                  <div className="mt-3 font-semibold">{x.t}</div>
                  <div className="text-sm text-white/60 mt-2 leading-relaxed">{x.d}</div>

                  <div className="mt-5">
                    {i === 0 && (
                      <Link href="/books" className="text-sm text-indigo-300 hover:text-indigo-200">
                        Buka Katalog →
                      </Link>
                    )}
                    {i === 1 && (
                      <Link href="/cart" className="text-sm text-indigo-300 hover:text-indigo-200">
                        Lihat Keranjang →
                      </Link>
                    )}
                    {i === 2 && (
                      <Link href="/checkout" className="text-sm text-indigo-300 hover:text-indigo-200">
                        Checkout →
                      </Link>
                    )}
                  </div>
                </div>
              </Card>
            </Reveal>
          ))}
        </div>
      </section>

      <SectionDivider />

      {/* BENEFITS */}
      <section className="container py-10 md:py-12">
        <Reveal>
          <SectionHeader eyebrow="Why" title="Kenapa SiBuku?" desc="Bukan cuma tampilan — alur data dan transaksi juga dirapikan agar profesional." />
        </Reveal>

        <div className="grid md:grid-cols-3 gap-4 mt-7">
          {[
            {
              t: "Checkout Otomatis & Aman",
              d: "Transaksi atomic via RPC Supabase: cek stok, insert order, insert item, update stok—sekali jalan.",
            },
            { t: "UI Clean & Responsif", d: "Transisi halus, layout rapi, nyaman dipakai mobile sampai desktop." },
            { t: "Riwayat Pesanan Jelas", d: "Status order & pembayaran ditarik langsung dari relasi database agar konsisten." },
          ].map((x, i) => (
            <Reveal key={x.t} delay={i * 0.05}>
              <Card className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-white/6 to-transparent" />
                <div className="relative">
                  <div className="font-semibold">{x.t}</div>
                  <div className="text-sm text-white/60 mt-2 leading-relaxed">{x.d}</div>
                </div>
              </Card>
            </Reveal>
          ))}
        </div>
      </section>

      <SectionDivider />

      {/* TEAM */}
      <section className="container py-10 md:py-12">
        <Reveal>
          <SectionHeader eyebrow="People" title="Tim Pengembangan" desc="5 orang yang membangun SiBuku." />
        </Reveal>

        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 mt-7">
          {team.map((m, i) => (
            <Reveal key={m.name} delay={i * 0.04}>
              <Card className="group text-center relative overflow-hidden hover:bg-white/10 transition">
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition duration-300 bg-gradient-to-br from-indigo-500/12 via-sky-400/8 to-transparent" />

                <div className="relative">
                  <div className="mx-auto relative h-24 w-24 overflow-hidden rounded-2xl ring-1 ring-white/10 bg-white/5">
                    <Image src={m.avatar} alt={m.name} fill sizes="96px" className="object-cover" />
                  </div>
                  <div className="font-semibold mt-4 leading-snug">{m.name}</div>
                  <div className="text-xs text-white/60 mt-1">{m.role}</div>
                </div>
              </Card>
            </Reveal>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="container pb-14">
        <Reveal>
          <div className="glass rounded-3xl p-6 md:p-8 relative overflow-hidden">
            <div className="absolute -top-24 -right-24 w-56 h-56 bg-indigo-500/25 blur-3xl rounded-full" />
            <div className="absolute -bottom-24 -left-24 w-56 h-56 bg-sky-400/15 blur-3xl rounded-full" />

            <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div>
                <div className="text-xs uppercase tracking-widest text-white/50">Ready to start</div>
                <div className="text-2xl md:text-3xl font-extrabold mt-1">
                  Mulai belanja buku dengan pengalaman modern.
                </div>
                <div className="text-white/60 mt-2">
                  Daftar untuk checkout lebih cepat dan pantau status pesanan.
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link href="/register">
                  <Button className="min-w-[160px]">Buat Akun</Button>
                </Link>
                <Link href="/books">
                  <Button variant="secondary" className="min-w-[160px]">
                    Jelajahi Katalog
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
