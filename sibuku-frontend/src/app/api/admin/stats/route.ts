/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { proxyFetch } from "@/lib/server/proxy";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { res, data } = await proxyFetch(
      req,
      "/admin/stats",
      { method: "GET" },
      { auth: true }
    );

    // kalau upstream balikin kosong / bukan json
    if (data === null || data === undefined) {
      return NextResponse.json(
        { detail: res.ok ? "No data" : "Upstream error" },
        { status: res.status }
      );
    }

    return NextResponse.json(data, { status: res.status });
  } catch (e: any) {
    return NextResponse.json(
      { detail: e?.message || "Gagal menghubungi server backend" },
      { status: 502 }
    );
  }
}
