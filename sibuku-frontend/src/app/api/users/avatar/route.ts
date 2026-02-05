import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { API_BASE_URL, TOKEN_COOKIE } from "@/lib/env";

export const dynamic = "force-dynamic";

function normalizeBearerToken(raw: string | null | undefined) {
  let t = String(raw ?? "").trim();
  if (!t) return "";
  while (t.toLowerCase().startsWith("bearer ")) t = t.slice(7).trim();
  return t;
}

async function readUpstream(res: Response) {
  if (res.status === 204) return null;
  const ct = res.headers.get("content-type") ?? "";
  const text = await res.text().catch(() => "");
  if (ct.includes("application/json") && text) {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }
  return text || null;
}

export async function POST(req: Request) {
  const tokenRaw = (await cookies()).get(TOKEN_COOKIE)?.value;
  const token = normalizeBearerToken(tokenRaw);
  if (!token) return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });

  const original = await req.formData();

  // build ulang formdata agar bisa retry ke endpoint lain
  const build = () => {
    const fd = new FormData();
    for (const [k, v] of original.entries()) fd.append(k, v);
    return fd;
  };

  // ✅ coba beberapa kemungkinan path backend (biar fleksibel)
  const candidates = ["/users/avatar", "/users/profile/avatar", "/users/profile/photo"];

  let upstream: Response | null = null;

  for (const p of candidates) {
    const res = await fetch(`${API_BASE_URL}${p}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      body: build(),
      cache: "no-store",
    });

    // kalau bukan 404, pakai hasil ini
    if (res.status !== 404) {
      upstream = res;
      break;
    }
  }

  if (!upstream) {
    return NextResponse.json(
      { detail: "Endpoint upload avatar belum tersedia di backend." },
      { status: 404 }
    );
  }

  const data = await readUpstream(upstream);
  return NextResponse.json(data ?? null, { status: upstream.status });
}