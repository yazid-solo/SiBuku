/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import Card from "@/components/ui/card";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import Reveal from "@/components/ui/reveal";
import type { MeUser } from "@/lib/types";

function normalizeArray<T>(x: any): T[] {
  if (Array.isArray(x)) return x;
  if (x && Array.isArray(x.data)) return x.data;
  return [];
}

async function fetchUsers(q?: string): Promise<MeUser[]> {
  const qs = new URLSearchParams();
  if (q?.trim()) qs.set("q", q.trim());

  const res = await fetch(`/api/admin/users?${qs.toString()}`, { cache: "no-store" });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.detail || "Gagal memuat users");
  return normalizeArray<MeUser>(data);
}

async function toggleUser(id: number) {
  const res = await fetch(`/api/admin/users/${id}/toggle`, { method: "PATCH" });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.detail || "Gagal toggle user");
  return data;
}

export default function AdminUsersPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q), 350);
    return () => clearTimeout(t);
  }, [q]);

  const { data: users = [], isLoading, isError, error, isFetching } = useQuery({
    queryKey: ["admin-users", qDebounced],
    queryFn: () => fetchUsers(qDebounced || undefined),
    staleTime: 10_000,
  });

  const mut = useMutation({
    mutationFn: (id: number) => toggleUser(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: any) => alert(e.message),
  });

  const headerInfo = useMemo(() => `Total ${users.length}`, [users.length]);

  return (
    <div>
      <Reveal>
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black">Admin • Users</h1>
            <p className="text-white/60 mt-1">Kelola user & aktif/nonaktifkan akun.</p>
          </div>
          <div className="hidden md:flex items-center gap-2 text-xs text-white/50">
            {isFetching ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-indigo-400 animate-pulse" />
                Memuat...
              </span>
            ) : (
              <span>{headerInfo}</span>
            )}
          </div>
        </div>
      </Reveal>

      <div className="glass rounded-2xl p-4 mt-6 grid gap-3 md:grid-cols-[1fr_180px] items-center relative z-30">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama/email/role..." />
        <Button variant="secondary" onClick={() => setQ("")} className="w-full">
          Reset
        </Button>
      </div>

      <div className="mt-6 grid gap-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <div className="h-4 bg-white/5 rounded w-56" />
              <div className="h-3 bg-white/5 rounded w-80 mt-3" />
            </Card>
          ))
        ) : isError ? (
          <Card className="border border-rose-500/30 bg-rose-500/5">
            <div className="font-semibold text-rose-200">Gagal memuat users</div>
            <div className="text-sm text-white/60 mt-1">{(error as Error)?.message}</div>
          </Card>
        ) : users.length === 0 ? (
          <Card>
            <div className="font-semibold">User kosong</div>
            <div className="text-sm text-white/60 mt-1">Coba reset filter.</div>
          </Card>
        ) : (
          users.map((u) => (
            <Card key={u.id_user} className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="min-w-0">
                <div className="font-semibold">{u.nama}</div>
                <div className="text-sm text-white/60">{u.email}</div>
                <div className="text-xs text-white/50 mt-1">
                  Role: <span className="text-white/70">{u.role}</span>{" "}
                  <span className="mx-2 text-white/30">•</span>
                  ID: {u.id_user}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button variant="secondary" onClick={() => mut.mutate(u.id_user)} disabled={mut.isPending}>
                  Toggle Active
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
