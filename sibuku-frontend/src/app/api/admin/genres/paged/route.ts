import { NextResponse } from "next/server";
import { proxyFetch } from "@/lib/server/proxy";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const qs = url.search; // ikutkan query: page, limit, search, sort_by, order, dll
  const { res, data } = await proxyFetch(
    req,
    `/admin/genres/paged${qs}`,
    { method: "GET" },
    { auth: true }
  );
  return NextResponse.json(data, { status: res.status });
}
