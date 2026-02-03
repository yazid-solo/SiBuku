import { NextResponse } from "next/server";
import { proxyFetch } from "@/lib/server/proxy";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request) {
  const body = await req.text();
  const { res, data } = await proxyFetch(req, "/admin/books/bulk", { method: "PATCH", body }, { auth: true });
  return NextResponse.json(data, { status: res.status });
}
