// src/app/admin/layout.tsx
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getServerMe } from "@/lib/server/me";
import AdminNav from "@/components/admin/admin-nav";

const nav = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/books", label: "Books" },
  { href: "/admin/authors", label: "Authors" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/users", label: "Users" },
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const me = await getServerMe();

  if (!me) redirect("/login?next=/admin");
  if (me.role !== "admin") redirect("/");

  return (
    <div className="container py-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-xs text-white/50">Admin Panel</div>
          <h1 className="text-2xl font-black leading-tight">
            Si<span className="text-indigo-400">Buku</span> CMS
          </h1>
        </div>

        <div className="text-sm text-white/70">
          Login sebagai: <b className="text-white/90">{me.nama}</b>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[240px_1fr]">
        <aside className="glass rounded-2xl p-3 h-fit lg:sticky lg:top-24">
          <AdminNav items={nav} />

          <div className="mt-4 text-xs text-white/40 px-3">
            Semua admin via cookie token + role-check.
          </div>
        </aside>

        <section className="min-w-0">{children}</section>
      </div>
    </div>
  );
}
