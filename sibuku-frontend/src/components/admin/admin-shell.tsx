"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { LayoutDashboard, BookOpen, Users, ShoppingBag, PenTool } from "lucide-react";
import Card from "@/components/ui/card";
import Button from "@/components/ui/button";

type Me = { role?: string; nama?: string };

async function fetchMe(): Promise<Me | null> {
  const res = await fetch("/api/me", { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

const nav = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/books", label: "Books", icon: BookOpen },
  { href: "/admin/authors", label: "Authors", icon: PenTool },
  { href: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { href: "/admin/users", label: "Users", icon: Users },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const { data: me, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: fetchMe,
    retry: false,
    staleTime: 15_000,
  });

  // guard admin
  if (isLoading) {
    return (
      <div className="container py-10">
        <Card className="animate-pulse">
          <div className="h-4 bg-white/5 rounded w-48" />
          <div className="h-3 bg-white/5 rounded w-72 mt-3" />
        </Card>
      </div>
    );
  }

  if (!me) {
    router.replace("/login?next=/admin");
    return null;
  }

  if (me.role !== "admin") {
    return (
      <div className="container py-10">
        <Card className="border border-rose-500/30 bg-rose-500/5">
          <div className="font-semibold text-rose-200">Akses ditolak</div>
          <div className="text-sm text-white/60 mt-1">Halaman ini khusus Admin.</div>
          <div className="mt-4">
            <Button variant="secondary" onClick={() => router.replace("/")}>Kembali</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="grid lg:grid-cols-[260px_1fr] gap-6">
        <aside className="lg:sticky lg:top-24 h-fit">
          <Card className="p-4">
            <div className="text-xs text-white/50">Admin Panel</div>
            <div className="font-extrabold text-lg mt-1">
              Si<span className="text-indigo-400">Buku</span>
            </div>
            <div className="text-xs text-white/50 mt-1">
              Login sebagai: <span className="text-white/70">{me.nama || "Admin"}</span>
            </div>

            <div className="mt-4 grid gap-1">
              {nav.map((n) => {
                const active = pathname === n.href || pathname.startsWith(n.href + "/");
                const Icon = n.icon;
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    className={[
                      "flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition",
                      active ? "bg-white/10 text-white" : "hover:bg-white/5 text-white/70",
                    ].join(" ")}
                  >
                    <Icon size={16} className={active ? "text-indigo-300" : "text-white/50"} />
                    {n.label}
                  </Link>
                );
              })}
            </div>
          </Card>
        </aside>

        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
