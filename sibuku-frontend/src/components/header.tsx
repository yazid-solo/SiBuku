"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Menu, Search, ShoppingCart, User, LogOut, LayoutDashboard, BookOpen } from "lucide-react";

import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

type HttpErr = Error & { status?: number; data?: any };

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", credentials: "include", ...init });

  // aman kalau body kosong
  const ct = res.headers.get("content-type") ?? "";
  const text = await res.text().catch(() => "");
  const data = ct.includes("application/json")
    ? (() => {
        try {
          return text ? JSON.parse(text) : null;
        } catch {
          return null;
        }
      })()
    : text || null;

  if (!res.ok) {
    const msg =
      (data as any)?.detail ||
      (data as any)?.message ||
      (typeof data === "string" ? data : "") ||
      `Request gagal (${res.status})`;

    const err = new Error(msg) as HttpErr;
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data as T;
}

function normalizeObj<T extends object>(x: any): T | null {
  if (x && typeof x === "object") return x as T;
  if (x?.data && typeof x.data === "object") return x.data as T;
  if (x?.user && typeof x.user === "object") return x.user as T;
  return null;
}

function normalizeArrayAny(x: any): any[] {
  if (Array.isArray(x)) return x;
  if (x && Array.isArray(x.data)) return x.data;
  if (x?.data?.data && Array.isArray(x.data.data)) return x.data.data;
  if (x?.results && Array.isArray(x.results)) return x.results;
  return [];
}

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

function pickIsAdmin(me: any): boolean {
  const u = me ?? {};
  const role = String(u?.role ?? u?.tipe ?? u?.level ?? "").toLowerCase();
  const isAdmin = Boolean(u?.is_admin ?? u?.admin ?? false);
  return isAdmin || role === "admin" || role === "superadmin";
}

export default function Header() {
  const pathname = usePathname();
  const sp = useSearchParams();
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [openMobile, setOpenMobile] = useState(false);
  const [q, setQ] = useState("");

  // close mobile menu when route changes
  useEffect(() => setOpenMobile(false), [pathname]);

  // source dari URL (sesuai BooksPage: search & genre_id)
  const urlSearch = sp.get("search") ?? "";
  const urlGenreId = sp.get("genre_id") ?? "";

  // prefilling search ketika sedang di halaman /books
  useEffect(() => {
    if (pathname.startsWith("/books")) setQ(urlSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlSearch, pathname]);

  // --- ME (auth state) ---
  const {
    data: meRaw,
    isError: meErr,
    error: meError,
  } = useQuery({
    queryKey: ["me"],
    queryFn: () => fetchJson<any>("/api/me"),
    retry: false,
    staleTime: 10_000,
    refetchOnWindowFocus: false,
  });

  const me = useMemo(() => normalizeObj<any>(meRaw), [meRaw]);

  const meUnauthorized =
    (meError as HttpErr | undefined)?.status === 401 ||
    (meError as HttpErr | undefined)?.status === 403;

  const loggedIn = !!me && !meErr && !meUnauthorized;
  const admin = pickIsAdmin(me);

  // --- Genres (kategori dynamic) ---
  const { data: genresRaw } = useQuery({
    queryKey: ["genres"],
    queryFn: () => fetchJson<any>("/api/genres"),
    retry: false,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const genres = useMemo(() => {
    const arr = normalizeArrayAny(genresRaw);
    return arr
      .map((g: any) => ({
        id: Number(g?.id_genre ?? g?.id ?? NaN),
        name: String(g?.nama_genre ?? g?.nama ?? g?.name ?? "").trim(),
      }))
      .filter((g: any) => Number.isFinite(g.id) && g.id > 0 && g.name);
  }, [genresRaw]);

  // --- Cart badge (summary -> fallback cart) ---
  const { data: cartSum } = useQuery({
    queryKey: ["cart-summary"],
    queryFn: () => fetchJson<any>("/api/cart/summary"),
    retry: false,
    staleTime: 3_000,
    refetchOnWindowFocus: false,
    enabled: loggedIn, // ✅ biar ga spam 401 saat belum login
  });

  const { data: cartRaw } = useQuery({
    queryKey: ["cart"],
    queryFn: () => fetchJson<any>("/api/cart"),
    retry: false,
    staleTime: 3_000,
    refetchOnWindowFocus: false,
    enabled: loggedIn, // ✅ biar ga spam 401 saat belum login
  });

  const cartQty = useMemo(() => {
    const sumQty = Number(cartSum?.total_qty ?? cartSum?.data?.total_qty ?? NaN);
    if (Number.isFinite(sumQty)) return sumQty;

    const items = cartRaw?.items ?? cartRaw?.data?.items ?? [];
    return Array.isArray(items)
      ? items.reduce((acc: number, it: any) => acc + Number(it?.jumlah ?? 0), 0)
      : 0;
  }, [cartSum, cartRaw]);

  const nav = [
    { href: "/books", label: "Buku", icon: <BookOpen size={16} /> },
    { href: "/authors", label: "Penulis", icon: null },
    { href: "/orders", label: "Pesanan", icon: null },
  ];

  async function doLogout() {
    try {
      await fetchJson("/api/auth/logout", { method: "POST" });
      await qc.invalidateQueries();
      toast({ variant: "success", title: "Logout", message: "Sampai jumpa 👋" });
      router.push("/");
      router.refresh();
    } catch (e: any) {
      toast({ variant: "error", title: "Gagal logout", message: e?.message || "Coba lagi." });
    }
  }

  // helper push ke /books sesuai BooksPage (search & genre_id)
  function pushBooks(params: { search?: string; genre_id?: string | number }) {
    const qs = new URLSearchParams();
    if (params.search && params.search.trim()) qs.set("search", params.search.trim());
    if (params.genre_id && String(params.genre_id).trim()) qs.set("genre_id", String(params.genre_id));
    router.push(qs.toString() ? `/books?${qs.toString()}` : "/books");
  }

  function submitSearch() {
    const term = q.trim();
    // ✅ sesuai BooksPage kamu: pakai ?search=
    pushBooks({ search: term || undefined, genre_id: urlGenreId || undefined });
  }

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/70 backdrop-blur">
      <div className="container h-16 flex items-center justify-between gap-3">
        {/* Left: Brand */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="md:hidden inline-flex items-center justify-center h-10 w-10 rounded-xl bg-white/5 border border-white/10"
            onClick={() => setOpenMobile((v) => !v)}
            aria-label="Menu"
          >
            <Menu size={18} />
          </button>

          <Link href="/" className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center font-black text-indigo-200">
              SB
            </div>
            <div className="leading-tight hidden sm:block">
              <div className="font-black">SiBuku</div>
              <div className="text-[11px] text-white/50 -mt-0.5">Toko Buku Modern</div>
            </div>
          </Link>
        </div>

        {/* Middle: Search (desktop) */}
        <div className="hidden md:flex flex-1 max-w-xl items-center gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40">
              <Search size={16} />
            </span>
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari judul buku, penulis, genre..."
              className="pl-10"
              onKeyDown={(e) => {
                if (e.key === "Enter") submitSearch();
              }}
            />
          </div>

          {/* ✅ Kategori dynamic - pakai genre_id (sesuai BooksPage) */}
          <div className="relative">
            <select
              className="h-10 rounded-xl bg-white/5 border border-white/10 px-3 text-sm text-white/80 outline-none focus:ring-2 focus:ring-indigo-500/40"
              value={pathname.startsWith("/books") ? urlGenreId : ""}
              onChange={(e) => {
                const v = e.target.value;
                pushBooks({ search: q || undefined, genre_id: v || undefined });
              }}
            >
              <option value="" className="bg-slate-950">
                Semua Genre
              </option>
              {genres.slice(0, 30).map((g: any) => (
                <option key={String(g.id)} value={String(g.id)} className="bg-slate-950">
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          <Button variant="secondary" onClick={submitSearch}>
            Cari
          </Button>
        </div>

        {/* Right */}
        <div className="flex items-center gap-2">
          {/* Nav (desktop) */}
          <nav className="hidden lg:flex items-center gap-1">
            {nav.map((n) => {
              const active = isActive(pathname, n.href);
              return (
                <Link key={n.href} href={n.href}>
                  <Button variant={active ? "secondary" : "ghost"} className="gap-2">
                    {n.icon}
                    {n.label}
                  </Button>
                </Link>
              );
            })}
          </nav>

          {/* Cart */}
          <Link href="/cart" className="relative">
            <Button variant="secondary" className="gap-2">
              <ShoppingCart size={16} />
              <span className="hidden sm:inline">Keranjang</span>
            </Button>

            {loggedIn && cartQty > 0 ? (
              <span className="absolute -top-2 -right-2 h-5 min-w-[20px] px-1 rounded-full bg-indigo-500 text-[11px] font-bold text-white flex items-center justify-center">
                {cartQty}
              </span>
            ) : null}
          </Link>

          {/* Account */}
          {!loggedIn ? (
            <div className="hidden sm:flex items-center gap-2">
              <Link href={`/login?next=${encodeURIComponent(pathname || "/")}`}>
                <Button variant="secondary">Login</Button>
              </Link>
              <Link href="/register">
                <Button>Daftar</Button>
              </Link>
            </div>
          ) : (
            <div className="relative group">
              <Button variant="secondary" className="gap-2">
                <User size={16} />
                <span className="hidden sm:inline">{String(me?.nama ?? me?.email ?? "Akun")}</span>
                {admin ? (
                  <span className="hidden sm:inline text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-400/20 text-indigo-200">
                    Admin
                  </span>
                ) : null}
              </Button>

              {/* Dropdown */}
              <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-white/10 bg-slate-950 shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition">
                <div className="p-3 border-b border-white/10">
                  <div className="text-sm font-semibold text-white/90 line-clamp-1">
                    {String(me?.nama ?? "Pengguna")}
                  </div>
                  <div className="text-xs text-white/50 line-clamp-1">{String(me?.email ?? "")}</div>
                </div>

                <div className="p-2 grid gap-1">
                  <Link href="/account">
                    <Button variant="ghost" className="w-full justify-start gap-2">
                      <User size={16} /> Akun
                    </Button>
                  </Link>

                  <Link href="/orders">
                    <Button variant="ghost" className="w-full justify-start gap-2">
                      <BookOpen size={16} /> Pesanan Saya
                    </Button>
                  </Link>

                  {admin ? (
                    <Link href="/admin">
                      <Button variant="ghost" className="w-full justify-start gap-2">
                        <LayoutDashboard size={16} /> Dashboard Admin
                      </Button>
                    </Link>
                  ) : null}

                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-2 text-rose-200 hover:text-rose-200"
                    onClick={doLogout}
                  >
                    <LogOut size={16} /> Logout
                  </Button>
                </div>

                {meErr && !meUnauthorized ? (
                  <div className="px-3 pb-3 text-[11px] text-rose-200">
                    {(meError as Error)?.message}
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile panel */}
      {openMobile ? (
        <div className="md:hidden border-t border-white/10 bg-slate-950">
          <div className="container py-4 grid gap-3">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40">
                <Search size={16} />
              </span>
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cari buku..."
                className="pl-10"
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitSearch();
                }}
              />
            </div>

            <div className="flex gap-2">
              <Button className="w-full" onClick={submitSearch}>
                Cari
              </Button>
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => {
                  setQ("");
                  pushBooks({ search: undefined, genre_id: undefined });
                }}
              >
                Reset
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              {nav.map((n) => (
                <Link key={n.href} href={n.href}>
                  <Button variant={isActive(pathname, n.href) ? "secondary" : "ghost"}>{n.label}</Button>
                </Link>
              ))}
            </div>

            <div className="grid gap-2">
              <div className="text-xs text-white/60">Kategori</div>
              <div className="flex flex-wrap gap-2">
                {genres.slice(0, 12).map((g: any) => (
                  <button
                    key={String(g.id)}
                    className="px-3 py-1.5 rounded-full text-xs ring-1 bg-white/5 text-white/70 ring-white/10 hover:bg-white/10"
                    onClick={() => pushBooks({ search: q || undefined, genre_id: g.id })}
                  >
                    {g.name}
                  </button>
                ))}
              </div>
            </div>

            {!loggedIn ? (
              <div className="grid grid-cols-2 gap-2">
                <Link href={`/login?next=${encodeURIComponent(pathname || "/")}`}>
                  <Button variant="secondary" className="w-full">
                    Login
                  </Button>
                </Link>
                <Link href="/register">
                  <Button className="w-full">Daftar</Button>
                </Link>
              </div>
            ) : (
              <div className="grid gap-2">
                <Link href="/account">
                  <Button variant="secondary" className="w-full justify-center gap-2">
                    <User size={16} /> Akun
                  </Button>
                </Link>

                {admin ? (
                  <Link href="/admin">
                    <Button variant="secondary" className="w-full justify-center gap-2">
                      <LayoutDashboard size={16} /> Dashboard Admin
                    </Button>
                  </Link>
                ) : null}

                <Button
                  variant="ghost"
                  className="w-full justify-center gap-2 text-rose-200 hover:text-rose-200"
                  onClick={doLogout}
                >
                  <LogOut size={16} /> Logout
                </Button>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
}
