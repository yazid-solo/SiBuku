"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @next/next/no-img-element */
import { Copy } from "lucide-react";
import Button from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

function tryParseJson(s?: string) {
  if (!s) return null;
  const t = s.trim();
  if (!t) return null;
  if (!(t.startsWith("{") || t.startsWith("["))) return null;
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

function extractFirstUrl(text: string): string | null {
  const m = text.match(/https?:\/\/[^\s)"]+/i);
  return m ? m[0] : null;
}

function extractAccountNumber(text: string): string | null {
  const m = text.replace(/\s+/g, " ").match(/(\d{7,20})/);
  return m ? m[1] : null;
}

export type PaymentInstructionProps = {
  methodName?: string | null;
  desc?: string | null;
};

export default function PaymentInstruction({ methodName, desc }: PaymentInstructionProps) {
  const { toast } = useToast();

  const d = (desc ?? "").trim();
  if (!d) {
    return (
      <div className="mt-3 text-xs text-white/50">
        Tidak ada instruksi tambahan untuk metode ini.
      </div>
    );
  }

  const parsed: any = tryParseJson(d);

  const qrUrl =
    (parsed?.qr_url || parsed?.qris_url || parsed?.qr || parsed?.qris || null) ??
    (d.toLowerCase().includes("http") && d.toLowerCase().includes("qr")
      ? extractFirstUrl(d)
      : null);

  const acc =
    parsed?.account_number ||
    parsed?.va_number ||
    parsed?.rekening ||
    parsed?.no_rek ||
    extractAccountNumber(d);

  const bank = String(parsed?.bank || parsed?.bank_name || "").trim();
  const accName = String(parsed?.account_name || parsed?.atas_nama || parsed?.nama_rekening || "").trim();

  const lines = d
    .split(/\n+/)
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 8);

  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="text-sm font-semibold">
        Instruksi Pembayaran{methodName ? ` • ${methodName}` : ""}
      </div>

      {(bank || accName) && (
        <div className="text-xs text-white/60 mt-1">
          {bank ? <span>{bank}</span> : null}
          {bank && accName ? <span className="mx-2 text-white/30">•</span> : null}
          {accName ? <span>Atas nama: {accName}</span> : null}
        </div>
      )}

      {acc ? (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3">
          <div className="min-w-0">
            <div className="text-[11px] text-white/50">Nomor Rekening / Virtual Account</div>
            <div className="font-semibold text-white/90 break-all">{String(acc)}</div>
          </div>
          <Button
            variant="secondary"
            className="shrink-0 gap-2"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(String(acc));
                toast({ variant: "success", title: "Tersalin", message: "Nomor berhasil dicopy." });
              } catch {
                toast({ variant: "error", title: "Gagal", message: "Tidak bisa akses clipboard." });
              }
            }}
          >
            <Copy size={16} /> Copy
          </Button>
        </div>
      ) : null}

      {qrUrl ? (
        <div className="mt-3">
          <div className="text-[11px] text-white/50 mb-2">QR / QRIS</div>
          <div className="rounded-xl overflow-hidden border border-white/10 bg-slate-950/40 p-3 inline-block">
            <img src={qrUrl} alt="QR Code" className="h-40 w-40 object-contain" />
          </div>
          <div className="text-[11px] text-white/40 mt-2 break-all">{qrUrl}</div>
        </div>
      ) : null}

      <div className="mt-3 grid gap-1 text-xs text-white/70">
        {lines.map((l, i) => (
          <div key={i}>• {l}</div>
        ))}
      </div>

      <div className="text-[11px] text-white/40 mt-3">
        *Konten di atas otomatis dari field <code className="text-white/70">keterangan</code>.
      </div>
    </div>
  );
}
