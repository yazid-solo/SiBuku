// src/app/api/admin/authors/[id]/photo/route.ts
import { NextResponse } from "next/server";
import { API_BASE_URL, TOKEN_COOKIE } from "@/lib/env";

function getTokenFromCookie(req: Request) {
  const cookie = req.headers.get("cookie") || "";
  const m = cookie.match(new RegExp(`${TOKEN_COOKIE}=([^;]+)`));
  return m?.[1] ? decodeURIComponent(m[1]) : null;
}

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text || null;
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params; // ✅ penting (params itu Promise di Next kamu)
  const token = getTokenFromCookie(req);

  if (!token) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();

  const res = await fetch(`${API_BASE_URL}/admin/authors/${id}/photo`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      // ❗ jangan set Content-Type saat FormData (biar boundary otomatis)
      Accept: "application/json",
    },
    body: formData,
    cache: "no-store",
  });

  const data = await safeJson(res);
  return NextResponse.json(data, { status: res.status });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params; // ✅ penting
  const token = getTokenFromCookie(req);

  if (!token) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const res = await fetch(`${API_BASE_URL}/admin/authors/${id}/photo`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const data = await safeJson(res);
  return NextResponse.json(data, { status: res.status });
}
