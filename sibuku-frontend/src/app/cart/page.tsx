"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import Card from "@/components/ui/card";
import Button from "@/components/ui/button";
import Reveal from "@/components/ui/reveal";
import { useToast } from "@/components/ui/toast";

import type { CartView } from "@/lib/types";
import { formatRupiah } from "@/lib/utils";
import { fetchJson, type HttpErr, prettyApiError } from "@/lib/client/http";

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

  const mutQty = useMutation({
    mutationFn: ({ id, qty }: { id: number; qty: number }) =>
      fetchJson(`/api/cart/items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jumlah: qty }),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["cart"] });
      await qc.invalidateQueries({ queryKey: ["cart-summary"] });
    },
    onError: (e: any) =>
      toast({ variant: "error", title: "Gagal", message: prettyApiError(e) }),
  });

  const mutDel = useMutation({
    mutationFn: (id: number) => fetchJson(`/api/cart/items/${id}`, { method: "DELETE" }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["cart"] });
      await qc.invalidateQueries({ queryKey: ["cart-summary"] });
      toast({ variant: "success", title: "Terhapus", message: "Item dihapus dari keranjang." });
    },
    onError: (e: any) =>
      toast({ variant: "error", title: "Gagal", message: prettyApiError(e) }),
  });

  const items = cart?.items ?? [];
  const summary = cart?.summary ?? { total_qty: 0, total_price: 0 };

  return (
    <div className="container py-10">
      <Reveal>
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black">Keranjang</h1>
            <p className="text-white/60 mt-1">Periksa item sebelum checkout.</p>
          </div>

          <Button
            variant="secondary"
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-2"
            title="Refresh"
          >
            {isFetching ? "..." : "Refresh"}
          </Button>
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
        <div className="mt-6 grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 grid gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="animate-pulse">
                <div className="h-20 bg-white/5 rounded" />
              </Card>
            ))}
          </div>
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
              items.map((it) => (
                <Card key={it.id_keranjang_item} className="flex flex-col sm:flex-row gap-4 sm:items-center">
                  <div className="relative w-full sm:w-28 h-28 sm:h-20 rounded-xl overflow-hidden bg-white/5 border border-white/10">
                    <Image
                      src={it.buku?.cover_image || "/illustrations/hero-books.svg"}
                      alt={it.buku?.judul || "Buku"}
                      fill
                      sizes="(max-width: 640px) 100vw, 112px"
                      className="object-cover"
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="font-semibold line-clamp-2">{it.buku?.judul || "—"}</div>
                    <div className="text-sm text-white/60 mt-1">
                      {formatRupiah(Number(it.harga_satuan || 0))}
                    </div>
                    <div className="text-sm mt-1 text-white/70">
                      Subtotal: <b className="text-white/90">{formatRupiah(Number(it.subtotal || 0))}</b>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        disabled={mutQty.isPending || it.jumlah <= 1}
                        onClick={() =>
                          mutQty.mutate({
                            id: it.id_keranjang_item,
                            qty: Math.max(1, it.jumlah - 1),
                          })
                        }
                      >
                        −
                      </Button>
                      <div className="min-w-8 text-center font-semibold">{it.jumlah}</div>
                      <Button
                        variant="secondary"
                        disabled={mutQty.isPending}
                        onClick={() =>
                          mutQty.mutate({
                            id: it.id_keranjang_item,
                            qty: it.jumlah + 1,
                          })
                        }
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
                </Card>
              ))
            )}
          </div>

          {/* RIGHT - Summary */}
          <div className="lg:sticky lg:top-24">
            <Card>
              <div className="font-semibold">Ringkasan</div>

              <div className="text-sm text-white/70 mt-3 flex justify-between">
                <span>Total item</span>
                <span className="text-white/90 font-semibold">{summary.total_qty}</span>
              </div>

              <div className="text-sm text-white/70 mt-2 flex justify-between">
                <span>Total harga</span>
                <span className="font-extrabold text-indigo-200">
                  {formatRupiah(Number(summary.total_price || 0))}
                </span>
              </div>

              <div className="mt-5 grid gap-2">
                <Button
                  className="w-full"
                  disabled={items.length === 0}
                  onClick={() => router.push("/checkout")}
                >
                  Lanjut Checkout
                </Button>

                <Link href="/books">
                  <Button variant="secondary" className="w-full">
                    Tambah Buku Lagi
                  </Button>
                </Link>

                <div className="text-[11px] text-white/50">
                  Tips: Checkout akan otomatis ambil metode pembayaran.
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
