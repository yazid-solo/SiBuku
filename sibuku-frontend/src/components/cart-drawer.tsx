/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ShoppingCart, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import Portal from "@/components/ui/portal";
import Card from "@/components/ui/card";
import Button from "@/components/ui/button";
import { formatRupiah } from "@/lib/utils";

type CartItem = {
  id_keranjang_item: number;
  jumlah: number;
  harga_satuan?: number | null;
  subtotal?: number | null;
  buku?: {
    id_buku: number;
    judul?: string | null;
    cover_image?: string | null;
  } | null;
};

type CartView = {
  items: CartItem[];
  summary?: { total_qty?: number; total_price?: number } | null;
};

async function fetchCart(): Promise<CartView | null> {
  const res = await fetch("/api/cart", { cache: "no-store" });

  // belum login -> jangan errorin UI
  if (res.status === 401 || res.status === 403) return null;

  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.detail || "Gagal memuat keranjang");
  return data as CartView;
}

export default function CartDrawer({ badgeQty = 0 }: { badgeQty?: number }) {
  const [open, setOpen] = useState(false);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["cart"],
    queryFn: fetchCart,
    enabled: open, // fetch hanya saat drawer dibuka
    staleTime: 3_000,
    retry: false,
  });

  // lock scroll body
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // ESC close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const items = data?.items ?? [];
  const totalQty = data?.summary?.total_qty ?? 0;
  const totalPrice = Number(data?.summary?.total_price ?? 0);

  const isAuthed = data !== null; // null = 401/403
  const empty = isAuthed && !isLoading && items.length === 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative px-3 py-2 rounded-xl hover:bg-white/5 text-sm flex items-center gap-2"
        aria-label={`Cart (${badgeQty} item)`}
      >
        <ShoppingCart size={18} />
        <span>Cart</span>

        {badgeQty > 0 && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-indigo-500 text-white text-[11px] flex items-center justify-center">
            {badgeQty > 99 ? "99+" : badgeQty}
          </span>
        )}
      </button>

      {open && (
        <Portal>
          <div className="fixed inset-0 z-[80]">
            {/* overlay */}
            <button
              type="button"
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setOpen(false)}
              aria-label="Close overlay"
            />

            {/* drawer */}
            <div className="absolute right-3 top-3 bottom-3 w-[420px] max-w-[calc(100vw-1.5rem)]">
              <Card className="h-full flex flex-col overflow-hidden">
                <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
                  <div className="font-semibold">
                    Keranjang {isAuthed ? `(${totalQty})` : ""}
                  </div>
                  <Button variant="ghost" className="gap-2" onClick={() => setOpen(false)}>
                    <X size={16} /> Tutup
                  </Button>
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-4">
                  {isLoading ? (
                    <div className="text-sm text-white/70">Memuat...</div>
                  ) : isError ? (
                    <div className="text-sm">
                      <div className="font-semibold text-rose-200">Gagal memuat</div>
                      <div className="text-white/60 mt-1">{(error as Error)?.message}</div>
                    </div>
                  ) : !isAuthed ? (
                    <div className="text-sm">
                      <div className="font-semibold">Kamu belum login</div>
                      <div className="text-white/60 mt-1">Login dulu untuk melihat keranjang.</div>
                      <div className="mt-4">
                        <Link href="/login?next=/books">
                          <Button className="w-full" onClick={() => setOpen(false)}>
                            Login
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ) : empty ? (
                    <div className="text-sm">
                      <div className="font-semibold">Keranjang kosong</div>
                      <div className="text-white/60 mt-1">Yuk mulai belanja.</div>
                      <div className="mt-4">
                        <Link href="/books">
                          <Button className="w-full" onClick={() => setOpen(false)}>
                            Mulai Belanja
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      {items.map((it) => (
                        <div key={it.id_keranjang_item} className="flex items-center gap-3">
                          <div className="h-12 w-12 rounded-xl overflow-hidden bg-white/5 border border-white/10 flex-shrink-0">
                            <img
                              src={it.buku?.cover_image || "/illustrations/hero-books.svg"}
                              alt={it.buku?.judul || "Buku"}
                              className="h-full w-full object-cover"
                            />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold line-clamp-1">
                              {it.buku?.judul || "—"}
                            </div>
                            <div className="text-xs text-white/60">
                              Qty: <span className="text-white/80 font-semibold">{it.jumlah}</span>
                            </div>
                          </div>

                          <div className="text-sm font-semibold text-white/80">
                            {formatRupiah(Number(it.subtotal ?? 0))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="border-t border-white/10 px-4 py-4">
                  <div className="flex items-center justify-between text-sm text-white/70">
                    <span>Total</span>
                    <span className="text-indigo-200 font-extrabold">
                      {formatRupiah(totalPrice)}
                    </span>
                  </div>

                  <div className="mt-3 grid gap-2">
                    <Link href="/checkout">
                      <Button
                        className="w-full"
                        disabled={!isAuthed || items.length === 0 || isLoading}
                        onClick={() => setOpen(false)}
                      >
                        Checkout
                      </Button>
                    </Link>

                    <Link href="/cart">
                      <Button variant="secondary" className="w-full" onClick={() => setOpen(false)}>
                        Lihat Keranjang
                      </Button>
                    </Link>
                  </div>

                  <div className="text-[11px] text-white/50 mt-3">
                    Data otomatis dari endpoint <code className="text-white/70">/api/cart</code>.
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </Portal>
      )}
    </>
  );
}
