import { NextResponse } from "next/server";
import { proxyFetch } from "@/lib/server/proxy";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const qs = url.searchParams.toString();
  const path = qs ? `/authors?${qs}` : "/authors";

  const { res, data } = await proxyFetch(req, path, { method: "GET" });
  return NextResponse.json(data, { status: res.status });
}
