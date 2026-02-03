// CLIENT-SAFE: jangan import next/headers di sini

export class BackendError extends Error {
  status: number;
  detail: unknown;

  constructor(status: number, detail: unknown) {
    super(typeof detail === "string" ? detail : "Backend error");
    this.status = status;
    this.detail = detail;
  }
}

export function getErrorMessage(err: unknown, fallback = "Terjadi kesalahan") {
  if (!err) return fallback;
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  return fallback;
}
