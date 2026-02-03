import { NextResponse } from "next/server";
import { proxyFetch } from "@/lib/server/proxy";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { res, data } = await proxyFetch(req, "/cart/", { method: "GET" }, { auth: true });

  // kalau belum login / unauthorized => badge 0 (jangan bikin error)
  if (!res.ok) {
    return NextResponse.json({ total_qty: 0, total_price: 0 }, { status: 200 });
  }

  const summary =
    data?.summary ??
    data?.data?.summary ?? // kalau backend membungkus response
    { total_qty: 0, total_price: 0 };

  return NextResponse.json(summary, { status: 200 });
}
