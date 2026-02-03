/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchJson, HttpErr } from "@/lib/web/fetchJson";

export type Me = {
  id_user?: number;
  email?: string;
  nama?: string;
  role?: string; // "user" | "seller" | "admin" (tergantung backend kamu)
  is_admin?: boolean;
};

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      try {
        return await fetchJson<Me>("/api/me");
      } catch (e: any) {
        const status = (e as HttpErr)?.status;
        // kalau belum login, jangan bikin UI error—cukup null
        if (status === 401 || status === 403) return null;
        throw e;
      }
    },
    staleTime: 20_000,
    refetchOnWindowFocus: false,
  });
}
