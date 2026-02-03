/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { proxyFetch } from "@/lib/server/proxy";
import { TOKEN_COOKIE } from "@/lib/env";

export const dynamic = "force-dynamic";

function extractToken(data: any): string | null {
  return (
    data?.access_token ??
    data?.token ??
    data?.data?.access_token ??
    data?.data?.token ??
    null
  );
}

function sanitizeToken(raw: string): string {
  let t = String(raw || "").trim();
  // buang "Bearer " berulang
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const lower = t.toLowerCase();
    if (!lower.startsWith("bearer ")) break;
    t = t.slice(7).trim();
  }
  return t;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({} as any));

  // ✅ kompatibilitas: kalau backend kamu pakai "username" bukan "email"
  // (tidak merusak kalau backend sebenarnya pakai email)
  const payload = {
    ...body,
    username: body?.username ?? body?.email,
  };

  const { res, data } = await proxyFetch(
    req,
    "/auth/login",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" }, // ✅ PENTING
      body: JSON.stringify(payload),
    },
    { auth: false }
  );

  // kalau login gagal, teruskan error backend
  if (!res.ok) return NextResponse.json(data ?? { detail: "Login gagal" }, { status: res.status });

  const tokenRaw = extractToken(data);
  if (tokenRaw) {
    const token = sanitizeToken(tokenRaw);

    (await cookies()).set(TOKEN_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 hari
    });
  }

  return NextResponse.json(data, { status: res.status });
}
