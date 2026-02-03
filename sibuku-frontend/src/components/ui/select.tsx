"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

export type SelectOption = {
  value: string;
  label: string;
  subLabel?: string;
};

type SelectProps = {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  buttonClassName?: string;
};

type Pos = { top: number; left: number; width: number; openUp: boolean };

export default function Select({
  value,
  onChange,
  options,
  placeholder = "Pilih...",
  disabled = false,
  className,
  buttonClassName,
}: SelectProps) {
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const btnRef = React.useRef<HTMLButtonElement | null>(null);
  const menuRef = React.useRef<HTMLDivElement | null>(null);

  const [open, setOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const [pos, setPos] = React.useState<Pos | null>(null);

  const selected = React.useMemo(
    () => options.find((o) => o.value === value),
    [options, value]
  );

  React.useEffect(() => setMounted(true), []);

  const updatePos = React.useCallback(() => {
    const el = btnRef.current;
    if (!el) return;

    const r = el.getBoundingClientRect();
    const maxH = 288; // ~ max-h-72
    const gap = 8;

    const spaceBelow = window.innerHeight - r.bottom;
    const spaceAbove = r.top;

    const openUp = spaceBelow < 220 && spaceAbove > spaceBelow;

    const top = openUp
      ? Math.max(gap, r.top - gap - maxH)
      : r.bottom + gap;

    setPos({ top, left: r.left, width: r.width, openUp });
  }, []);

  React.useEffect(() => {
    if (!open) return;

    updatePos();

    const onScrollOrResize = () => updatePos();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);

    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open, updatePos]);

  // ✅ FIX: klik di menu portal dianggap "inside" (tidak auto close sebelum onClick)
  React.useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpen(false);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const menu =
    open && mounted && pos
      ? createPortal(
          <div
            ref={menuRef}
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              width: pos.width,
              zIndex: 9999,
            }}
            className={cn(
              "rounded-xl border border-white/10 bg-slate-950/95 backdrop-blur shadow-2xl",
              "overflow-hidden"
            )}
          >
            <ul className="max-h-72 overflow-auto py-1">
              {options.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <li key={opt.value}>
                    <button
                      type="button"
                      onClick={() => {
                        onChange(opt.value);
                        setOpen(false);
                      }}
                      className={cn(
                        "w-full px-3 py-2 text-left flex items-start gap-2",
                        "hover:bg-white/5 transition",
                        isSelected && "bg-white/5"
                      )}
                    >
                      <span className="mt-0.5 h-4 w-4 shrink-0">
                        {isSelected ? (
                          <Check className="h-4 w-4 text-indigo-300" />
                        ) : null}
                      </span>

                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-white/90 truncate">
                          {opt.label}
                        </span>
                        {opt.subLabel ? (
                          <span className="block text-[11px] text-white/50 truncate">
                            {opt.subLabel}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>,
          document.body
        )
      : null;

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setOpen((v) => !v);
        }}
        className={cn(
          "w-full rounded-xl px-4 py-2",
          "bg-white/5 border border-white/10 text-slate-100",
          "outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40",
          "flex items-center justify-between gap-3",
          disabled && "opacity-50 cursor-not-allowed",
          buttonClassName
        )}
      >
        <span className="min-w-0 text-left">
          <span className="block text-sm font-semibold truncate">
            {selected?.label ?? placeholder}
          </span>
          <span className="block text-[11px] text-white/50 truncate">
            {selected?.subLabel ?? (selected ? "" : "Klik untuk memilih")}
          </span>
        </span>

        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-white/70 transition",
            open && "rotate-180"
          )}
        />
      </button>

      {menu}
    </div>
  );
}
