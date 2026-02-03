/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { proxyFetch } from "@/lib/server/proxy";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

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

export async function GET(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const { res, data } = await proxyFetch(req, `/orders/${id}`, { method: "GET" }, { auth: true });
  return respond(res, data);
}

export async function DELETE(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const { res, data } = await proxyFetch(req, `/orders/${id}`, { method: "DELETE" }, { auth: true });
  return respond(res, data);
}

/**
 * ✅ PATCH dipakai untuk aksi ringan (recommended ecommerce):
 * - soft-delete / archive => /api/orders/{id}?action=archive   -> /orders/{id}/archive
 * - unarchive (opsional) => /api/orders/{id}?action=unarchive -> /orders/{id}/unarchive
 * - default PATCH         => /api/orders/{id}                 -> /orders/{id}
 */
export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;

  const url = new URL(req.url);
  const action = (url.searchParams.get("action") ?? "").toLowerCase();

  let target = `/orders/${id}`;
  if (action === "archive") target = `/orders/${id}/archive`;
  if (action === "unarchive") target = `/orders/${id}/unarchive`;

  const { res, data } = await proxyFetch(req, target, { method: "PATCH" }, { auth: true });
  return respond(res, data);
}
