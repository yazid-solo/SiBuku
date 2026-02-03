import { NextResponse } from "next/server";
import { backendFetch, BackendError } from "@/lib/server/backend";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    const data = await backendFetch(`/cart/items/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }, { auth: true });
    return NextResponse.json(data);
  } catch (e) {
    if (e instanceof BackendError) return NextResponse.json({ detail: e.detail }, { status: e.status });
    return NextResponse.json({ detail: "Request gagal" }, { status: 500 });
  }
}

export async function DELETE(_: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const data = await backendFetch(`/cart/items/${id}`, { method: "DELETE" }, { auth: true });
    return NextResponse.json(data);
  } catch (e) {
    if (e instanceof BackendError) return NextResponse.json({ detail: e.detail }, { status: e.status });
    return NextResponse.json({ detail: "Request gagal" }, { status: 500 });
  }
}
