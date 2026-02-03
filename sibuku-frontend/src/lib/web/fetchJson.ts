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
          const loc = Array.isArray((x as any).loc) ? (x as any).loc.slice(1).join(".") : String((x as any).loc ?? "");
          const msg = (x as any).msg ?? JSON.stringify(x);
          return loc ? `${loc}: ${String(msg)}` : String(msg);
        }
        return String(x);
      })
      .filter(Boolean)
      .join(" • ");
  }

  if (typeof detail === "object") {
    const loc = Array.isArray((detail as any).loc) ? (detail as any).loc.slice(1).join(".") : String((detail as any).loc ?? "");
    const msg = (detail as any).msg ?? JSON.stringify(detail);
    return loc ? `${loc}: ${String(msg)}` : String(msg);
  }

  return String(detail);
}

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    cache: "no-store",
    credentials: "include",
    ...init,
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const msg =
      toPlainMessage(data?.detail) ||
      toPlainMessage(data?.message) ||
      `Request gagal (${res.status})`;

    const err = new Error(msg) as HttpErr;
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data as T;
}
