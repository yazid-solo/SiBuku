import { NextResponse } from "next/server";
import { proxyFetch } from "@/lib/server/proxy";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> | { id: string } };

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await Promise.resolve(params);
  const body = await req.json().catch(() => ({}));

  const { res, data } = await proxyFetch(
    req,
    `/admin/orders/${id}/status-payment`,
    { method: "PATCH", body: JSON.stringify(body) },
    { auth: true }
  );

  return NextResponse.json(data, { status: res.status });
}
