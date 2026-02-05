/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { proxyFetch } from "@/lib/server/proxy";

export const dynamic = "force-dynamic";

function json(res: Response, data: any) {
  if (res.status === 204) return new NextResponse(null, { status: 204 });
  return NextResponse.json(data ?? null, { status: res.status });
}

/**
 * Cart summary helper:
 * - ambil dari backend /cart (yang sudah ada)
 * - return hanya { total_qty, total_price }
 */
export async function GET(req: Request) {
  const { res, data } = await proxyFetch(req, `/cart`, { method: "GET" }, { auth: true });

  if (!res.ok) return json(res, data);

  const summary = (data as any)?.summary ?? { total_qty: 0, total_price: 0 };
  return NextResponse.json(summary, { status: 200 });
}