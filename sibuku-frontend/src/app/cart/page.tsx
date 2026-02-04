"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import Link from "next/link";
import Image from "next/image";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import Card from "@/components/ui/card";
import Button from "@/components/ui/button";
import Reveal from "@/components/ui/reveal";
import Badge from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";

import type { CartView } from "@/lib/types";
import { formatRupiah } from "@/lib/utils";
import { fetchJson, type HttpErr, prettyApiError } from "@/lib/client/http";

function isRemoteUrl(src?: string | null) {
  const s = String(src ?? "").trim();
  return s.startsWith("http://") || s.startsWith("https://");
}
function isSvg(path?: string | null) {
  return String(path ?? "").toLowerCase().endsWith(".svg");
}
function clamp(n: number, min: number, max: number) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, Math.trunc(x)));
}

export default function CartPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useToast();

  const {
    data: cart,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery<CartView>({
    queryKey: ["cart"],
    queryFn: () => fetchJson<CartView>("/api/cart"),
    retry: false,
    staleTime: 3_000,
    refetchOnWindowFocus: false,
  });

  const unauthorized =
    (error as HttpErr | undefined)?.status === 401 || (error as HttpErr | undefined)?.status === 403;

  const items = cart?.items ?? [];
  const summary = cart?.summary ?? { total_qty: 0, total_price: 0 };
  const totalPrice = Number(summary.total_price || 0);

  const canCheckout = !isLoading && !isError && !unauthorized && items.length > 0;

  const mutQty = useMutation({
    mutationFn: ({ id, qty }: { id: number; qty: number }) =>
      fetchJson(`/api/cart/items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jumlah: qty }),
      }),

    // ✅ bikin terasa “ecommerce”: update UI dulu (optimistic) biar responsif
    onMutate: async ({ id, qty }) => {
      await qc.cancelQueries({ queryKey: ["cart"] });

      const prev = qc.getQueryData<CartView>(["cart"]);
      if (prev?.items) {
        const nextItems = prev.items.map((it: any) => {
          if (Number(it.id_keranjang_item) !== Number(id)) return it;
          const harga = Number(it.harga_satuan || 0);
          return { ...it, jumlah: qty, subtotal: harga * qty };
        });

        const nextTotalQty = nextItems.reduce((a: number, it: any) => a + Number(it.jumlah || 0), 0);
        const nextTotalPrice = nextItems.reduce((a: number, it: any) => a + Number(it.subtotal || 0), 0);

        qc.setQueryData<CartView>(["cart"], {
          ...prev,
          items: nextItems,
          summary: { ...(prev.summary as any), total_qty: nextTotalQty, total_price: nextTotalPrice } as any,
        });
      }

      return { prev };
    },

    onError: async (e: any, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["cart"], ctx.prev);

      const status = (e as HttpErr | undefined)?.status;
      if (status === 401 || status === 403) {
        router.push("/login?next=/cart");
        return;
      }

      toast({ variant: "error", title: "Gagal", message: prettyApiError(e) });
    },

    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["cart"] });
      await qc.invalidateQueries({ queryKey: ["cart-summary"] });
    },
  });

  const mutDel = useMutation({
    mutationFn: (id: number) => fetchJson(`/api/cart/items/${id}`, { method: "DELETE" }),

    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["cart"] });

      const prev = qc.getQueryData<CartView>(["cart"]);
      if (prev?.items) {
        const nextItems = prev.items.filter((x: any) => Number(x.id_keranjang_item) !== Number(id));
        const nextTotalQty = nextItems.reduce((a: number, it: any) => a + Number(it.jumlah || 0), 0);
        const nextTotalPrice = nextItems.reduce((a: number, it: any) => a + Number(it.subtotal || 0), 0);

        qc.setQueryData<CartView>(["cart"], {
          ...prev,
          items: nextItems,
          summary: { ...(prev.summary as any), total_qty: nextTotalQty, total_price: nextTotalPrice } as any,
        });
      }

      return { prev };
    },

    onError: async (e: any, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["cart"], ctx.prev);

      const status = (e as HttpErr | undefined)?.status;
      if (status === 401 || status === 403) {
        router.push("/login?next=/cart");
        return;
      }

      toast({ variant: "error", title: "Gagal", message: prettyApiError(e) });
    },

    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["cart"] });
      await qc.invalidateQueries({ queryKey: ["cart-summary"] });
      toast({ variant: "success", title: "Terhapus", message: "Item dihapus dari keranjang." });
    },
  });

  const skeleton = useMemo(
    () =>
      Array.from({ length: 3 }).map((_, i) => (
        <Card key={i} className="animate-pulse">
          <div className="h-24 bg-white/5 rounded-xl" />
        </Card>
      )),
    []
  );

  return (
    <div className="container py-10 pb-28 md:pb-10">
      <Reveal>
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black">Keranjang</h1>
            <p className="text-white/60 mt-1">Periksa item sebelum checkout.</p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => refetch()}
              disabled={isFetching}
              className="gap-2"
              title="Refresh"
            >
              {isFetching ? "..." : "Refresh"}
            </Button>

            <Link href="/books" className="hidden sm:block">
              <Button variant="ghost">+ Tambah Buku</Button>
            </Link>
          </div>
        </div>
      </Reveal>

      {unauthorized ? (
        <div className="mt-6">
          <Card className="border border-amber-500/30 bg-amber-500/5">
            <div className="font-semibold text-amber-200">Kamu perlu login</div>
            <div className="text-sm text-white/60 mt-1">Keranjang hanya bisa diakses setelah login.</div>
            <div className="mt-4">
              <Link href="/login?next=/cart">
                <Button>Login</Button>
              </Link>
            </div>
          </Card>
        </div>
      ) : isLoading ? (
        <div className="mt-6 grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 grid gap-3">{skeleton}</div>
          <Card className="animate-pulse">
            <div className="h-4 bg-white/5 rounded w-40" />
            <div className="h-10 bg-white/5 rounded mt-4" />
          </Card>
        </div>
      ) : isError ? (
        <div className="mt-6">
          <Card className="border border-rose-500/30 bg-rose-500/5">
            <div className="font-semibold text-rose-200">Gagal memuat keranjang</div>
            <div className="text-sm text-white/60 mt-1">{(error as Error)?.message}</div>
            <div className="mt-4 flex gap-2">
              <Button variant="secondary" onClick={() => refetch()}>
                Coba lagi
              </Button>
              <Link href="/books">
                <Button variant="ghost">Ke katalog</Button>
              </Link>
            </div>
          </Card>
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-6 mt-6 items-start">
          {/* LEFT - Items */}
          <div className="lg:col-span-2 space-y-3">
            {items.length === 0 ? (
              <Card>
                <div className="font-semibold">Keranjang kosong</div>
                <div className="text-sm text-white/60 mt-1">Yuk cari buku favorit kamu.</div>
                <div className="mt-4">
                  <Link href="/books">
                    <Button>Mulai Belanja</Button>
                  </Link>
                </div>
              </Card>
            ) : (
              items.map((it: any) => {
                const cover = it.buku?.cover_image || "/illustrations/hero-books.svg";
                const unoptimized = isRemoteUrl(cover) || isSvg(cover);

                const qty = Number(it.jumlah || 1);
                const stok = Number(it.buku?.stok ?? 99);
                const maxQty = clamp(stok || 99, 1, 99);

                const disableMinus = mutQty.isPending || qty <= 1;
                const disablePlus = mutQty.isPending || qty >= maxQty || stok <= 0;

                return (
                  <Card key={it.id_keranjang_item} className="flex flex-col sm:flex-row gap-4 sm:items-center">
                    <div className="relative w-full sm:w-28 h-28 sm:h-20 rounded-xl overflow-hidden bg-white/5 border border-white/10">
                      <Image
                        src={cover}
                        alt={it.buku?.judul || "Buku"}
                        fill
                        unoptimized={unoptimized}
                        sizes="(max-width: 640px) 100vw, 112px"
                        className="object-cover"
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold line-clamp-2">{it.buku?.judul || "—"}</div>
                          <div className="text-sm text-white/60 mt-1">
                            {formatRupiah(Number(it.harga_satuan || 0))}
                          </div>
                        </div>

                        <div className="shrink-0 flex items-center gap-2">
                          {stok <= 0 ? (
                            <Badge className="bg-rose-500/15 text-rose-200 border border-rose-400/20">Stok habis</Badge>
                          ) : (
                            <Badge className="bg-white/5 text-white/70 border border-white/10">
                              Stok: <b className="text-white/85 ml-1">{stok}</b>
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="text-sm mt-1 text-white/70">
                        Subtotal: <b className="text-white/90">{formatRupiah(Number(it.subtotal || 0))}</b>
                      </div>

                      <div className="mt-4 flex items-center justify-between sm:justify-end gap-3">
                        <div className="inline-flex items-center rounded-xl border border-white/10 bg-white/5 p-1">
                          <Button
                            variant="ghost"
                            className="h-9 w-10 px-0"
                            disabled={disableMinus}
                            onClick={() =>
                              mutQty.mutate({
                                id: it.id_keranjang_item,
                                qty: clamp(qty - 1, 1, maxQty),
                              })
                            }
                            title="Kurangi"
                          >
                            −
                          </Button>

                          <div className="min-w-10 text-center font-semibold text-white/90">{qty}</div>

                          <Button
                            variant="ghost"
                            className="h-9 w-10 px-0"
                            disabled={disablePlus}
                            onClick={() =>
                              mutQty.mutate({
                                id: it.id_keranjang_item,
                                qty: clamp(qty + 1, 1, maxQty),
                              })
                            }
                            title="Tambah"
                          >
                            +
                          </Button>
                        </div>

                        <Button
                          variant="ghost"
                          disabled={mutDel.isPending}
                          className="text-rose-200 hover:bg-rose-500/10"
                          onClick={() => {
                            const ok = window.confirm("Hapus item ini dari keranjang?");
                            if (!ok) return;
                            mutDel.mutate(it.id_keranjang_item);
                          }}
                        >
                          Hapus
                        </Button>
                      </div>

                      <div className="mt-2 text-[11px] text-white/45">
                        Maks. {maxQty} per item (mengikuti stok).
                      </div>
                    </div>
                  </Card>
                );
              })
            )}
          </div>

          {/* RIGHT - Summary */}
          <div className="lg:sticky lg:top-24">
            <Card>
              <div className="flex items-start justify-between gap-3">
                <div className="font-semibold">Ringkasan</div>
                <Badge className="bg-emerald-500/10 text-emerald-200 border border-emerald-400/20">
                  Secure checkout
                </Badge>
              </div>

              <div className="text-sm text-white/70 mt-3 flex justify-between">
                <span>Total item</span>
                <span className="text-white/90 font-semibold">{summary.total_qty}</span>
              </div>

              <div className="text-sm text-white/70 mt-2 flex justify-between">
                <span>Total harga</span>
                <span className="font-extrabold text-indigo-200">{formatRupiah(totalPrice)}</span>
              </div>

              <div className="mt-5 grid gap-2">
                <Button className="w-full" disabled={!canCheckout} onClick={() => router.push("/checkout")}>
                  Lanjut Checkout
                </Button>

                <Link href="/books">
                  <Button variant="secondary" className="w-full">
                    Tambah Buku Lagi
                  </Button>
                </Link>

                <div className="text-[11px] text-white/50">
                  Total mengikuti perhitungan. Metode pembayaran dipilih di checkout.
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ✅ Mobile bottom bar biar ecommerce banget */}
      {!unauthorized && !isError && items.length > 0 ? (
        <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t border-white/10 bg-slate-950/80 backdrop-blur">
          <div className="container py-3 flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-[11px] text-white/55">Total</div>
              <div className="font-extrabold text-indigo-200 leading-tight">{formatRupiah(totalPrice)}</div>
            </div>
            <Button disabled={!canCheckout} onClick={() => router.push("/checkout")}>
              Checkout
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}