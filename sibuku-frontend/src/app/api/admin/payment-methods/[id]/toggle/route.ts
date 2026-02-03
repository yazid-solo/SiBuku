import { NextResponse } from "next/server";
import { proxyFetch } from "@/lib/server/proxy";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;

  const { res, data } = await proxyFetch(
    req,
    `/admin/payment-methods/${id}/toggle`,
    { method: "PATCH" },
    { auth: true }
  );

  return NextResponse.json(data, { status: res.status });
}
