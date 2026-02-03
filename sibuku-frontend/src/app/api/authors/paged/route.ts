import { NextResponse } from "next/server";
import { proxyFetch } from "@/lib/server/proxy";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const qs = url.searchParams.toString();

  // backend kamu: /authors/paged
  const { res, data } = await proxyFetch(req, `/authors/paged${qs ? `?${qs}` : ""}`, { method: "GET" });
  return NextResponse.json(data, { status: res.status });
}
