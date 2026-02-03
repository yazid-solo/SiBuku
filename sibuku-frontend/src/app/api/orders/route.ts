import { NextResponse } from "next/server";
import { proxyFetch } from "@/lib/server/proxy";

export const dynamic = "force-dynamic";

function isJsonResponse(res: Response) {
  const ct = res.headers.get("content-type") ?? "";
  return ct.includes("application/json");
}

export async function GET(req: Request) {
  const { res, data } = await proxyFetch(req, `/orders`, { method: "GET" }, { auth: true });

  if (res.status === 204) return new NextResponse(null, { status: 204 });

  if (!isJsonResponse(res) && typeof data === "string") {
    return new NextResponse(data, { status: res.status });
  }

  return NextResponse.json(data ?? null, { status: res.status });
}
