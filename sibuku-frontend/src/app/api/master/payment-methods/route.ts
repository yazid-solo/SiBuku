// src/app/api/master/payment-methods/route.ts
import { NextResponse } from "next/server";
import { proxyFetch } from "@/lib/server/proxy";

export const dynamic = "force-dynamic";

const CANDIDATES = [
  "/master/payment-methods",
  "/master/metode-pembayaran",
  "/master/metode_pembayaran",
  "/payment-methods",
  "/metode-pembayaran",
  "/metode_pembayaran",
];

export async function GET(req: Request) {
  for (const path of CANDIDATES) {
    const { res, data } = await proxyFetch(req, path, { method: "GET" }, { auth: false });
    if (res.status !== 404) return NextResponse.json(data, { status: res.status });
  }

  return NextResponse.json(
    { detail: "Payment methods endpoint not found. Add the correct path in CANDIDATES." },
    { status: 404 }
  );
}
