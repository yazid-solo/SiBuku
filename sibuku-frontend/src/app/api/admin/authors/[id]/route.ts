// src/app/api/admin/authors/[id]/route.ts
import { NextResponse } from "next/server";
import { API_BASE_URL, TOKEN_COOKIE } from "@/lib/env";

export const dynamic = "force-dynamic";

function safeJson(text: string) {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

function getTokenFromCookieHeader(cookieHeader: string) {
  const m = cookieHeader.match(new RegExp(`${TOKEN_COOKIE}=([^;]+)`));
  return m?.[1] ? decodeURIComponent(m[1]) : null;
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const cookie = req.headers.get("cookie") || "";
  const token = getTokenFromCookieHeader(cookie);

  if (!token) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  // ✅ sesuai Swagger: DELETE /authors/{author_id}
  const res = await fetch(`${API_BASE_URL}/authors/${id}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const text = await res.text();
  const data = safeJson(text);

  // kalau backend balikin kosong, tetap kirim ok:true
  if (!res.ok) {
    return NextResponse.json(data ?? { detail: res.statusText }, { status: res.status });
  }

  return NextResponse.json(data ?? { ok: true });
}
