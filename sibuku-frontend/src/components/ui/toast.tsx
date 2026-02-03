"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

type ToastVariant = "success" | "error" | "info";

type ToastItem = {
  id: string;
  title?: string;
  message: string;
  variant: ToastVariant;
};

type ToastCtx = {
  toast: (t: { title?: string; message: string; variant?: ToastVariant }) => void;
};

const ToastContext = createContext<ToastCtx | null>(null);

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (t: { title?: string; message: string; variant?: ToastVariant }) => {
      const id = uid();
      const item: ToastItem = {
        id,
        title: t.title,
        message: t.message,
        variant: t.variant ?? "info",
      };

      setToasts((prev) => [item, ...prev].slice(0, 4));
      window.setTimeout(() => remove(id), 3500);
    },
    [remove]
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/* viewport */}
      <div
        className="fixed top-4 right-4 z-[100] flex w-[340px] max-w-[calc(100vw-2rem)] flex-col gap-2"
        aria-live="polite"
        aria-relevant="additions"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "glass rounded-2xl p-4 shadow-lg ring-1",
              t.variant === "success" && "ring-emerald-500/30",
              t.variant === "error" && "ring-rose-500/30",
              t.variant === "info" && "ring-white/10"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                {t.title && <div className="font-semibold">{t.title}</div>}
                <div className="text-sm text-white/70 break-words">{t.message}</div>
              </div>

              <button
                className="p-1 rounded-lg hover:bg-white/5"
                onClick={() => remove(t.id)}
                aria-label="Close toast"
                type="button"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast() must be used inside <ToastProvider />");
  return ctx;
}
