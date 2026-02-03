import { NextResponse } from "next/server";
import { proxyFetch } from "@/lib/server/proxy";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const qs = url.searchParams.toString();
  const path = qs ? `/admin/books?${qs}` : "/admin/books";

  const { res, data } = await proxyFetch(req, path, { method: "GET" }, { auth: true });
  return NextResponse.json(data ?? null, { status: res.status });
}

export async function POST(req: Request) {
  const body = await req.json();
  const { res, data } = await proxyFetch(
    req,
    "/admin/books",
    { method: "POST", body: JSON.stringify(body) },
    { auth: true }
  );
  return NextResponse.json(data ?? null, { status: res.status });
}
