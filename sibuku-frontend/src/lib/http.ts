/* eslint-disable @typescript-eslint/no-explicit-any */

export type HttpErr = Error & { status?: number; data?: any };

function toPlainMessage(detail: any): string {
  if (!detail) return "";
  if (typeof detail === "string") return detail;

  if (Array.isArray(detail)) {
    return detail
      .map((x) => {
        if (!x) return "";
        if (typeof x === "string") return x;
        if (typeof x === "object") {
          const loc = Array.isArray(x.loc) ? x.loc.slice(1).join(".") : String(x.loc ?? "");
          const msg = x.msg ?? JSON.stringify(x);
          return loc ? `${loc}: ${String(msg)}` : String(msg);
        }
        return String(x);
      })
      .filter(Boolean)
      .join(" • ");
  }

  if (typeof detail === "object") {
    const loc = Array.isArray(detail.loc) ? detail.loc.slice(1).join(".") : String(detail.loc ?? "");
    const msg = detail.msg ?? JSON.stringify(detail);
    return loc ? `${loc}: ${String(msg)}` : String(msg);
  }

  return String(detail);
}

export async function fetchJson<T = any>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    cache: "no-store",
    credentials: "include",
    ...init,
  });

  const ct = res.headers.get("content-type") ?? "";
  const text = await res.text().catch(() => "");
  const data =
    ct.includes("application/json")
      ? (() => {
          try {
            return text ? JSON.parse(text) : null;
          } catch {
            return null;
          }
        })()
      : text || null;

  if (!res.ok) {
    const msg =
      toPlainMessage((data as any)?.detail) ||
      toPlainMessage((data as any)?.message) ||
      (typeof data === "string" ? data : "") ||
      `Request gagal (${res.status})`;

    const err = new Error(msg) as HttpErr;
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data as T;
}