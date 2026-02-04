/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/env";

export const runtime = "nodejs"; // pastikan jalan di Node, bukan Edge

function safeJson(text: string) {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    if (!API_BASE_URL) {
      return NextResponse.json(
        { detail: "API_BASE_URL belum diset di Environment Variables (Vercel)." },
        { status: 500 }
      );
    }

    // Biar aman kalau API_BASE_URL ada/tidak ada trailing slash
    const url = new URL("/auth/register", API_BASE_URL).toString();

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const text = await res.text();
    const data = safeJson(text);

    if (!res.ok) {
      const detail = data?.detail ?? data ?? text ?? "Register gagal";
      return NextResponse.json({ detail }, { status: res.status });
    }

    return NextResponse.json(
      data ?? { message: "Registrasi berhasil" },
      { status: res.status }
    );
  } catch (err: any) {
    return NextResponse.json(
      { detail: err?.message ?? "Internal Server Error di /api/auth/register" },
      { status: 500 }
    );
  }
}