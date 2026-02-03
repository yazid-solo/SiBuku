import { NextResponse } from "next/server";
import { proxyFetch } from "@/lib/server/proxy";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  const { res, data } = await proxyFetch(req, `/authors/${id}`, { method: "GET" });
  return NextResponse.json(data, { status: res.status });
}
