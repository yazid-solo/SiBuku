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

export async function GET() {
  const tokenRaw = (await cookies()).get(TOKEN_COOKIE)?.value;
  const token = normalizeBearerToken(tokenRaw);
  if (!token) return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });

  const res = await fetch(`${API_BASE_URL}/users/profile`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    cache: "no-store",
  });

  const data = await readUpstream(res);
  return NextResponse.json(data ?? null, { status: res.status });
}

export async function PATCH(req: Request) {
  const tokenRaw = (await cookies()).get(TOKEN_COOKIE)?.value;
  const token = normalizeBearerToken(tokenRaw);
  if (!token) return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);

  const res = await fetch(`${API_BASE_URL}/users/profile`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body ?? {}),
    cache: "no-store",
  });

  if (res.status === 204) return new NextResponse(null, { status: 204 });

  const data = await readUpstream(res);
  return NextResponse.json(data ?? null, { status: res.status });
}