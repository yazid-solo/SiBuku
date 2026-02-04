// src/lib/env.ts

export const TOKEN_COOKIE = "sibuku_token" as const;

const normalizeUrl = (v: string) => String(v ?? "").trim().replace(/\/+$/, "");
const isProd = process.env.NODE_ENV === "production";

/**
 * API base URL
 * - Browser hanya boleh pakai NEXT_PUBLIC_*
 * - Server (route handlers) boleh pakai API_BASE_URL (server-only) atau NEXT_PUBLIC_API_BASE_URL
 */
const RAW_API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  process.env.API_BASE_URL ??
  (isProd ? "" : "http://127.0.0.1:8000");

/**
 * App URL (frontend url)
 * - Idealnya kamu set NEXT_PUBLIC_APP_URL di Vercel frontend
 * - Kalau belum, di server bisa fallback ke VERCEL_URL
 */
const RAW_APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ??
  (isProd ? "" : "http://localhost:3000");

export const API_BASE_URL = normalizeUrl(RAW_API_BASE_URL);
export const APP_URL = normalizeUrl(RAW_APP_URL);

// biar gampang dipakai
export const env = {
  apiBaseUrl: API_BASE_URL,
  appUrl: APP_URL,
} as const;

// Debug ringan (nggak nge-crash)
if (isProd) {
  if (!API_BASE_URL) console.error("[env] Missing API base URL. Set NEXT_PUBLIC_API_BASE_URL (frontend) / API_BASE_URL (server).");
  if (!APP_URL) console.error("[env] Missing APP URL. Set NEXT_PUBLIC_APP_URL.");
}