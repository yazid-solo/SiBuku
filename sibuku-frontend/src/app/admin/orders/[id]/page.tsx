/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import Card from "@/components/ui/card";
import Button from "@/components/ui/button";
import Reveal from "@/components/ui/reveal";
import { useToast } from "@/components/ui/toast";

import type { Order } from "@/lib/types";
import { formatRupiah } from "@/lib/utils";

type HttpErr = Error & { status?: number; data?: any };

/** ✅ penting: pastikan detail error FastAPI (object/array) selalu jadi string */
function toPlainMessage(detail: any): string {
  if (!detail) return "";
  if (typeof detail === "string") return detail;

  // FastAPI: detail = [{ loc, msg, type, input }, ...]
  if (Array.isArray(detail)) {
    return detail
      .map((x) => {
        if (!x) return "";
        if (typeof x === "string") return x;

        if (typeof x === "object") {
          const loc = Array.isArray(x.loc) ? x.loc.join(".") : String(x.loc ?? "");
          const msg = x.msg ?? JSON.stringify(x);
          return loc ? `${loc}: ${String(msg)}` : String(msg);
        }

        return String(x);
      })
      .filter(Boolean)
      .join(" • ");
  }

  // detail = { loc, msg, type, input }
  if (typeof detail === "object") {
    const loc = Array.isArray(detail.loc) ? detail.loc.join(".") : String(detail.loc ?? "");
    const msg = detail.msg ?? JSON.stringify(detail);
    return loc ? `${loc}: ${String(msg)}` : String(msg);
  }

  return String(detail);
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    cache: "no-store",
    credentials: "include",
    ...init,
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const msg =
      toPlainMessage(data?.detail) ||
      toPlainMessage(data?.message) ||
      `Request gagal (${res.status})`;

    const err = new Error(msg) as HttpErr;
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data as T;
}

function normalizeArrayAny(x: any): any[] {
  if (Array.isArray(x)) return x;
  if (x && Array.isArray(x.data)) return x.data;
  if (x?.data?.data && Array.isArray(x.data.data)) return x.data.data;
  return [];
}

function fmtDateTime(iso?: string | null) {
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

/** ---- master status ---- */
type StatusItem = { id: number; label: string };

function extractStatusId(x: any): number | null {
  const keys = ["id_status", "id_status_order", "id_status_pembayaran", "id", "value"];
  for (const k of keys) {
    const n = Number(x?.[k]);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

function extractStatusLabel(x: any): string {
  const keys = ["nama_status", "nama", "name", "label", "value"];
  for (const k of keys) {
    const s = String(x?.[k] ?? "").trim();
    if (s) return s;
  }
  return "";
}

/**
 * ✅ FIX DUPLIKAT:
 * - Dedupe berdasarkan label (case-insensitive)
 * - Prefer id yang dipakai order saat ini
 */
function normalizeStatusList(raw: any, preferId?: number | null): StatusItem[] {
  const arr = normalizeArrayAny(raw);

  const groups = new Map<string, StatusItem[]>();

  for (const x of arr) {
    if (!x || typeof x !== "object") continue;

    const id = extractStatusId(x);
    const label = extractStatusLabel(x);

    if (!id || !label) continue;

    const key = label.trim().toLowerCase();
    const list = groups.get(key) ?? [];
    list.push({ id, label });
    groups.set(key, list);
  }

  const out: StatusItem[] = [];

  for (const [, list] of groups) {
    let pick: StatusItem | undefined;

    if (preferId != null) {
      pick = list.find((it) => it.id === preferId);
    }
    if (!pick) {
      pick = list.slice().sort((a, b) => a.id - b.id)[0];
    }
    if (pick) out.push(pick);
  }

  return out.sort((a, b) => a.id - b.id);
}

/** ---- API ---- */
async function fetchOrder(id: string): Promise<Order> {
  return await fetchJson<Order>(`/api/admin/orders/${id}`);
}

async function fetchStatusOrder(): Promise<any> {
  return await fetchJson<any>("/api/admin/master/status-order");
}

async function fetchStatusBayar(): Promise<any> {
  return await fetchJson<any>("/api/admin/master/status-pembayaran");
}

async function patchOrderStatus(id: string, payload: any) {
  return await fetchJson(`/api/admin/orders/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

function pickFastApiDetail(errData: any): string {
  return toPlainMessage(errData?.detail) || toPlainMessage(errData?.message) || "";
}

export default function AdminOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useToast();

  const id = String((params as any)?.id ?? "");

  const { data: order, isLoading, isError, error } = useQuery({
    queryKey: ["admin-order", id],
    queryFn: () => fetchOrder(id),
    enabled: !!id,
    retry: false,
    staleTime: 5_000,
  });

  const {
    data: statusOrderRaw,
    isFetching: fetchingStatusOrder,
    error: statusOrderError,
    refetch: refetchStatusOrder,
  } = useQuery({
    queryKey: ["admin-status-order"],
    queryFn: fetchStatusOrder,
    retry: false,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const {
    data: statusBayarRaw,
    isFetching: fetchingStatusBayar,
    error: statusBayarError,
    refetch: refetchStatusBayar,
  } = useQuery({
    queryKey: ["admin-status-bayar"],
    queryFn: fetchStatusBayar,
    retry: false,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const preferOrderId = order?.id_status_order ?? null;
  const preferPayId = order?.id_status_pembayaran ?? null;

  const statusOrderOptions = useMemo(
    () => normalizeStatusList(statusOrderRaw, preferOrderId),
    [statusOrderRaw, preferOrderId]
  );

  const statusBayarOptions = useMemo(
    () => normalizeStatusList(statusBayarRaw, preferPayId),
    [statusBayarRaw, preferPayId]
  );

  const [statusOrderId, setStatusOrderId] = useState<string>("");
  const [statusBayarId, setStatusBayarId] = useState<string>("");

  const [touchedOrder, setTouchedOrder] = useState(false);
  const [touchedPay, setTouchedPay] = useState(false);

  useEffect(() => {
    if (!order) return;

    const curOrderId = order.id_status_order != null ? String(order.id_status_order) : "";
    const curPayId = order.id_status_pembayaran != null ? String(order.id_status_pembayaran) : "";

    if (!touchedOrder && !statusOrderId) setStatusOrderId(curOrderId);
    if (!touchedPay && !statusBayarId) setStatusBayarId(curPayId);
  }, [order, touchedOrder, touchedPay, statusOrderId, statusBayarId]);

  useEffect(() => {
    if (!order) return;

    if (statusOrderId && statusOrderOptions.length && !statusOrderOptions.some((o) => String(o.id) === statusOrderId)) {
      const fallback = order.id_status_order != null ? String(order.id_status_order) : "";
      setStatusOrderId(fallback);
    }

    if (statusBayarId && statusBayarOptions.length && !statusBayarOptions.some((o) => String(o.id) === statusBayarId)) {
      const fallback = order.id_status_pembayaran != null ? String(order.id_status_pembayaran) : "";
      setStatusBayarId(fallback);
    }
  }, [order, statusOrderId, statusBayarId, statusOrderOptions, statusBayarOptions]);

  const mut = useMutation({
    mutationFn: async () => {
      if (!order) throw new Error("Order belum termuat.");

      const finalOrderIdStr =
        statusOrderId || (order.id_status_order != null ? String(order.id_status_order) : "");
      const finalPayIdStr =
        statusBayarId || (order.id_status_pembayaran != null ? String(order.id_status_pembayaran) : "");

      const idOrderNum = Number(finalOrderIdStr);
      const idPayNum = Number(finalPayIdStr);

      if (!Number.isFinite(idOrderNum) || idOrderNum <= 0) {
        throw new Error("Master status order tidak valid (id_status_order tidak terbaca).");
      }

      const payload: any = { id_status_order: idOrderNum };
      if (Number.isFinite(idPayNum) && idPayNum > 0) payload.id_status_pembayaran = idPayNum;

      return await patchOrderStatus(id, payload);
    },
    onMutate: () => toast({ variant: "info", title: "Menyimpan", message: "Mengupdate status..." }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin-order", id] });
      await qc.invalidateQueries({ queryKey: ["admin-orders"] });
      toast({ variant: "success", title: "Berhasil", message: "Status berhasil diupdate." });
    },
    onError: (e: any) => {
      const msg = pickFastApiDetail(e?.data) || (e instanceof Error ? e.message : "") || "Gagal update status";
      toast({ variant: "error", title: "Gagal", message: msg });
    },
  });

  const refreshAll = async () => {
    await Promise.all([refetchStatusOrder(), refetchStatusBayar()]);
    toast({ variant: "success", title: "OK", message: "Master status direfresh." });
  };

  const masterUnauthorized =
    (statusOrderError as any)?.status === 401 ||
    (statusBayarError as any)?.status === 401 ||
    (statusOrderError as any)?.status === 403 ||
    (statusBayarError as any)?.status === 403;

  return (
    <div>
      <Reveal>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black">Admin • Order Detail</h1>
            <p className="text-white/60 mt-1">Lihat item & ubah status order.</p>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={refreshAll}>
              Refresh
            </Button>
            <Button variant="secondary" onClick={() => router.push("/admin/orders")}>
              ← Kembali
            </Button>
          </div>
        </div>
      </Reveal>

      {isLoading ? (
        <div className="mt-6 grid gap-3">
          <Card className="animate-pulse">
            <div className="h-4 bg-white/5 rounded w-56" />
            <div className="h-3 bg-white/5 rounded w-80 mt-3" />
          </Card>
        </div>
      ) : isError ? (
        <div className="mt-6">
          <Card className="border border-rose-500/30 bg-rose-500/5">
            <div className="font-semibold text-rose-200">Gagal memuat detail</div>
            <div className="text-sm text-white/60 mt-1">{(error as Error)?.message}</div>
          </Card>
        </div>
      ) : !order ? null : (
        <div className="mt-6 grid gap-4">
          <Card>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <div className="text-sm text-white/60">Kode Order</div>
                <div className="text-xl font-extrabold">{order.kode_order}</div>
                <div className="text-sm text-white/60 mt-1">Dibuat: {fmtDateTime(order.created_at ?? null)}</div>
              </div>

              <div className="md:text-right">
                <div className="text-sm text-white/60">Total</div>
                <div className="text-xl font-extrabold text-indigo-200">
                  {formatRupiah(Number(order.total_harga || 0))}
                </div>
                <div className="text-xs text-white/50 mt-1">
                  Status Order: {order.status_order?.nama_status || "—"}
                  <span className="mx-2 text-white/30">•</span>
                  Pembayaran: {order.status_pembayaran?.nama_status || "—"}
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <div className="font-semibold">Update Status</div>
            <div className="text-xs text-white/50 mt-1">Dropdown otomatis dari endpoint master status.</div>

            {masterUnauthorized ? (
              <div className="mt-3 text-xs text-amber-200">
                Master status gagal dimuat (401/403). Login admin kamu mungkin expired.
              </div>
            ) : null}

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-xs text-white/60">Status Order</label>
                <select
                  value={statusOrderId}
                  onChange={(e) => {
                    setTouchedOrder(true);
                    setStatusOrderId(e.target.value);
                  }}
                  disabled={fetchingStatusOrder || statusOrderOptions.length === 0}
                  className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500/40"
                >
                  <option value="" className="bg-slate-900">
                    (Biarkan)
                  </option>
                  {statusOrderOptions.map((s) => (
                    <option key={s.id} value={String(s.id)} className="bg-slate-900">
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-white/60">Status Pembayaran</label>
                <select
                  value={statusBayarId}
                  onChange={(e) => {
                    setTouchedPay(true);
                    setStatusBayarId(e.target.value);
                  }}
                  disabled={fetchingStatusBayar || statusBayarOptions.length === 0}
                  className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500/40"
                >
                  <option value="" className="bg-slate-900">
                    (Biarkan)
                  </option>
                  {statusBayarOptions.map((s) => (
                    <option key={s.id} value={String(s.id)} className="bg-slate-900">
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4">
              <Button className="w-full md:w-auto" onClick={() => mut.mutate()} disabled={mut.isPending}>
                {mut.isPending ? "Menyimpan..." : "Simpan Status"}
              </Button>
            </div>
          </Card>

          <Card>
            <div className="font-semibold">Item Pesanan</div>
            <div className="mt-3 divide-y divide-white/10">
              {(order.order_item || []).length === 0 ? (
                <div className="text-sm text-white/60 py-3">Item tidak ditemukan.</div>
              ) : (
                order.order_item!.map((it: any) => {
                  const key = String(it?.id_order_item ?? it?.id ?? `${it?.id_buku}-${it?.jumlah}-${it?.subtotal}`);
                  return (
                    <div key={key} className="py-3 flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="font-medium">
                          {it?.buku?.judul ? it.buku.judul : `Buku ID: ${it.id_buku}`}
                        </div>
                        <div className="text-xs text-white/60 mt-1">
                          Qty: {it.jumlah}
                          <span className="mx-2 text-white/30">•</span>
                          Harga: {formatRupiah(Number(it.harga_satuan || 0))}
                        </div>
                      </div>
                      <div className="font-semibold text-white/80">{formatRupiah(Number(it.subtotal || 0))}</div>
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
