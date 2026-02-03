import { NextResponse } from "next/server";
import { proxyFetch } from "@/lib/server/proxy";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const bodyText = await req.text();

  const { res, data } = await proxyFetch(
    req,
    `/admin/orders/${id}/status`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: bodyText,
    },
    { auth: true }
  );

  // kalau backend balikin string (bukan json), forward apa adanya
  if (typeof data === "string") {
    return new NextResponse(data, {
      status: res.status,
      headers: {
        "content-type": res.headers.get("content-type") ?? "text/plain",
      },
    });
  }

  return NextResponse.json(data, { status: res.status });
}
