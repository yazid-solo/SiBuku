import { NextResponse } from "next/server";
import { proxyFetch } from "@/lib/server/proxy";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  const { res, data } = await proxyFetch(
    req,
    "/admin/authors",
    { method: "POST", body: JSON.stringify(body) },
    { auth: true }
  );

  return NextResponse.json(data, { status: res.status });
}
