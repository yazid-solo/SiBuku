// src/app/api/auth/logout/route.ts
import { NextResponse } from "next/server";
import { TOKEN_COOKIE } from "@/lib/env";

export async function POST() {
  const res = NextResponse.json({ ok: true });

  // Hapus cookie token (HttpOnly) -> logout sukses
  res.cookies.set({
    name: TOKEN_COOKIE,       // "sibuku_token"
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,                // penting: expire sekarang
  });

  return res;
}
