import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  const res = NextResponse.json({ ok: true });

  res.cookies.set("sibuku_onboarded_intro", "1", {
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 tahun
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return res;
}