"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string };

export default function AdminNav({ items }: { items: Item[] }) {
  const pathname = usePathname();

  return (
    <nav className="grid gap-1">
      {items.map((x) => {
        const active = pathname === x.href || pathname.startsWith(x.href + "/");
        return (
          <Link
            key={x.href}
            href={x.href}
            className={[
              "rounded-xl px-3 py-2 text-sm transition",
              active ? "bg-white/10 text-white" : "hover:bg-white/5 text-white/70",
            ].join(" ")}
          >
            {x.label}
          </Link>
        );
      })}
    </nav>
  );
}
