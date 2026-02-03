/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { env, TOKEN_COOKIE } from "@/lib/env";

export const dynamic = "force-dynamic";

function readCookieFromHeader(cookieHeader: string, name: string) {
  const parts = cookieHeader.split(";").map((p) => p.trim());
  for (const p of parts) {
    if (p.startsWith(name + "=")) return decodeURIComponent(p.slice(name.length + 1));
  }
  return null;
}

function safeParseJson(text: string) {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const bodyText = await req.text();
  const bodyJson = safeParseJson(bodyText);

  if (!bodyJson || typeof bodyJson !== "object") {
    return NextResponse.json({ detail: "Body harus JSON." }, { status: 400 });
  }

  // ✅ whitelist payload (biar backend aman & tidak error karena field tambahan)
  const clean: any = {};
  if (bodyJson.id_jenis_pembayaran != null) clean.id_jenis_pembayaran = Number(bodyJson.id_jenis_pembayaran);
  if (typeof bodyJson.alamat_pengiriman === "string") clean.alamat_pengiriman = bodyJson.alamat_pengiriman;
  if (typeof bodyJson.catatan === "string" && bodyJson.catatan.trim()) clean.catatan = bodyJson.catatan.trim();

  // validasi minimal
  if (!Number.isFinite(clean.id_jenis_pembayaran) || clean.id_jenis_pembayaran <= 0) {
    return NextResponse.json({ detail: "id_jenis_pembayaran tidak valid." }, { status: 400 });
  }
  if (!clean.alamat_pengiriman || String(clean.alamat_pengiriman).trim().length < 5) {
    return NextResponse.json({ detail: "alamat_pengiriman minimal 5 karakter." }, { status: 400 });
  }

  // ambil token dari cookie Next (paling aman)
  const c = await cookies();
  const tokenFromNext = c.get(TOKEN_COOKIE)?.value;

  // fallback: parse dari header cookie
  const tokenFromHeader = readCookieFromHeader(cookieHeader, TOKEN_COOKIE);

  const token = tokenFromNext || tokenFromHeader || null;

  const upstream = await fetch(`${env.apiBaseUrl}/cart/checkout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      accept: "application/json",
      cookie: cookieHeader,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(clean),
    cache: "no-store",
  });

  if (upstream.status === 204) return new NextResponse(null, { status: 204 });

  const text = await upstream.text().catch(() => "");
  const contentType = upstream.headers.get("content-type") ?? "application/json";

  return new NextResponse(text, {
    status: upstream.status,
    headers: { "content-type": contentType },
  });
}
