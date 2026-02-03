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

            {/* Main content */}
            <PageTransition>
              <main className="flex-1">{children}</main>
            </PageTransition>

            <Footer />
          </div>
        </Providers>
      </body>
    </html>
  );
}