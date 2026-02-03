// src/app/api/profile/route.ts
import { NextResponse } from "next/server";
import { backendFetch, BackendError } from "@/lib/server/backend";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await backendFetch("/users/profile", { method: "GET" }, { auth: true });
    return NextResponse.json(data);
  } catch (e: unknown) {
    if (e instanceof BackendError) {
      return NextResponse.json({ detail: e.detail }, { status: e.status });
    }
    return NextResponse.json({ detail: "Server error" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();

    const data = await backendFetch(
      "/users/profile",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
      { auth: true }
    );

    return NextResponse.json(data);
  } catch (e: unknown) {
    if (e instanceof BackendError) {
      return NextResponse.json({ detail: e.detail }, { status: e.status });
    }
    return NextResponse.json({ detail: "Server error" }, { status: 500 });
  }
}
