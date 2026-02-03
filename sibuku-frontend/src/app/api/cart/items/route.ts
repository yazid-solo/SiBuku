import { NextResponse } from "next/server";
import { backendFetch, BackendError } from "@/lib/server/backend";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const data = await backendFetch("/cart/items", {
      method: "POST",
      body: JSON.stringify(body),
    }, { auth: true });
    return NextResponse.json(data);
  } catch (e) {
    if (e instanceof BackendError) return NextResponse.json({ detail: e.detail }, { status: e.status });
    return NextResponse.json({ detail: "Request gagal" }, { status: 500 });
  }
}
