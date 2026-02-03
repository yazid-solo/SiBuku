import { cn } from "@/lib/utils";

export default function Badge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn("inline-flex items-center rounded-full bg-indigo-500/15 text-indigo-200 px-3 py-1 text-xs border border-indigo-400/20", className)}
      {...props}
    />
  );
}
