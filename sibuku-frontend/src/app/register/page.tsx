"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import Card from "@/components/ui/card";
import Input from "@/components/ui/input";
import Button from "@/components/ui/button";
import Reveal from "@/components/ui/reveal";

const schema = z.object({
  nama: z.string().min(2, "Nama minimal 2 karakter"),
  email: z.string().email("Email tidak valid"),
  password: z.string().min(4, "Password minimal 4 karakter"),
  no_hp: z.string().optional(),
  alamat: z.string().optional(),
});

type Form = z.infer<typeof schema>;

export default function RegisterPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverOk, setServerOk] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { isSubmitting, errors },
  } = useForm<Form>({
    resolver: zodResolver(schema),
    mode: "onTouched",
  });

  async function onSubmit(values: Form) {
    setServerError(null);
    setServerOk(null);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setServerError(data?.detail || "Register gagal");
      return;
    }

    setServerOk("Registrasi berhasil ✅ Silakan login.");
    setTimeout(() => router.push("/login"), 700);
  }

  return (
    <div className="container py-12 max-w-lg">
      <Reveal>
        <Card>
          <h1 className="text-2xl font-black">Daftar SiBuku</h1>
          <p className="text-white/60 text-sm mt-1">Buat akun untuk mulai belanja.</p>

          {serverError && (
            <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {serverError}
            </div>
          )}

          {serverOk && (
            <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
              {serverOk}
            </div>
          )}

          <form className="mt-6 space-y-3" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <Input placeholder="Nama" {...register("nama")} />
              {errors.nama && <p className="mt-1 text-xs text-rose-300">{errors.nama.message}</p>}
            </div>

            <div>
              <Input type="email" placeholder="Email" {...register("email")} />
              {errors.email && <p className="mt-1 text-xs text-rose-300">{errors.email.message}</p>}
            </div>

            <div>
              <Input type="password" placeholder="Password" {...register("password")} />
              {errors.password && <p className="mt-1 text-xs text-rose-300">{errors.password.message}</p>}
            </div>

            <Input placeholder="No HP (opsional)" {...register("no_hp")} />
            <Input placeholder="Alamat (opsional)" {...register("alamat")} />

            <Button className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Memproses..." : "Daftar"}
            </Button>
          </form>

          <div className="text-sm text-white/60 mt-4">
            Sudah punya akun?{" "}
            <Link href="/login" className="text-indigo-300 hover:text-indigo-200">
              Login
            </Link>
          </div>
        </Card>
      </Reveal>
    </div>
  );
}
