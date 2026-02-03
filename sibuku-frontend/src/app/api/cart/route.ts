import { NextResponse } from "next/server";
import { backendFetch, BackendError } from "@/lib/server/backend";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await backendFetch("/cart/", { method: "GET" }, { auth: true });
    return NextResponse.json(data);
  } catch (e) {
    if (e instanceof BackendError) return NextResponse.json({ detail: e.detail }, { status: e.status });
    return NextResponse.json({ detail: "Request gagal" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const data = await backendFetch("/cart/", { method: "DELETE" }, { auth: true });
    return NextResponse.json(data);
  } catch (e) {
    if (e instanceof BackendError) return NextResponse.json({ detail: e.detail }, { status: e.status });
    return NextResponse.json({ detail: "Request gagal" }, { status: 500 });
  }
}
