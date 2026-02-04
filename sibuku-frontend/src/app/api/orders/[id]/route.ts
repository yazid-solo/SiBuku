/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { proxyFetch } from "@/lib/server/proxy";

export const dynamic = "force-dynamic";

// ✅ kompatibel: kadang Next ngasih object, kadang bisa Promise (tergantung versi/typing)
type Ctx = { params: { id: string } | Promise<{ id: string }> };

function isJsonResponse(res: Response) {
  const ct = res.headers.get("content-type") ?? "";
  return ct.includes("application/json");
}

function respond(res: Response, data: any) {
  // backend return 204 => jangan dipaksa json
  if (res.status === 204) return new NextResponse(null, { status: 204 });

  // kalau backend balikin non-json, jangan dipaksa json
  if (!isJsonResponse(res) && typeof data === "string") {
    return new NextResponse(data, { status: res.status });
  }

  return NextResponse.json(data ?? null, { status: res.status });
}

// ✅ helper: coba beberapa endpoint sampai ketemu yg hidup
async function tryFetch(
  req: Request,
  targets: string[],
  init: RequestInit,
  opts: { auth: boolean }
) {
  let last: { res: Response; data: any } | null = null;

  for (const t of targets) {
    const out = await proxyFetch(req, t, init, opts);
    last = out;

    // kalau 404, coba target berikutnya
    if (out.res.status === 404) continue;

    return out;
  }

  return last!;
}

export async function GET(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;

  if (!id) {
    return NextResponse.json({ detail: "order id kosong" }, { status: 400 });
  }

  const targets = [
    `/orders/${encodeURIComponent(id)}`,
    `/orders/detail/${encodeURIComponent(id)}`, // ✅ fallback kalau backend kamu beda
  ];

  const { res, data } = await tryFetch(req, targets, { method: "GET" }, { auth: true });
  return respond(res, data);
}

export async function DELETE(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;

  if (!id) {
    return NextResponse.json({ detail: "order id kosong" }, { status: 400 });
  }

  const { res, data } = await proxyFetch(req, `/orders/${encodeURIComponent(id)}`, { method: "DELETE" }, { auth: true });
  return respond(res, data);
}

/**
 * ✅ PATCH dipakai untuk aksi ringan (recommended ecommerce):
 * - archive => /api/orders/{id}?action=archive   -> /orders/{id}/archive
 * - unarchive => /api/orders/{id}?action=unarchive -> /orders/{id}/unarchive
 * - default PATCH => /api/orders/{id} -> /orders/{id}
 */
export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;

  if (!id) {
    return NextResponse.json({ detail: "order id kosong" }, { status: 400 });
  }

  const url = new URL(req.url);
  const action = (url.searchParams.get("action") ?? "").toLowerCase();

  let target = `/orders/${encodeURIComponent(id)}`;
  if (action === "archive") target = `/orders/${encodeURIComponent(id)}/archive`;
  if (action === "unarchive") target = `/orders/${encodeURIComponent(id)}/unarchive`;

  const { res, data } = await proxyFetch(req, target, { method: "PATCH" }, { auth: true });
  return respond(res, data);
}