import Link from "next/link";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-white/10 bg-slate-950">
      <div className="container py-10 grid gap-8 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="font-black text-lg">SiBuku</div>
          <p className="text-sm text-white/60 mt-2 max-w-md">
            E-commerce buku modern berbasis Next.js + FastAPI + Supabase.
            Belanja cepat, tampilan rapi, dan status pesanan realtime.
          </p>

          <div className="text-xs text-white/40 mt-4">© {year} SiBuku. All rights reserved.</div>
        </div>

        <div>
          <div className="font-semibold">Menu</div>
          <div className="mt-3 grid gap-2 text-sm text-white/70">
            <Link href="/books" className="hover:text-white transition">Buku</Link>
            <Link href="/authors" className="hover:text-white transition">Penulis</Link>
            <Link href="/cart" className="hover:text-white transition">Keranjang</Link>
            <Link href="/orders" className="hover:text-white transition">Pesanan</Link>
          </div>
        </div>

        <div>
          <div className="font-semibold">Bantuan</div>
          <div className="mt-3 grid gap-2 text-sm text-white/70">
            <Link href="/account" className="hover:text-white transition">Akun</Link>
            <Link href="/login" className="hover:text-white transition">Login</Link>
            <Link href="/register" className="hover:text-white transition">Daftar</Link>
            <a href="#" className="hover:text-white transition">FAQ</a>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="container py-5 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-white/50">
          <div>Built with for modern ecommerce experience.</div>
          <div className="flex items-center gap-4">
            <a className="hover:text-white transition" href="#" rel="noreferrer">Privacy</a>
            <a className="hover:text-white transition" href="#" rel="noreferrer">Support</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
