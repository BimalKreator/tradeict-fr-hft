"use client";

import { cn } from "@/lib/utils";

type SpinnerSize = "sm" | "md" | "lg";

const sizeClasses: Record<SpinnerSize, string> = {
  sm: "h-5 w-5 border-2",
  md: "h-8 w-8 border-2",
  lg: "h-12 w-12 border-[3px]",
};

export function Spinner({
  size = "md",
  className,
}: {
  size?: SpinnerSize;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "animate-spin rounded-full border-[var(--primary)] border-t-transparent",
        sizeClasses[size],
        className
      )}
      role="status"
      aria-label="Loading"
    />
  );
}

export function SpinnerOverlay({ message }: { message?: string }) {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-[var(--background)]/90 backdrop-blur-sm">
      <Spinner size="lg" />
      {message && (
        <p className="text-sm text-[var(--muted)]">{message}</p>
      )}
    </div>
  );
}
