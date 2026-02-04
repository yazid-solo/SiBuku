import Badge from "@/components/ui/badge";

function pickVariant(status: string) {
  const s = status.toLowerCase();

  // pembayaran
  if (s.includes("lunas") || s.includes("paid") || s.includes("berhasil")) return "success";
  if (s.includes("menunggu") || s.includes("pending") || s.includes("proses")) return "warning";
  if (s.includes("gagal") || s.includes("batal") || s.includes("cancel")) return "danger";

  // order
  if (s.includes("dikirim") || s.includes("shipping")) return "info";
  if (s.includes("selesai") || s.includes("delivered")) return "success";

  return "default";
}

export default function StatusBadge({ label }: { label?: string | null }) {
  const text = String(label ?? "").trim() || "—";

  return <Badge variant={pickVariant(text)}>{text}</Badge>;
}