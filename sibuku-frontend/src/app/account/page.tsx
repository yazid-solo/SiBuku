/* eslint-disable react-hooks/set-state-in-effect */
"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LayoutDashboard, Store, User2 } from "lucide-react";

import Card from "@/components/ui/card";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import Reveal from "@/components/ui/reveal";
import { useToast } from "@/components/ui/toast";

type Profile = {
  id_user: number;
  nama: string;
  email: string;
  role?: string;
  is_admin?: boolean;
  no_hp?: string | null;
  alamat?: string | null;
};

type HttpError = Error & { status?: number; data?: any };

function normalizeProfile(x: any): Profile | null {
  if (!x) return null;
  if (x?.email && x?.nama) return x as Profile;
  if (x?.data?.email && x?.data?.nama) return x.data as Profile;
  return null;
}

function pickRole(p?: Profile | null) {
  const raw = String(p?.role ?? "").toLowerCase().trim();
  if (p?.is_admin === true) return "admin";
  if (raw === "admin" || raw === "superadmin") return "admin";
  return raw || "customer";
}

async function fetchJson<T = any>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    cache: "no-store",
    credentials: "include",
    ...init,
  });

  // aman untuk response kosong
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text || null;
  }

  if (!res.ok) {
    const err = new Error(
      data?.detail || data?.message || (typeof data === "string" ? data : "") || `Request gagal (${res.status})`
    ) as HttpError;
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data as T;
}

async function fetchProfile(): Promise<Profile> {
  const data = await fetchJson("/api/users/profile");
  const p = normalizeProfile(data);
  if (!p) throw new Error("Format data profile tidak sesuai");
  return p;
}

async function patchProfile(payload: Partial<Profile>) {
  return fetchJson("/api/users/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

// role switch: customer <-> admin (mode jual)
async function patchRole(role: "customer" | "admin") {
  return fetchJson("/api/users/role", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  });
}

function RolePill({ role }: { role: string }) {
  const isAdmin = role === "admin";
  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs ring-1",
        isAdmin
          ? "bg-indigo-500/15 text-indigo-200 ring-indigo-500/30"
          : "bg-white/5 text-white/70 ring-white/10",
      ].join(" ")}
    >
      {isAdmin ? "Admin / Penjual" : "User / Pembeli"}
    </span>
  );
}

export default function AccountPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useToast();

  const {
    data: profile,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["profile"],
    queryFn: fetchProfile,
    retry: false,
    staleTime: 20_000,
    refetchOnWindowFocus: false,
  });

  const role = useMemo(() => pickRole(profile), [profile]);
  const isAdmin = role === "admin";

  const [nama, setNama] = useState("");
  const [noHp, setNoHp] = useState("");
  const [alamat, setAlamat] = useState("");

  // Prefill dari server
  useEffect(() => {
    if (!profile) return;
    setNama(profile.nama || "");
    setNoHp(profile.no_hp || "");
    setAlamat(profile.alamat || "");
  }, [profile]);

  // Redirect kalau 401/403
  useEffect(() => {
    const s = (error as HttpError | undefined)?.status;
    if (s === 401 || s === 403) {
      router.replace(`/login?next=${encodeURIComponent("/account")}`);
    }
  }, [error, router]);

  const dirty = useMemo(() => {
    if (!profile) return false;
    const n0 = profile.nama ?? "";
    const hp0 = profile.no_hp ?? "";
    const a0 = profile.alamat ?? "";
    return nama !== n0 || noHp !== hp0 || alamat !== a0;
  }, [profile, nama, noHp, alamat]);

  const canSave = useMemo(() => {
    if (!profile) return false;
    if (!dirty) return false;
    if (nama.trim().length < 2) return false;
    const hpOk = noHp.trim().length === 0 || noHp.trim().length >= 8;
    const alOk = alamat.trim().length === 0 || alamat.trim().length >= 8;
    return hpOk && alOk;
  }, [profile, dirty, nama, noHp, alamat]);

  const mutProfile = useMutation({
    mutationFn: () =>
      patchProfile({
        nama: nama.trim(),
        no_hp: noHp.trim() || null,
        alamat: alamat.trim() || null,
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["profile"] });
      await qc.invalidateQueries({ queryKey: ["me"] });
      toast({ variant: "success", title: "Tersimpan", message: "Profil berhasil diupdate." });
    },
    onError: (e: any) => {
      const s = e?.status as number | undefined;
      if (s === 401 || s === 403) {
        router.replace(`/login?next=${encodeURIComponent("/account")}`);
        return;
      }
      toast({ variant: "error", title: "Gagal", message: e?.message || "Gagal update profil" });
    },
  });

  const mutRole = useMutation({
    mutationFn: (nextRole: "customer" | "admin") => patchRole(nextRole),
    onSuccess: async (_data, nextRole) => {
      await qc.invalidateQueries({ queryKey: ["profile"] });
      await qc.invalidateQueries({ queryKey: ["me"] });
      toast({
        variant: "success",
        title: "Role diupdate",
        message: nextRole === "admin" ? "Mode Jual/Admin aktif." : "Kembali ke Mode User/Pembeli.",
      });
    },
    onError: (e: any) => {
      toast({
        variant: "error",
        title: "Gagal ubah role",
        message: e?.message || "Pastikan endpoint /api/users/role sudah ada.",
      });
    },
  });

  function resetFormToServer() {
    if (!profile) return;
    setNama(profile.nama || "");
    setNoHp(profile.no_hp || "");
    setAlamat(profile.alamat || "");
  }

  return (
    <div className="container py-10">
      <Reveal>
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black">Akun Saya</h1>
            <p className="text-white/60 mt-1">Update profil untuk mempermudah checkout & pengiriman.</p>
          </div>

          <div className="hidden md:flex gap-2">
            <Link href="/orders">
              <Button variant="secondary">Pesanan</Button>
            </Link>
            <Link href="/cart">
              <Button variant="secondary">Keranjang</Button>
            </Link>
          </div>
        </div>
      </Reveal>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
        {/* LEFT */}
        <Card>
          {isLoading ? (
            <div className="animate-pulse">
              <div className="h-4 w-40 bg-white/5 rounded" />
              <div className="h-10 bg-white/5 rounded mt-4" />
              <div className="h-10 bg-white/5 rounded mt-3" />
              <div className="h-10 bg-white/5 rounded mt-3" />
            </div>
          ) : isError || !profile ? (
            <div>
              <div className="font-semibold text-rose-200">Tidak bisa memuat profil</div>
              <div className="text-sm text-white/60 mt-1">
                {(error as Error)?.message || "Pastikan kamu sudah login (token cookie tersimpan)."}
              </div>
              <div className="mt-4">
                <Link href="/login">
                  <Button>Login</Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid gap-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm text-white/60">Role</div>
                  <div className="mt-1">
                    <RolePill role={role} />
                  </div>
                </div>

                {/* quick action */}
                {isAdmin ? (
                  <Link href="/admin">
                    <Button variant="secondary" className="gap-2">
                      <LayoutDashboard size={16} />
                      Dashboard
                    </Button>
                  </Link>
                ) : null}
              </div>

              <div className="text-sm text-white/60 mt-2">Email (readonly)</div>
              <Input value={profile.email} readOnly />

              <div className="text-sm text-white/60 mt-2">Nama</div>
              <Input value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Nama lengkap" />

              <div className="text-sm text-white/60 mt-2">No HP</div>
              <Input value={noHp} onChange={(e) => setNoHp(e.target.value)} placeholder="08xxxxxxxxxx" />

              <div className="text-sm text-white/60 mt-2">Alamat</div>
              <Input value={alamat} onChange={(e) => setAlamat(e.target.value)} placeholder="Alamat pengiriman" />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3">
                <Button
                  className="w-full"
                  disabled={mutProfile.isPending || !canSave}
                  onClick={() => mutProfile.mutate()}
                >
                  {mutProfile.isPending ? "Menyimpan..." : "Simpan Perubahan"}
                </Button>

                <Button
                  variant="secondary"
                  className="w-full"
                  disabled={mutProfile.isPending || !dirty}
                  onClick={resetFormToServer}
                >
                  Batalkan
                </Button>
              </div>

              <div className="text-xs text-white/50 mt-2">
                Minimal: nama ≥ 2 • no hp/alamat opsional tapi disarankan untuk checkout cepat.
              </div>
            </div>
          )}
        </Card>

        {/* RIGHT */}
        <Card>
          <div className="font-semibold">Mode & Shortcut</div>

          <div className="mt-3 grid gap-2">
            {/* mode switch ecommerce */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="text-sm font-semibold flex items-center gap-2">
                {isAdmin ? <Store size={16} /> : <User2 size={16} />}
                {isAdmin ? "Mode Jual (Admin)" : "Mode Belanja (User)"}
              </div>
              <div className="text-xs text-white/60 mt-1">
                {isAdmin
                  ? "Kamu bisa jual/kelola buku di dashboard. Kamu tetap bisa belanja seperti user."
                  : "Aktifkan Mode Jual kalau ingin mengelola & menjual buku."}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {!isAdmin ? (
                  <Button
                    className="gap-2"
                    disabled={mutRole.isPending || isLoading || !profile}
                    onClick={() => mutRole.mutate("admin")}
                  >
                    <Store size={16} />
                    Aktifkan Mode Jual
                  </Button>
                ) : (
                  <>
                    <Link href="/admin">
                      <Button variant="secondary" className="gap-2">
                        <LayoutDashboard size={16} />
                        Buka Dashboard
                      </Button>
                    </Link>

                    {/* opsional: turunkan role (kalau kamu memang mau) */}
                    <Button
                      variant="ghost"
                      className="gap-2 text-white/70"
                      disabled={mutRole.isPending || isLoading || !profile}
                      onClick={() => {
                        const ok = window.confirm("Kembalikan akun jadi User/Pembeli?\n\nCatatan: kamu akan kehilangan akses admin.");
                        if (ok) mutRole.mutate("customer");
                      }}
                      title="Opsional (demo)"
                    >
                      <User2 size={16} />
                      Jadikan User
                    </Button>
                  </>
                )}
              </div>
            </div>

            <Link href="/cart">
              <Button variant="secondary" className="w-full">Ke Keranjang</Button>
            </Link>
            <Link href="/books">
              <Button variant="secondary" className="w-full">Belanja Lagi</Button>
            </Link>
            <Link href="/orders">
              <Button className="w-full">Riwayat Pesanan</Button>
            </Link>
          </div>

          <div className="text-xs text-white/50 mt-4">
            Profil + alamat akan dipakai untuk pengalaman checkout yang lebih cepat.
          </div>
        </Card>
      </div>
    </div>
  );
}
