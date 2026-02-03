/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { proxyFetch } from "@/lib/server/proxy";

export const dynamic = "force-dynamic";

async function getIdFromCtx(ctx: any): Promise<string> {
  const p = ctx?.params;
  const params = typeof p?.then === "function" ? await p : p;
  return String(params?.id ?? "");
}

export async function GET(req: Request, ctx: any) {
  const id = await getIdFromCtx(ctx);

  const { res, data } = await proxyFetch(
    req,
    `/admin/orders/${id}`,
    { method: "GET" },
    { auth: true }
  );

  return NextResponse.json(data, { status: res.status });
}
