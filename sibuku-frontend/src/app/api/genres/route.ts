import { NextResponse } from "next/server";
import { proxyFetch } from "@/lib/server/proxy";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { res, data } = await proxyFetch(req, "/genres", { method: "GET" }, { auth: false });
  return NextResponse.json(data, { status: res.status });
}
