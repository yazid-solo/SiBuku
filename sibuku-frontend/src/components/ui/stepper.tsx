import Link from "next/link";
import { cn } from "@/lib/utils";

type Step = { label: string; href?: string };

export default function Stepper({
  steps,
  activeIndex,
  className,
}: {
  steps: Step[];
  activeIndex: number; // 0-based
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2 text-xs text-white/60", className)}>
      {steps.map((s, i) => {
        const active = i === activeIndex;
        const done = i < activeIndex;

        const pill = (
          <span
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3 py-1",
              done && "border-emerald-400/25 bg-emerald-500/10 text-emerald-200",
              active && "border-indigo-400/25 bg-indigo-500/10 text-indigo-200",
              !active && !done && "border-white/10 bg-white/5 text-white/60"
            )}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                done && "bg-emerald-400",
                active && "bg-indigo-400",
                !active && !done && "bg-white/30"
              )}
            />
            {s.label}
          </span>
        );

        return (
          <div key={s.label} className="inline-flex items-center gap-2">
            {s.href ? <Link href={s.href}>{pill}</Link> : pill}
            {i < steps.length - 1 ? <span className="text-white/25">›</span> : null}
          </div>
        );
      })}
    </div>
  );
}