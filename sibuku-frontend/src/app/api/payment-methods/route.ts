/* eslint-disable @typescript-eslint/no-explicit-any */
// src/app/api/payment-methods/route.ts
import { NextResponse } from "next/server";
import { headers, cookies } from "next/headers";
import { API_BASE_URL, TOKEN_COOKIE } from "@/lib/env";

export const dynamic = "force-dynamic";

async function fetchAsJson(url: string, cookieHeader: string, token?: string | null) {
  const res = await fetch(url, {
    cache: "no-store",
    headers: {
      cookie: cookieHeader,
      accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (res.status === 204) return { res, json: null, text: "" };

  const text = await res.text().catch(() => "");
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  return { res, json, text };
}

export async function GET() {
  const base = API_BASE_URL;

  const h = await headers(); // ✅ tidak perlu await
  const cookieHeader = h.get("cookie") ?? "";

  const c = await cookies();
  const token = c.get(TOKEN_COOKIE)?.value ?? null;

  // ✅ fallback path yang sering dipakai
  const candidates = [
    `${base}/payment-methods`,
    `${base}/payment_methods`,
    `${base}/master/payment-methods`,
    `${base}/master/payment_methods`,
  ];

  let last: any = null;

  try {
    for (const url of candidates) {
      const out = await fetchAsJson(url, cookieHeader, token);
      last = out;

      if (out.res.status === 404) continue;

      if (!out.res.ok) {
        return NextResponse.json(out.json ?? { detail: out.text || "Request gagal" }, { status: out.res.status });
      }

      // ✅ kalau backend balikin non-json tapi 200
      if (out.json == null) {
        return NextResponse.json(
          { detail: "Backend mengirim response non-JSON", raw: out.text?.slice(0, 500) },
          { status: 502 }
        );
      }

      return NextResponse.json(out.json);
    }

    return NextResponse.json(
      last?.json ?? { detail: "Endpoint payment methods tidak ditemukan di backend." },
      { status: last?.res?.status ?? 404 }
    );
  } catch (e: any) {
    return NextResponse.json({ detail: e?.message || "Gagal memuat payment methods" }, { status: 500 });
  }
}
