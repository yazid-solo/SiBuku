/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ShoppingCart, Search, LogOut, User, LayoutDashboard } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

import { useMe } from "@/lib/hooks/useMe";
import { useCartSummary } from "@/lib/hooks/useCartSummary";
import { useGenres } from "@/lib/hooks/useGenres";
import { fetchJson } from "@/lib/web/fetchJson";

function initials(name?: string | null) {
  const n = String(name ?? "").trim();
  if (!n) return "U";
  const parts = n.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase()).join("");
}

export default function Header() {
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: me } = useMe();
  const { data: cartSum } = useCartSummary();
  const { data: genres = [] } = useGenres();

  const [q, setQ] = useState("");
  const [genreId, setGenreId] = useState<string>("");

  const cartQty = Number(cartSum?.total_qty ?? 0);
  const isAdmin = !!(me?.is_admin || String(me?.role ?? "").toLowerCase() === "admin");
  const isSeller = String(me?.role ?? "").toLowerCase() === "seller";

  const logoutMut = useMutation({
    mutationFn: async () => {
      // sesuaikan dengan route logout kamu
      return await fetchJson<any>("/api/auth/logout", { method: "POST" });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["me"] });
      await qc.invalidateQueries({ queryKey: ["cart"] });
      await qc.invalidateQueries({ queryKey: ["cart-summary"] });
      toast({ variant: "success", title: "Logout", message: "Kamu sudah logout." });
      router.push("/");
    },
    onError: (e: any) => {
      toast({ variant: "error", title: "Gagal", message: e?.message || "Logout gagal." });
    },
  });

  const goSearch = () => {
    const term = q.trim();
    const gid = genreId ? Number(genreId) : null;

    const sp = new URLSearchParams();
    if (term) sp.set("q", term);
    if (gid && Number.isFinite(gid)) sp.set("genre", String(gid));

    const qs = sp.toString();
    router.push(qs ? `/books?${qs}` : "/books");
  };

  const displayName = useMemo(() => {
    if (!me) return "";
    return String(me.nama ?? me.email ?? "User");
  }, [me]);

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/70 backdrop-blur">
      <div className="container py-3">
        <div className="flex items-center gap-3">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <div className="h-9 w-9 rounded-xl bg-indigo-500/15 ring-1 ring-indigo-500/30 flex items-center justify-center font-black text-indigo-200">
              SB
            </div>
            <div className="hidden sm:block leading-tight">
              <div className="font-black">Sibuku</div>
              <div className="text-[11px] text-white/50 -mt-0.5">Book Commerce</div>
            </div>
          </Link>

          {/* Search */}
          <div className="flex-1 hidden md:flex items-center gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40">
                <Search size={16} />
              </span>
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cari judul buku, penulis, genre..."
                className="pl-10"
                onKeyDown={(e: any) => {
                  if (e.key === "Enter") goSearch();
                }}
              />
            </div>

            <select
              value={genreId}
              onChange={(e) => setGenreId(e.target.value)}
              className="w-56 rounded-xl bg-white/5 border border-white/10 px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500/40"
            >
              <option value="" className="bg-slate-950">
                Semua Genre
              </option>
              {genres.map((g: any) => (
                <option key={g.id} value={String(g.id)} className="bg-slate-950">
                  {g.label}
                </option>
              ))}
            </select>

            <Button onClick={goSearch} className="shrink-0">
              Cari
            </Button>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2 ml-auto">
            {/* Mobile search */}
            <div className="md:hidden">
              <Button
                variant="secondary"
                onClick={() => router.push("/books")}
                className="gap-2"
              >
                <Search size={16} /> Cari
              </Button>
            </div>

            {/* Cart */}
            <Link href="/cart" className="relative">
              <Button variant="secondary" className="gap-2">
                <ShoppingCart size={16} /> <span className="hidden sm:inline">Keranjang</span>
              </Button>
              {cartQty > 0 ? (
                <span className="absolute -top-2 -right-2 h-6 min-w-[24px] px-1 rounded-full bg-indigo-500 text-white text-xs flex items-center justify-center font-bold">
                  {cartQty}
                </span>
              ) : null}
            </Link>

            {/* Account / Admin */}
            {!me ? (
              <div className="flex items-center gap-2">
                <Link href="/login">
                  <Button>Login</Button>
                </Link>
                <Link href="/register" className="hidden sm:block">
                  <Button variant="secondary">Daftar</Button>
                </Link>
              </div>
            ) : (
              <div className="relative group">
                <Button variant="secondary" className="gap-2">
                  <span className="h-7 w-7 rounded-full bg-white/10 ring-1 ring-white/10 flex items-center justify-center text-xs font-bold">
                    {initials(displayName)}
                  </span>
                  <span className="hidden sm:inline max-w-[140px] truncate">{displayName}</span>
                </Button>

                {/* Dropdown */}
                <div className="invisible opacity-0 group-hover:visible group-hover:opacity-100 transition absolute right-0 mt-2 w-56 rounded-2xl border border-white/10 bg-slate-950/95 backdrop-blur p-2 shadow-xl">
                  <div className="px-3 py-2">
                    <div className="text-xs text-white/50">Akun</div>
                    <div className="text-sm font-semibold truncate">{displayName}</div>
                    <div className="text-[11px] text-white/40 mt-0.5">
                      Role: {String(me.role ?? (isAdmin ? "admin" : "user"))}
                    </div>
                  </div>

                  <div className="h-px bg-white/10 my-2" />

                  <button
                    type="button"
                    onClick={() => router.push("/orders")}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-white/5 text-sm flex items-center gap-2"
                  >
                    <User size={16} /> Pesanan Saya
                  </button>

                  <button
                    type="button"
                    onClick={() => router.push("/account")}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-white/5 text-sm flex items-center gap-2"
                  >
                    <User size={16} /> Profil
                  </button>

                  {(isAdmin || isSeller) ? (
                    <button
                      type="button"
                      onClick={() => router.push("/admin")}
                      className="w-full text-left px-3 py-2 rounded-xl hover:bg-white/5 text-sm flex items-center gap-2"
                    >
                      <LayoutDashboard size={16} /> Dashboard
                    </button>
                  ) : null}

                  <div className="h-px bg-white/10 my-2" />

                  <button
                    type="button"
                    onClick={() => logoutMut.mutate()}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-white/5 text-sm flex items-center gap-2 text-rose-200"
                    disabled={logoutMut.isPending}
                  >
                    <LogOut size={16} /> {logoutMut.isPending ? "Keluar..." : "Logout"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Mobile quick search bar */}
        <div className="md:hidden mt-3 flex gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40">
              <Search size={16} />
            </span>
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari buku..."
              className="pl-10"
              onKeyDown={(e: any) => {
                if (e.key === "Enter") goSearch();
              }}
            />
          </div>
          <Button onClick={goSearch}>Cari</Button>
        </div>
      </div>
    </header>
  );
}
