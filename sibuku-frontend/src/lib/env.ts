// src/lib/env.ts

export const TOKEN_COOKIE = "sibuku_token" as const;

// HANYA env dengan prefix NEXT_PUBLIC_ yang boleh dipakai di browser
const RAW_API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000").trim();
const RAW_APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").trim();

// rapihin biar tidak double slash ketika gabung URL
export const API_BASE_URL = RAW_API_BASE_URL.replace(/\/+$/, "");
export const APP_URL = RAW_APP_URL.replace(/\/+$/, "");

// kompatibel dengan kode kamu yang pakai env.apiBaseUrl
export const env = {
  apiBaseUrl: API_BASE_URL,
  appUrl: APP_URL,
} as const;
