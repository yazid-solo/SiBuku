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

export async function PATCH(req: Request) {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const bodyText = await req.text();

  const c = await cookies();
  const tokenFromNext = c.get(TOKEN_COOKIE)?.value;
  const tokenFromHeader = readCookieFromHeader(cookieHeader, TOKEN_COOKIE);
  const token = tokenFromNext || tokenFromHeader || null;

  const upstream = await fetch(`${env.apiBaseUrl}/users/role`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      cookie: cookieHeader,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: bodyText,
    cache: "no-store",
  });

  const text = await upstream.text();
  const contentType = upstream.headers.get("content-type") ?? "application/json";

  return new NextResponse(text, {
    status: upstream.status,
    headers: { "content-type": contentType },
  });
}
