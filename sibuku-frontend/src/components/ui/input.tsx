import * as React from "react";
import { cn } from "@/lib/cn";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        // IMPORTANT: props HARUS di-spread ke input agar value/onChange bekerja
        {...props}
        className={cn(
          "w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white outline-none",
          "placeholder:text-white/35",
          "focus:border-indigo-400/50 focus:ring-2 focus:ring-indigo-500/30",
          "disabled:opacity-60 disabled:cursor-not-allowed",
          className
        )}
      />
    );
  }
);

Input.displayName = "Input";
export default Input;
