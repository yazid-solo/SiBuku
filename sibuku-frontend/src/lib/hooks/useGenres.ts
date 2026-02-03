/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/lib/web/fetchJson";

type Genre = {
  id_genre?: number;
  id?: number;
  nama_genre?: string;
  nama?: string;
  name?: string;
};

function normalizeArrayAny(x: any): any[] {
  if (Array.isArray(x)) return x;
  if (x && Array.isArray(x.data)) return x.data;
  if (x?.data?.data && Array.isArray(x.data.data)) return x.data.data;
  if (x?.results && Array.isArray(x.results)) return x.results;
  return [];
}

function pickGenreLabel(g: any): string {
  return String(g?.nama_genre ?? g?.nama ?? g?.name ?? "").trim();
}
function pickGenreId(g: any): number | null {
  const n = Number(g?.id_genre ?? g?.id ?? NaN);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function useGenres() {
  return useQuery({
    queryKey: ["genres"],
    queryFn: async () => {
      const raw = await fetchJson<any>("/api/genres");
      const arr = normalizeArrayAny(raw);
      return arr
        .map((g: Genre) => ({
          id: pickGenreId(g),
          label: pickGenreLabel(g),
        }))
        .filter((g: any) => g.id && g.label);
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
