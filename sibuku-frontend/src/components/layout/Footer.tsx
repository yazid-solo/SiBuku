import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-white/10 mt-10">
      <div className="container py-10 grid gap-6 md:grid-cols-3">
        <div>
          <div className="font-black text-lg">Sibuku</div>
          <div className="text-sm text-white/60 mt-2">
            Toko buku modern: checkout cepat, status pesanan jelas, dan dashboard admin rapi.
          </div>
        </div>

        <div className="grid gap-2 text-sm">
          <div className="font-semibold">Menu</div>
          <Link className="text-white/60 hover:text-white" href="/books">Katalog Buku</Link>
          <Link className="text-white/60 hover:text-white" href="/cart">Keranjang</Link>
          <Link className="text-white/60 hover:text-white" href="/orders">Pesanan</Link>
          <Link className="text-white/60 hover:text-white" href="/account">Akun</Link>
        </div>

        <div className="grid gap-2 text-sm">
          <div className="font-semibold">Bantuan</div>
          <div className="text-white/60">Email: support@sibuku.id</div>
          <div className="text-white/60">Jam kerja: 09:00–09:00</div>
          <div className="text-[11px] text-white/40 mt-3">
            © {new Date().getFullYear()} Sibuku • All rights reserved
          </div>
        </div>
      </div>
    </footer>
  );
}
