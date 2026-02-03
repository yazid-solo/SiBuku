"use client";
import { cn } from "@/lib/utils";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
};

export default function Button({ className, variant = "primary", ...props }: Props) {
  const base =
    "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition active:scale-[0.98]";
  const variants = {
    primary: "bg-indigo-500 hover:bg-indigo-400 text-white",
    secondary: "bg-white/10 hover:bg-white/15 text-white border border-white/10",
    ghost: "hover:bg-white/10 text-white",
  };
  return <button className={cn(base, variants[variant], className)} {...props} />;
}
