import { NextResponse } from "next/server";
import { API_BASE_URL } from "@/lib/env";

export const dynamic = "force-dynamic";

function safeJson(text: string) {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const formData = await req.formData();

  const headers: Record<string, string> = { Accept: "application/json" };

  const cookie = req.headers.get("cookie");
  if (cookie) headers["cookie"] = cookie;

  const auth = req.headers.get("authorization");
  if (auth) headers["authorization"] = auth;

  const res = await fetch(`${API_BASE_URL}/users/profile/avatar`, {
    method: "POST",
    headers,
    body: formData, // jangan set Content-Type manual
  });

  const text = await res.text();
  const data = safeJson(text);

  if (!res.ok) {
    return NextResponse.json({ detail: data?.detail ?? data ?? "Upload avatar gagal" }, { status: res.status });
  }

  return NextResponse.json(data ?? { message: "OK" }, { status: res.status });
}

export async function DELETE(req: Request) {
  const headers: Record<string, string> = { Accept: "application/json" };

  const cookie = req.headers.get("cookie");
  if (cookie) headers["cookie"] = cookie;

  const auth = req.headers.get("authorization");
  if (auth) headers["authorization"] = auth;

  const res = await fetch(`${API_BASE_URL}/users/profile/avatar`, {
    method: "DELETE",
    headers,
  });

  const text = await res.text();
  const data = safeJson(text);

  if (!res.ok) {
    return NextResponse.json({ detail: data?.detail ?? data ?? "Hapus avatar gagal" }, { status: res.status });
  }

  return NextResponse.json(data ?? { message: "OK" }, { status: res.status });
}