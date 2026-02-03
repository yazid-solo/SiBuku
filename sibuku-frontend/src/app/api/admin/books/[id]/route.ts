import { NextResponse } from "next/server";
import { proxyFetch } from "@/lib/server/proxy";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> | { id: string } };

export async function GET(req: Request, { params }: Ctx) {
  const { id } = await Promise.resolve(params);
  const { res, data } = await proxyFetch(req, `/admin/books/${id}`, { method: "GET" }, { auth: true });
  return NextResponse.json(data, { status: res.status });
}

export async function PUT(req: Request, { params }: Ctx) {
  const { id } = await Promise.resolve(params);
  const body = await req.json();
  const { res, data } = await proxyFetch(
    req,
    `/admin/books/${id}`,
    { method: "PUT", body: JSON.stringify(body) },
    { auth: true }
  );
  return NextResponse.json(data, { status: res.status });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await Promise.resolve(params);
  const body = await req.json();
  const { res, data } = await proxyFetch(
    req,
    `/admin/books/${id}`,
    { method: "PATCH", body: JSON.stringify(body) },
    { auth: true }
  );
  return NextResponse.json(data, { status: res.status });
}

export async function DELETE(req: Request, { params }: Ctx) {
  const { id } = await Promise.resolve(params);
  const { res, data } = await proxyFetch(req, `/admin/books/${id}`, { method: "DELETE" }, { auth: true });
  return NextResponse.json(data, { status: res.status });
}
