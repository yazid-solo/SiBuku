"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import Card from "@/components/ui/card";
import Input from "@/components/ui/input";
import Button from "@/components/ui/button";
import Reveal from "@/components/ui/reveal";

const schema = z.object({
  email: z.string().email("Email tidak valid"),
  password: z.string().min(4, "Password minimal 4 karakter"),
});

type Form = z.infer<typeof schema>;

type LoginApiResponse =
  | { user?: unknown }
  | { detail?: string }
  | Record<string, unknown>;

export default function LoginPage() {
  const sp = useSearchParams();
  const router = useRouter();

  // kalau tidak ada ?next=..., balik ke home
  const nextUrl = sp.get("next") || "/";

  const {
    register,
    handleSubmit,
    setError,
    formState: { isSubmitting, errors },
  } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: Form) {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      const data: LoginApiResponse = await res.json().catch(() => ({} as Record<string, unknown>));

      if (!res.ok) {
        const detail =
          data && typeof data === "object" && "detail" in data
            ? (data as { detail?: unknown }).detail
            : undefined;
        const msg = typeof detail === "string" ? detail : "Login gagal. Periksa email/password.";
        setError("email", { message: msg });
        return;
      }

      // redirect yang halus
      router.replace(nextUrl);
      router.refresh();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError("email", { message: err.message || "Terjadi kesalahan jaringan" });
      } else {
        setError("email", { message: "Terjadi kesalahan jaringan" });
      }
    }
  }

  return (
    <div className="container py-12 max-w-lg">
      <Reveal>
        <Card>
          <h1 className="text-2xl font-black">Login SiBuku</h1>
          <p className="text-white/60 text-sm mt-1">
            Masuk untuk checkout & melihat riwayat pesanan.
          </p>

          <form className="mt-6 space-y-3" onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-1">
              <Input placeholder="Email" {...register("email")} />
              {errors.email?.message ? (
                <p className="text-sm text-red-300">{errors.email.message}</p>
              ) : null}
            </div>

            <div className="space-y-1">
              <Input type="password" placeholder="Password" {...register("password")} />
              {errors.password?.message ? (
                <p className="text-sm text-red-300">{errors.password.message}</p>
              ) : null}
            </div>

            <Button className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Memproses..." : "Login"}
            </Button>
          </form>

          <div className="text-sm text-white/60 mt-4">
            Belum punya akun?{" "}
            <Link href="/register" className="text-indigo-300 hover:text-indigo-200">
              Daftar
            </Link>
          </div>
        </Card>
      </Reveal>
    </div>
  );
}
