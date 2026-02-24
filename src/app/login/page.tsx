"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useToast } from "@/components/ui/Toaster";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { addToast } = useToast();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = (data.error as string) || "Login failed";
        setError(message);
        addToast({ type: "error", message });
        setLoading(false);
        return;
      }
      addToast({ type: "success", message: "Logged in" });
      window.location.href = from || "/";
    } catch {
      const message = "Something went wrong";
      setError(message);
      addToast({ type: "error", message });
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[60dvh] w-full items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-lg">
        <h1 className="mb-6 text-center text-xl font-semibold text-[var(--foreground)]">
          Admin login
        </h1>
        {/* No action prop: use onSubmit + fetch only to avoid "Failed to find Server Action" */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          {error && (
            <p className="rounded-lg border border-[var(--loss)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--loss)]" role="alert">
              {error}
            </p>
          )}
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-[var(--muted)]">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              autoComplete="email"
              required
              disabled={loading}
              className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] disabled:opacity-70"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-[var(--muted)]">Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
              disabled={loading}
              className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] disabled:opacity-70"
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="mt-2 flex items-center justify-center rounded-lg bg-[var(--primary)] px-4 py-2.5 font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[60dvh] items-center justify-center text-[var(--muted)]">Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}
