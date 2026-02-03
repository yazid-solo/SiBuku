// src/lib/server/me.ts
import "server-only";
import { cookies } from "next/headers";
import { API_BASE_URL, TOKEN_COOKIE } from "@/lib/env";
import type { MeUser } from "@/lib/types";

function safeJson(text: string) {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

export async function getServerMe(): Promise<MeUser | null> {
  const token = (await cookies()).get(TOKEN_COOKIE)?.value;
  if (!token) return null;

  const res = await fetch(`${API_BASE_URL}/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  const text = await res.text();
  const data = safeJson(text);

  if (!res.ok) return null;
  return data as MeUser;
}
