import { NextResponse } from "next/server";
import { proxyFetch } from "@/lib/server/proxy";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const { res, data } = await proxyFetch(
    req,
    `/admin/payment-methods/paged${url.search}`,
    { method: "GET" },
    { auth: true }
  );
  return NextResponse.json(data, { status: res.status });
}
