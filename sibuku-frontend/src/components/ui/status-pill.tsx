import { cn } from "@/lib/cn";

function statusColor(label: string) {
  const s = (label || "").toLowerCase();
  if (s.includes("selesai") || s.includes("lunas"))
    return "bg-emerald-500/15 text-emerald-200 ring-emerald-500/30";
  if (s.includes("batal") || s.includes("gagal") || s.includes("expired"))
    return "bg-rose-500/15 text-rose-200 ring-rose-500/30";
  if (s.includes("dikirim") || s.includes("diproses") || s.includes("siap"))
    return "bg-sky-500/15 text-sky-200 ring-sky-500/30";
  return "bg-amber-500/15 text-amber-200 ring-amber-500/30";
}

export default function StatusPill({
  label,
  className,
}: {
  label?: string | null;
  className?: string;
}) {
  const text = label?.toString().trim() || "—";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs ring-1",
        statusColor(text),
        className
      )}
    >
      {text}
    </span>
  );
}
