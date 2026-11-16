"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastTone = "success" | "error" | "info";
type Toast = { id: number; message: string; tone: ToastTone };

type ToastContextValue = {
  toast: (message: string, tone?: ToastTone) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

let counter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, tone: ToastTone = "success") => {
      counter += 1;
      const id = counter;
      setToasts((current) => [...current.slice(-3), { id, message, tone }]);
      window.setTimeout(() => dismiss(id), 5000);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:items-end"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((item) => (
          <div
            key={item.id}
            className={cn(
              "pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-xl border px-4 py-3 text-sm shadow-lg animate-fade-in",
              item.tone === "success" && "border-forest-100 bg-white text-forest-900",
              item.tone === "error" && "border-red-200 bg-white text-red-800",
              item.tone === "info" && "border-stone-200 bg-white text-ink",
            )}
            role={item.tone === "error" ? "alert" : "status"}
          >
            {item.tone === "success" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-forest-600" /> : null}
            {item.tone === "error" ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" /> : null}
            {item.tone === "info" ? <Info className="mt-0.5 h-4 w-4 shrink-0 text-stone-500" /> : null}
            <span className="flex-1">{item.message}</span>
            <button
              onClick={() => dismiss(item.id)}
              aria-label="Dismiss notification"
              className="rounded p-0.5 text-stone-400 hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
