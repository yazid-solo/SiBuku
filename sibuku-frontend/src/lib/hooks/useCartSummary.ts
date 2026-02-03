/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchJson, HttpErr } from "@/lib/web/fetchJson";

export type CartSummary = {
  total_qty?: number;
  total_price?: number;
};

function normalizeSummary(raw: any): CartSummary {
  // dukung beberapa bentuk response
  if (!raw) return { total_qty: 0, total_price: 0 };
  if (typeof raw === "object" && raw.summary) return raw.summary;
  if (typeof raw === "object" && raw.data?.summary) return raw.data.summary;
  return raw as CartSummary;
}

export function useCartSummary() {
  return useQuery({
    queryKey: ["cart-summary"],
    queryFn: async () => {
      try {
        const data = await fetchJson<any>("/api/cart/summary");
        return normalizeSummary(data);
      } catch (e: any) {
        const status = (e as HttpErr)?.status;
        if (status === 401 || status === 403) return { total_qty: 0, total_price: 0 };
        // fallback: kalau endpoint summary belum ada/bermasalah, jangan bikin header crash
        return { total_qty: 0, total_price: 0 };
      }
    },
    staleTime: 3_000,
    refetchOnWindowFocus: false,
  });
}
