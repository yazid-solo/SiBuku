import React from "react";
import { cn } from "@/lib/utils";

type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: "default" | "success" | "warning" | "danger" | "info";
};

const variants: Record<NonNullable<BadgeProps["variant"]>, string> = {
  default: "bg-indigo-500/15 text-indigo-200 border border-indigo-400/20",
  info: "bg-sky-500/15 text-sky-200 border border-sky-400/20",
  success: "bg-emerald-500/15 text-emerald-200 border border-emerald-400/20",
  warning: "bg-amber-500/15 text-amber-200 border border-amber-400/20",
  danger: "bg-rose-500/15 text-rose-200 border border-rose-400/20",
};

export default function Badge({
  className,
  variant = "default",
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}