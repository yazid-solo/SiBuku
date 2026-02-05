/* eslint-disable react-hooks/set-state-in-effect */
"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPin, Phone, User2, CheckCircle2 } from "lucide-react";

import Card from "@/components/ui/card";
import Button from "@/components/ui/button";
import Input from "@/components/ui/input";
import Reveal from "@/components/ui/reveal";
import { useToast } from "@/components/ui/toast";

type Profile = {
  id_user: number;
  nama: string;
  email: string;
  no_hp?: string | null;
  alamat?: string | null;
  avatar_url?: string | null; // opsional kalau sudah ada
};

type HttpError = Error & { status?: number; data?: any };

async function fetchJson<T = any>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", credentials: "include", ...init });

  if (res.status === 204) return null as T;

  const ct = res.headers.get("content-type") ?? "";
  const text = await res.text().catch(() => "");
  const data =
    ct.includes("application/json") && text
      ? (() => {
          try {
            return JSON.parse(text);
          } catch {
            return null;
          }
        })()
      : text || null;

  if (!res.ok) {
    const err = new Error(
      (data as any)?.detail ||
        (data as any)?.message ||
        (typeof data === "string" ? data : "") ||
        `Request gagal (${res.status})`
    ) as HttpError;
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data as T;
}

function normalizePhoneInput(v: string) {
  const raw = String(v ?? "");
  const cleaned = raw.replace(/[^\d+]/g, "");
  if (cleaned.startsWith("+62")) return "0" + cleaned.slice(3);
  if (cleaned.startsWith("62")) return "0" + cleaned.slice(2);
  return cleaned;
}

function isProfileComplete(p?: Profile | null) {
  if (!p) return false;
  const namaOk = String(p.nama ?? "").trim().length >= 2;
  const alamatOk = String(p.alamat ?? "").trim().length >= 8;
  return namaOk && alamatOk;
}

export default function OnboardingProfilePage() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next") || "/";
  const reduceMotion = useReducedMotion();
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: profile, isLoading, isError, error } = useQuery({
    queryKey: ["profile"],
    queryFn: () => fetchJson<Profile>("/api/users/profile"),
    retry: false,
    staleTime: 10_000,
    refetchOnWindowFocus: false,
  });

  // kalau belum login -> ke login
  useEffect(() => {
    const s = (error as HttpError | undefined)?.status;
    if (s === 401 || s === 403) {
      router.replace(`/login?next=${encodeURIComponent("/onboarding/profile?next=" + next)}`);
    }
  }, [error, router, next]);

  // kalau sudah lengkap -> langsung lanjut
  useEffect(() => {
    if (profile && isProfileComplete(profile)) {
      router.replace(next);
      router.refresh();
    }
  }, [profile, router, next]);

  const [step, setStep] = useState<0 | 1>(0);
  const [dir, setDir] = useState<1 | -1>(1);

  const [nama, setNama] = useState("");
  const [noHp, setNoHp] = useState("");
  const [alamat, setAlamat] = useState("");

  // prefill aman
  useEffect(() => {
    if (!profile) return;
    setNama((prev) => (prev.trim() ? prev : profile.nama || ""));
    setNoHp((prev) => (prev.trim() ? prev : profile.no_hp || ""));
    setAlamat((prev) => (prev.trim() ? prev : profile.alamat || ""));
  }, [profile]);

  const inputNama = nama.trim();
  const inputHp = noHp.trim();
  const inputAlamat = alamat.trim();

  const namaErr = useMemo(() => {
    if (!inputNama) return "Nama wajib diisi.";
    if (inputNama.length < 2) return "Nama minimal 2 karakter.";
    return "";
  }, [inputNama]);

  const hpErr = useMemo(() => {
    if (!inputHp) return ""; // optional
    if (inputHp.length < 8) return "No HP minimal 8 digit.";
    if (!/^0\d{7,15}$/.test(inputHp.replace(/\s+/g, ""))) return "Format No HP tidak valid (contoh: 08xxxxxxxxxx).";
    return "";
  }, [inputHp]);

  const alamatErr = useMemo(() => {
    if (!inputAlamat) return "Alamat disarankan diisi agar checkout otomatis.";
    if (inputAlamat.length < 8) return "Alamat minimal 8 karakter.";
    return "";
  }, [inputAlamat]);

  const canSubmitStep1 = useMemo(() => {
    if (namaErr) return false;
    if (hpErr) return false;
    if (alamatErr) return false;
    return true;
  }, [namaErr, hpErr, alamatErr]);

  const patchMut = useMutation({
    mutationFn: () =>
      fetchJson("/api/users/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nama: inputNama,
          no_hp: inputHp || null,
          alamat: inputAlamat || null,
        }),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["profile"] });
      toast({ variant: "success", title: "Tersimpan", message: "Profil kamu sudah diperbarui." });
    },
    onError: (e: any) => {
      const s = (e as HttpError | undefined)?.status;
      if (s === 401 || s === 403) {
        router.replace(`/login?next=${encodeURIComponent("/onboarding/profile?next=" + next)}`);
        return;
      }
      toast({ variant: "error", title: "Gagal", message: e?.message || "Gagal update profil" });
    },
  });

  // --- Step 2: foto (opsional). Akan graceful kalau endpoint belum ada.
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const revokeRef = useRef<string>("");

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);

    // cleanup
    if (revokeRef.current) URL.revokeObjectURL(revokeRef.current);
    revokeRef.current = url;

    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [file]);

  const uploadMut = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Pilih foto dulu.");
      const fd = new FormData();
      fd.append("file", file);

      // ✅ endpoint ini bisa kamu bikin / sudah kamu punya
      return await fetchJson("/api/users/avatar", { method: "POST", body: fd });
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["profile"] });
      toast({ variant: "success", title: "Berhasil", message: "Foto profil berhasil diupload." });
    },
    onError: (e: any) => {
      toast({
        variant: "error",
        title: "Upload gagal",
        message: e?.message || "Pastikan endpoint upload avatar tersedia.",
      });
    },
  });

  function goNext() {
    setDir(1);
    setStep((s) => (s === 0 ? 1 : 1));
  }
  function goPrev() {
    setDir(-1);
    setStep((s) => (s === 1 ? 0 : 0));
  }

  async function finish() {
    // pastikan step1 tersimpan
    if (!isProfileComplete({ ...(profile as any), nama: inputNama, alamat: inputAlamat })) {
      toast({ variant: "info", title: "Lengkapi dulu", message: "Nama & alamat minimal harus diisi." });
      setStep(0);
      return;
    }
    router.replace(next);
    router.refresh();
  }

  const variants = {
    enter: (d: number) => ({
      opacity: 0,
      x: reduceMotion ? 0 : d * 26,
      y: reduceMotion ? 0 : 2,
      filter: "blur(2px)",
    }),
    center: { opacity: 1, x: 0, y: 0, filter: "blur(0px)" },
    exit: (d: number) => ({
      opacity: 0,
      x: reduceMotion ? 0 : d * -26,
      y: reduceMotion ? 0 : -2,
      filter: "blur(2px)",
    }),
  };

  const progress = step === 0 ? 50 : 100;

  return (
    <div className="container py-12">
      <Reveal>
        <div className="max-w-2xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-black">Lengkapi Profil</h1>
            <p className="text-white/60 mt-1">
              Biar checkout kamu otomatis dan terasa menyenangkan.
            </p>
          </div>

          <Card className="relative overflow-hidden">
            <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-indigo-500/15 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-sky-500/10 blur-3xl" />

            <div className="relative">
              <div className="flex items-center justify-between gap-3">
                <div className="text-xs text-white/50">Langkah {step + 1} / 2</div>

                <button
                  className="text-xs text-white/60 hover:text-white transition"
                  type="button"
                  onClick={() => router.replace(next)}
                >
                  Skip →
                </button>
              </div>

              <div className="mt-3 h-2 w-full rounded-full bg-white/10 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-400/80 to-sky-300/80"
                  initial={false}
                  animate={{ width: `${progress}%` }}
                  transition={{ type: "spring", stiffness: 120, damping: 20 }}
                />
              </div>
              <div className="mt-1 text-[11px] text-white/45">{progress}%</div>

              {isLoading ? (
                <div className="mt-5 grid gap-3 animate-pulse">
                  <div className="h-10 rounded bg-white/5" />
                  <div className="h-10 rounded bg-white/5" />
                  <div className="h-24 rounded bg-white/5" />
                </div>
              ) : isError ? (
                <div className="mt-5">
                  <div className="font-semibold text-rose-200">Gagal memuat profil</div>
                  <div className="text-sm text-white/60 mt-1">{(error as Error)?.message}</div>
                  <div className="mt-4">
                    <Link href="/login">
                      <Button>Login</Button>
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="mt-5">
                  <AnimatePresence mode="wait" custom={dir}>
                    {step === 0 ? (
                      <motion.div
                        key="step-1"
                        custom={dir}
                        variants={variants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ duration: reduceMotion ? 0 : 0.22, ease: "easeOut" }}
                        className="grid gap-3"
                      >
                        <div className="text-lg font-extrabold flex items-center gap-2">
                          <User2 size={18} /> Data Pengiriman
                        </div>
                        <div className="text-sm text-white/70">
                          Nama & alamat akan dipakai otomatis di checkout.
                        </div>

                        <div className="text-sm text-white/60 mt-2">Nama</div>
                        <Input value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Nama lengkap" />
                        {namaErr ? <div className="text-xs text-rose-200 -mt-1">{namaErr}</div> : null}

                        <div className="text-sm text-white/60 mt-2 flex items-center gap-2">
                          <Phone size={16} /> No HP (opsional, disarankan)
                        </div>
                        <Input
                          value={noHp}
                          onChange={(e) => setNoHp(normalizePhoneInput(e.target.value))}
                          placeholder="08xxxxxxxxxx"
                          inputMode="numeric"
                        />
                        {hpErr ? <div className="text-xs text-rose-200 -mt-1">{hpErr}</div> : null}

                        <div className="text-sm text-white/60 mt-2 flex items-center gap-2">
                          <MapPin size={16} /> Alamat
                        </div>
                        <textarea
                          value={alamat}
                          onChange={(e) => setAlamat(e.target.value)}
                          placeholder="Jalan, nomor, RT/RW, kecamatan, kota"
                          className="w-full min-h-[96px] rounded-xl bg-white/5 border border-white/10 px-4 py-2 text-sm text-white/80 outline-none focus:ring-2 focus:ring-indigo-500/40"
                        />
                        {alamatErr ? <div className="text-xs text-rose-200 -mt-1">{alamatErr}</div> : null}

                        <div className="mt-4 flex gap-2">
                          <Button
                            className="flex-1"
                            disabled={!canSubmitStep1 || patchMut.isPending}
                            onClick={async () => {
                              await patchMut.mutateAsync();
                              goNext();
                            }}
                          >
                            {patchMut.isPending ? "Menyimpan..." : "Simpan & Lanjut"}
                          </Button>
                        </div>

                        <div className="text-[11px] text-white/50">
                          *Nama + alamat minimal agar checkout tidak error.
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="step-2"
                        custom={dir}
                        variants={variants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ duration: reduceMotion ? 0 : 0.22, ease: "easeOut" }}
                        className="grid gap-3"
                      >
                        <div className="text-lg font-extrabold flex items-center gap-2">
                          <CheckCircle2 size={18} /> Foto Profil (Opsional)
                        </div>
                        <div className="text-sm text-white/70">
                          Biar akun terlihat profesional. Kalau belum mau, bisa skip.
                        </div>

                        <div className="mt-2 grid gap-3">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => setFile(e.target.files?.[0] || null)}
                            className="text-sm text-white/70"
                          />

                          {preview ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={preview}
                              alt="Preview"
                              className="h-28 w-28 rounded-2xl object-cover border border-white/10 bg-white/5"
                            />
                          ) : (
                            <div className="h-28 w-28 rounded-2xl border border-white/10 bg-white/5 grid place-items-center text-xs text-white/40">
                              Preview
                            </div>
                          )}

                          <div className="flex gap-2">
                            <Button variant="secondary" onClick={goPrev}>
                              Kembali
                            </Button>

                            <Button
                              className="flex-1"
                              disabled={!file || uploadMut.isPending}
                              onClick={async () => {
                                if (!file) return;
                                await uploadMut.mutateAsync();
                              }}
                            >
                              {uploadMut.isPending ? "Uploading..." : "Upload Foto"}
                            </Button>
                          </div>

                          <Button variant="ghost" className="w-full" onClick={finish}>
                            Selesai
                          </Button>

                          <div className="text-[11px] text-white/50">
                            Catatan: tombol Upload <code className="text-white/70">.</code>.
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </Card>
        </div>
      </Reveal>
    </div>
  );
}