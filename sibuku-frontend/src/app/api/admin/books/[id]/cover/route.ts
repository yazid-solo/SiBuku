import { NextResponse } from "next/server";
import { proxyFetch } from "@/lib/server/proxy";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const formData = await req.formData();

  const { res, data } = await proxyFetch(
    req,
    `/admin/books/${id}/cover`,
    { method: "POST", body: formData },
    { auth: true }
  );
  return NextResponse.json(data, { status: res.status });
}

export async function DELETE(req: Request, { params }: Ctx) {
  const { id } = await params;
  const { res, data } = await proxyFetch(
    req,
    `/admin/books/${id}/cover`,
    { method: "DELETE" },
    { auth: true }
  );
  return NextResponse.json(data, { status: res.status });
}
