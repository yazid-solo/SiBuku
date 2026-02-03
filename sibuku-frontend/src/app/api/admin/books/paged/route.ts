import { NextResponse } from "next/server";
import { proxyFetch } from "@/lib/server/proxy";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const qs = url.search; // ?page=1&limit=10&search=...
  const { res, data } = await proxyFetch(req, `/admin/books/paged${qs}`, { method: "GET" }, { auth: true });
  return NextResponse.json(data, { status: res.status });
}
