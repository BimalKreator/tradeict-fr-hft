"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { cn } from "@/lib/utils";

export type ToastType = "success" | "error" | "info" | "loading";

export type Toast = {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
};

type ToastContextValue = {
  toasts: Toast[];
  addToast: (t: Omit<Toast, "id">) => string;
  removeToast: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within Toaster");
  return ctx;
}

const typeStyles: Record<ToastType, string> = {
  success: "border-[var(--profit)] text-[var(--profit)]",
  error: "border-[var(--loss)] text-[var(--loss)]",
  info: "border-[var(--primary)] text-[var(--primary)]",
  loading: "border-[var(--muted)] text-[var(--muted)]",
};

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: string) => void;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex w-full max-w-[calc(100vw-2rem)] items-center gap-3 rounded-lg border-l-4 bg-[var(--card)] px-4 py-3 shadow-lg",
        typeStyles[toast.type]
      )}
    >
      <span className="flex-1 text-sm font-medium text-[var(--foreground)]">
        {toast.message}
      </span>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 rounded p-1 text-[var(--muted)] hover:bg-[var(--border)] hover:text-[var(--foreground)]"
        aria-label="Dismiss"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}

function ToastProviderInner({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((t: Omit<Toast, "id">) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const toast: Toast = { ...t, id };
    setToasts((prev) => [...prev, toast]);
    const duration = t.duration ?? 5000;
    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== id));
      }, duration);
    }
    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <div
        className="fixed bottom-24 left-0 right-0 z-[80] flex w-full max-w-[100vw] flex-col items-center gap-2 px-4 pb-2 md:bottom-4"
        aria-live="polite"
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  return <ToastProviderInner>{children}</ToastProviderInner>;
}
