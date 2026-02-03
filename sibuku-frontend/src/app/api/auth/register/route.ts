import { NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/env";

function safeJson(text: string) {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const body = await req.json();

  const res = await fetch(`${API_BASE_URL}/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  const data = safeJson(text);

  if (!res.ok) {
    const detail = data?.detail ?? data ?? "Register gagal";
    return NextResponse.json({ detail }, { status: res.status });
  }

  return NextResponse.json(data ?? { message: "Registrasi berhasil" }, { status: res.status });
}
