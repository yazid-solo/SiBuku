import type { Metadata } from "next";
import "./globals.css";

import { Suspense } from "react";
import Providers from "./providers";
import Header from "@/components/header";
import Footer from "@/components/footer";
import PageTransition from "@/components/ui/page-transition";

export const metadata: Metadata = {
  title: "SiBuku — Toko Buku Modern",
  description: "Platform e-commerce buku berbasis Next.js + FastAPI + Supabase",
};

function HeaderFallback() {
  return (
    <div className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/70 backdrop-blur">
      <div className="container h-16" />
    </div>
  );
}

function PageFallback() {
  return (
    <main className="flex-1">
      <div className="container py-10">
        <div className="animate-pulse grid gap-3">
          <div className="h-6 w-56 rounded bg-white/5" />
          <div className="h-4 w-80 rounded bg-white/5" />
          <div className="h-24 rounded-2xl bg-white/5 mt-2" />

          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="aspect-4/3 rounded-xl bg-white/5" />
                <div className="h-4 bg-white/5 rounded mt-3" />
                <div className="h-3 bg-white/5 rounded mt-2 w-2/3" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body className="min-h-screen bg-slate-950 text-white">
        <Providers>
          {/* Layout wrapper biar footer selalu turun bawah */}
          <div className="min-h-screen flex flex-col">
            {/* ✅ FIX: Header pakai Suspense karena Header memakai useSearchParams() */}
            <Suspense fallback={<HeaderFallback />}>
              <Header />
            </Suspense>

            {/* ✅ FIX: children/pages (contoh /books) pakai useSearchParams() juga */}
            <Suspense fallback={<PageFallback />}>
              <PageTransition>
                <main className="flex-1">{children}</main>
              </PageTransition>
            </Suspense>

            <Footer />
          </div>
        </Providers>
      </body>
    </html>
  );
}