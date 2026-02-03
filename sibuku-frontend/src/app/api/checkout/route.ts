// src/app/api/checkout/route.ts
import { NextResponse } from "next/server";
import { proxyFetch } from "@/lib/server/proxy";

export const dynamic = "force-dynamic";

const CANDIDATES = [
  "/checkout",
  "/orders/checkout",
  "/orders/create",
  "/orders",
];

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  // Mapping ringan biar kompatibel sama variasi backend field
  const backendBody: Record<string, unknown> = { ...body };

  if (body?.alamat && backendBody.alamat_pengiriman == null) backendBody.alamat_pengiriman = body.alamat;
  if (body?.no_hp && backendBody.no_hp_pengiriman == null) backendBody.no_hp_pengiriman = body.no_hp;

  if (body?.id_metode_pembayaran && backendBody.id_payment_method == null)
    backendBody.id_payment_method = body.id_metode_pembayaran;

  if (body?.id_payment_method && backendBody.id_metode_pembayaran == null)
    backendBody.id_metode_pembayaran = body.id_payment_method;

  for (const path of CANDIDATES) {
    const { res, data } = await proxyFetch(
      req,
      path,
      { method: "POST", body: JSON.stringify(backendBody) },
      { auth: true }
    );
    if (res.status !== 404) return NextResponse.json(data, { status: res.status });
  }

  return NextResponse.json(
    { detail: "Checkout endpoint not found. Add the correct path in CANDIDATES." },
    { status: 404 }
  );
}
