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

  // bersihin kalau token tersimpan sebagai "Bearer xxx" atau bahkan "Bearer Bearer xxx"
  // (loop sampai hilang)
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

  // hanya auto-set jika body string yang terlihat seperti JSON
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
  const url = `${env.apiBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;

  const headers = new Headers(init.headers);

  // forward cookie (kalau backend juga butuh)
  const cookie = req.headers.get("cookie");
  if (cookie) headers.set("cookie", cookie);

  // auto Content-Type JSON kalau body JSON string dan header belum ada
  ensureJsonContentType(headers, init.body);

  // auth bearer dari cookie (default)
  if (opts.auth !== false) {
    const tokenFromCookie = normalizeBearerToken(getCookieFromHeader(cookie, TOKEN_COOKIE));
    if (tokenFromCookie) headers.set("Authorization", `Bearer ${tokenFromCookie}`);
  } else {
    // kalau endpoint auth (login/register), jangan kirim Authorization supaya tidak bentrok token lama
    headers.delete("Authorization");
  }

  const upstream = await fetch(url, {
    ...init,
    headers,
    cache: "no-store",
  });

  const contentType = upstream.headers.get("content-type") ?? "";
  let data: any = null;

  if (contentType.includes("application/json")) {
    data = await upstream.json().catch(() => null);
  } else {
    data = await upstream.text().catch(() => null);
  }

  return { res: upstream, data };
}
