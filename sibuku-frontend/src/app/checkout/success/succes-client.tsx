/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Copy, RefreshCcw, CheckCircle2, Clock3, Package, CreditCard } from "lucide-react";

import Card from "@/components/ui/card";
import Button from "@/components/ui/button";
import Reveal from "@/components/ui/reveal";
import { useToast } from "@/components/ui/toast";

import type { Order } from "@/lib/types";
import { formatRupiah } from "@/lib/utils";
import { fetchJson, prettyApiError } from "@/lib/client/http";

function formatDateTime(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function statusColor(label: string) {
  const s = (label || "").toLowerCase();
  if (s.includes("selesai") || s.includes("lunas"))
    return "bg-emerald-500/15 text-emerald-200 ring-emerald-500/30";
  if (s.includes("batal") || s.includes("gagal"))
    return "bg-rose-500/15 text-rose-200 ring-rose-500/30";
  if (s.includes("dikirim") || s.includes("diproses") || s.includes("proses"))
    return "bg-sky-500/15 text-sky-200 ring-sky-500/30";
  return "bg-amber-500/15 text-amber-200 ring-amber-500/30";
}

function StatusPill({ label }: { label?: string | null }) {
  const text = label || "—";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs ring-1 ${statusColor(text)}`}>
      {text}
    </span>
  );
}

function isPaymentPending(label?: string | null) {
  const s = (label || "").toLowerCase();
  return s.includes("menunggu") || s.includes("pending") || s.includes("belum");
}

function isDone(label?: string | null) {
  const s = (label || "").toLowerCase();
  return s.includes("selesai") || s.includes("lunas");
}

function isProcessing(label?: string | null) {
  const s = (label || "").toLowerCase();
  return s.includes("diproses") || s.includes("proses");
}

function isShipping(label?: string | null) {
  const s = (label || "").toLowerCase();
  return s.includes("dikirim") || s.includes("shipping") || s.includes("siap kirim");
}

function pickPaymentMethodName(order?: any) {
  const obj =
    order?.jenis_pembayaran ??
    order?.payment_method ??
    order?.metode_pembayaran ??
    order?.metodePembayaran ??
    null;

  const name =
    obj?.nama_pembayaran ??
    obj?.nama_metode ??
    obj?.nama ??
    order?.nama_pembayaran ??
    order?.nama_metode ??
    order?.payment_method_name ??
    "";

  return String(name || "").trim() || "—";
}

function safeArr(x: any) {
  return Array.isArray(x) ? x : [];
}

function ItemLine({ it }: { it: any }) {
  const title = it?.buku?.judul ?? it?.judul ?? (it?.id_buku ? `Buku ID: ${it.id_buku}` : "Item");
  const cover = it?.buku?.cover_image ?? it?.cover_image ?? null;
  const qty = Number(it?.jumlah ?? 0);
  const subtotal = Number(it?.subtotal ?? 0);

  return (
    <div className="py-3 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-12 w-12 rounded-xl overflow-hidden bg-white/5 border border-white/10 shrink-0">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt={title} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-[10px] text-white/40">—</div>
          )}
        </div>

        <div className="min-w-0">
          <div className="text-sm font-semibold line-clamp-1">{title}</div>
          <div className="text-[11px] text-white/50 mt-0.5">Qty: {Number.isFinite(qty) ? qty : "—"}</div>
        </div>
      </div>

      <div className="text-sm font-semibold text-white/80">
        {formatRupiah(Number.isFinite(subtotal) ? subtotal : 0)}
      </div>
    </div>
  );
}

function Step({ icon, title, active, done }: { icon: React.ReactNode; title: string; active?: boolean; done?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={[
          "h-10 w-10 rounded-2xl grid place-items-center ring-1",
          done
            ? "bg-emerald-500/15 text-emerald-200 ring-emerald-500/30"
            : active
            ? "bg-indigo-500/15 text-indigo-200 ring-indigo-500/30"
            : "bg-white/5 text-white/60 ring-white/10",
        ].join(" ")}
      >
        {icon}
      </div>
      <div className="text-sm font-semibold text-white/90">{title}</div>
    </div>
  );
}

export default function SuccessClient({ orderId }: { orderId: string }) {
  const router = useRouter();
  const { toast } = useToast();

  const { data: order, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => fetchJson<Order>(`/api/orders/${encodeURIComponent(orderId)}`),
    enabled: !!orderId,
    retry: false,
    staleTime: 0,
    refetchInterval: (q) => {
      const current = q.state.data as any as Order | undefined;
      const pay = current?.status_pembayaran?.nama_status ?? null;
      return isPaymentPending(pay) ? 3000 : false;
    },
    refetchOnWindowFocus: false,
  });

  const orderCode = order?.kode_order ?? "";
  const payStatus = order?.status_pembayaran?.nama_status ?? "—";
  const orderStatus = order?.status_order?.nama_status ?? "—";
  const createdAt = order?.created_at ?? null;
  const total = Number(order?.total_harga ?? 0);

  const items = safeArr((order as any)?.order_item);
  const totalQty = useMemo(() => items.reduce((a: number, it: any) => a + Number(it?.jumlah ?? 0), 0), [items]);

  const alamat = typeof (order as any)?.alamat_pengiriman === "string" ? (order as any).alamat_pengiriman.trim() : "";
  const pmName = pickPaymentMethodName(order as any);

  const showAuto = isPaymentPending(payStatus);
  const payDone = isDone(payStatus);
  const ordDone = isDone(orderStatus) || isDone(payStatus);
  const ordProcessing = isProcessing(orderStatus);
  const ordShipping = isShipping(orderStatus);

  const invoiceTitle = useMemo(() => {
    if (!orderId) return "Checkout Berhasil 🎉";
    return showAuto ? "Pesanan Dibuat — Menunggu Pembayaran" : "Pesanan Berhasil Dibuat 🎉";
  }, [orderId, showAuto]);

  return (
    <div className="container py-12">
      <Reveal>
        <div className="max-w-3xl mx-auto">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-3xl font-black">{invoiceTitle}</h1>
              <p className="text-white/60 mt-2">
                Ini ringkasan pesanan kamu. Status akan otomatis ikut berubah setelah admin update pembayaran / order.
              </p>
            </div>

            <Button
              variant="secondary"
              onClick={() => refetch()}
              className="shrink-0 gap-2"
              disabled={isFetching || !orderId}
              title="Refresh"
            >
              <RefreshCcw size={16} />
              {isFetching ? "..." : "Refresh"}
            </Button>
          </div>

          <Card className="mt-6">
            {isLoading ? (
              <div className="grid gap-3 animate-pulse">
                <div className="h-4 w-56 rounded bg-white/5" />
                <div className="h-4 w-72 rounded bg-white/5" />
                <div className="h-24 rounded bg-white/5" />
              </div>
            ) : isError ? (
              <div className="grid gap-3">
                <div className="font-semibold text-rose-200">Gagal memuat invoice</div>
                <div className="text-sm text-white/60">{prettyApiError(error)}</div>
                <div className="flex gap-2 flex-wrap">
                  <Button onClick={() => refetch()}>Coba lagi</Button>
                  <Button variant="secondary" onClick={() => router.push("/orders")}>
                    Ke Pesanan Saya
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid gap-4">
                {/* Progress steps */}
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-sm font-semibold">Progress</div>
                  <div className="mt-4 grid sm:grid-cols-3 gap-4">
                    <Step icon={<CheckCircle2 size={18} />} title="Order dibuat" done />
                    <Step
                      icon={showAuto ? <Clock3 size={18} /> : <CreditCard size={18} />}
                      title={showAuto ? "Menunggu bayar" : payDone ? "Pembayaran OK" : "Pembayaran"}
                      active={showAuto}
                      done={payDone}
                    />
                    <Step
                      icon={<Package size={18} />}
                      title={ordDone ? "Selesai" : ordShipping ? "Dikirim" : ordProcessing ? "Diproses" : "Diproses"}
                      active={!ordDone && !ordShipping && !ordProcessing && !showAuto}
                      done={ordDone}
                    />
                  </div>

                  {showAuto ? (
                    <div className="text-xs text-amber-200 mt-4">
                      Pembayaran masih menunggu — halaman ini akan auto-refresh sampai status berubah.
                    </div>
                  ) : null}
                </div>

                {/* Header invoice */}
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm text-white/60">Invoice</div>

                    <div className="mt-1 flex items-center gap-2 flex-wrap">
                      <div className="text-lg font-extrabold">
                        {orderCode ? orderCode : orderId ? `Order #${orderId}` : "Order"}
                      </div>

                      {(orderCode || orderId) && (
                        <Button
                          variant="secondary"
                          className="h-8 px-3 gap-2"
                          onClick={async () => {
                            try {
                              const text = orderCode || orderId;
                              await navigator.clipboard.writeText(String(text));
                              toast({ variant: "success", title: "Tersalin", message: "Kode order berhasil dicopy." });
                            } catch {
                              toast({ variant: "error", title: "Gagal", message: "Tidak bisa akses clipboard." });
                            }
                          }}
                        >
                          <Copy size={14} />
                          Copy
                        </Button>
                      )}
                    </div>

                    <div className="text-xs text-white/50 mt-1">Dibuat: {formatDateTime(createdAt)}</div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <StatusPill label={orderStatus} />
                      <StatusPill label={payStatus} />
                    </div>
                  </div>

                  <div className="md:text-right">
                    <div className="text-sm text-white/60">Total</div>
                    <div className="text-xl font-extrabold text-indigo-200">{formatRupiah(total)}</div>
                  </div>
                </div>

                {/* Ringkasan + alamat + metode */}
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-sm font-semibold">Ringkasan</div>

                  <div className="mt-3 grid gap-2 text-sm text-white/70">
                    <div className="flex justify-between gap-4">
                      <span>Order ID</span>
                      <span className="text-white/90 font-semibold">{orderId || "—"}</span>
                    </div>

                    <div className="flex justify-between gap-4">
                      <span>Metode Pembayaran</span>
                      <span className="text-white/90">{pmName}</span>
                    </div>

                    <div className="flex justify-between gap-4">
                      <span>Total Item</span>
                      <span className="text-white/90">{Number.isFinite(totalQty) ? totalQty : "—"}</span>
                    </div>

                    {alamat ? (
                      <div className="pt-2 border-t border-white/10">
                        <div className="text-xs text-white/50">Alamat Pengiriman</div>
                        <div className="text-sm text-white/80 mt-1">{alamat}</div>
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* Items preview */}
                <div className="rounded-2xl border border-white/10 bg-white/5">
                  <div className="p-4 flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold">Item Pesanan</div>
                    {!!orderId && (
                      <Link href={`/orders/${orderId}`} className="text-xs text-indigo-300 hover:text-indigo-200">
                        Lihat detail →
                      </Link>
                    )}
                  </div>

                  <div className="px-4 pb-2 divide-y divide-white/10">
                    {items.length ? (
                      items.slice(0, 3).map((it: any, idx: number) => (
                        <ItemLine key={String(it?.id_order_item ?? it?.id ?? `${orderId}-${idx}`)} it={it} />
                      ))
                    ) : (
                      <div className="py-3 text-sm text-white/60">Item belum tersedia di response.</div>
                    )}
                  </div>

                  {items.length > 3 ? (
                    <div className="px-4 pb-4 text-xs text-white/50">+{items.length - 3} item lainnya</div>
                  ) : (
                    <div className="pb-2" />
                  )}
                </div>

                {/* CTA */}
                <div className="grid gap-2">
                  <Link href="/orders">
                    <Button className="w-full">Lihat Pesanan Saya</Button>
                  </Link>

                  {!!orderId && (
                    <Link href={`/orders/${orderId}`}>
                      <Button variant="secondary" className="w-full">
                        Lihat Detail Order
                      </Button>
                    </Link>
                  )}

                  <Link href="/books">
                    <Button variant="ghost" className="w-full">
                      Belanja Lagi
                    </Button>
                  </Link>
                </div>

                <div className="text-[11px] text-white/45">
                  *Status pembayaran/order akan ikut berubah otomatis setelah admin update.
                </div>
              </div>
            )}
          </Card>
        </div>
      </Reveal>
    </div>
  );
}