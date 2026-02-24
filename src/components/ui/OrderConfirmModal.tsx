"use client";

import { useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";

export type OrderConfirmModalProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "buy" | "sell" | "neutral";
  loading?: boolean;
  children?: React.ReactNode;
};

const variantStyles = {
  buy: "border-[var(--profit)] text-[var(--profit)]",
  sell: "border-[var(--loss)] text-[var(--loss)]",
  neutral: "border-[var(--primary)] text-[var(--primary)]",
};

export function OrderConfirmModal({
  open,
  onClose,
  onConfirm,
  title = "Confirm order",
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "neutral",
  loading = false,
  children,
}: OrderConfirmModalProps) {
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [open, handleEscape]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="order-modal-title"
    >
      <div
        className={cn(
          "w-full max-w-[100vw] overflow-hidden rounded-t-2xl bg-[var(--card)] shadow-xl sm:max-w-md sm:rounded-2xl",
          "border-t-4 sm:border-4 sm:border-t-4",
          variantStyles[variant]
        )}
      >
        <div className="max-h-[85vh] overflow-y-auto p-4">
          <h2
            id="order-modal-title"
            className="text-lg font-semibold text-[var(--foreground)]"
          >
            {title}
          </h2>
          {message && (
            <p className="mt-2 text-sm text-[var(--muted)]">{message}</p>
          )}
          {children && <div className="mt-4">{children}</div>}
        </div>
        <div className="flex w-full gap-3 border-t border-[var(--border)] p-4">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 rounded-lg border border-[var(--border)] bg-transparent py-3 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--border)] disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              "flex-1 rounded-lg py-3 text-sm font-medium text-white transition-opacity disabled:opacity-50",
              variant === "buy" && "bg-[var(--profit)] hover:opacity-90",
              variant === "sell" && "bg-[var(--loss)] hover:opacity-90",
              variant === "neutral" && "bg-[var(--primary)] hover:opacity-90"
            )}
          >
            {loading ? "..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
