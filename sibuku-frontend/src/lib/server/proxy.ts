/* eslint-disable @typescript-eslint/no-explicit-any */
import { env, TOKEN_COOKIE } from "@/lib/env";

function getCookieFromHeader(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";").map((p) => p.trim());
  for (const p of parts) {
    if (!p.startsWith(name + "=")) continue;
    return decodeURIComponent(p.slice(name.length + 1));
  }
  return null;
}

function normalizeBearerToken(raw: string | null): string | null {
  if (!raw) return null;
  let t = raw.trim();
  if (!t) return null;

  // hapus "Bearer " berulang kalau kepasang dobel
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const lower = t.toLowerCase();
    if (!lower.startsWith("bearer ")) break;
    t = t.slice(7).trim();
  }

  return t || null;
}

function ensureJsonContentType(headers: Headers, body: any) {
  if (headers.has("Content-Type")) return;
  if (headers.has("content-type")) return;

  if (typeof body === "string") {
    const s = body.trim();
    if (s.startsWith("{") || s.startsWith("[")) {
      headers.set("Content-Type", "application/json");
    }
  }
}

export async function proxyFetch(
  req: Request,
  path: string,
  init: RequestInit = {},
  opts: { auth?: boolean } = { auth: true }
) {
  if (!env.apiBaseUrl) {
    throw new Error("env.apiBaseUrl kosong. Cek NEXT_PUBLIC_API_BASE_URL / env.ts");
  }

  const url = `${env.apiBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;

  const headers = new Headers(init.headers);

  // default accept json (aman untuk text juga)
  if (!headers.has("Accept")) headers.set("Accept", "application/json");

  const cookie = req.headers.get("cookie");

  // auth bearer dari cookie (default)
  if (opts.auth !== false) {
    // forward cookie kalau backend butuh
    if (cookie) headers.set("cookie", cookie);

    // jangan override Authorization kalau sudah diset dari caller
    if (!headers.has("Authorization") && !headers.has("authorization")) {
      const tokenFromCookie = normalizeBearerToken(getCookieFromHeader(cookie, TOKEN_COOKIE));
      if (tokenFromCookie) headers.set("Authorization", `Bearer ${tokenFromCookie}`);
    }
  } else {
    // endpoint login/register: jangan kirim auth & cookie lama
    headers.delete("Authorization");
    headers.delete("authorization");
    headers.delete("cookie");
  }

  ensureJsonContentType(headers, init.body);

  const upstream = await fetch(url, {
    ...init,
    headers,
    cache: "no-store",
  });

  const contentType = upstream.headers.get("content-type") ?? "";
  let data: any = null;

  if (upstream.status === 204) {
    data = null;
  } else if (contentType.includes("application/json")) {
    data = await upstream.json().catch(() => null);
  } else {
    data = await upstream.text().catch(() => null);
  }

  return { res: upstream, data };
}