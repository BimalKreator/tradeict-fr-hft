"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/Toaster";

/** API keys: client-side fetch only to /api/keys/test and /api/keys/save. No Server Actions. */

type TestResult = {
  ok: boolean;
  binance?: { error?: string; warning?: string; hedgeMode?: boolean };
  bybit?: { error?: string; warning?: string; hedgeMode?: boolean | null };
};

export default function ExchangeSetupPage() {
  const { addToast } = useToast();
  const [binanceApiKey, setBinanceApiKey] = useState("");
  const [binanceSecretKey, setBinanceSecretKey] = useState("");
  const [bybitApiKey, setBybitApiKey] = useState("");
  const [bybitSecret, setBybitSecret] = useState("");
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  const hasBinance = !!binanceApiKey.trim() && !!binanceSecretKey.trim();
  const hasBybit = !!bybitApiKey.trim() && !!bybitSecret.trim();
  const canSave = hasBinance || hasBybit;

  async function handleTest() {
    if (testing) return;
    setTesting(true);
    try {
      const body: Record<string, unknown> = {};
      if (hasBinance) body.binance = { apiKey: binanceApiKey.trim(), secretKey: binanceSecretKey.trim() };
      if (hasBybit) body.bybit = { apiKey: bybitApiKey.trim(), secret: bybitSecret.trim() };
      const res = await fetch("/api/keys/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data: TestResult = await res.json();
      if (data.binance?.error) {
        addToast({ type: "error", message: `Binance: ${data.binance.error}` });
      }
      if (data.binance?.warning) {
        addToast({ type: "info", message: `Binance: ${data.binance.warning}` });
      }
      if (data.binance?.hedgeMode) {
        addToast({ type: "success", message: "Binance: Futures & Hedge Mode OK" });
      }
      if (data.bybit?.error) {
        addToast({ type: "error", message: `Bybit: ${data.bybit.error}` });
      }
      if (data.bybit?.warning) {
        addToast({ type: "info", message: `Bybit: ${data.bybit.warning}` });
      }
      if (data.bybit?.hedgeMode) {
        addToast({ type: "success", message: "Bybit: Account & Hedge Mode OK" });
      }
      if (data.ok && !data.binance?.error && !data.bybit?.error) {
        addToast({ type: "success", message: "All checks passed" });
      }
    } catch {
      addToast({ type: "error", message: "Test request failed" });
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {};
      if (hasBinance) body.binance = { apiKey: binanceApiKey.trim(), secretKey: binanceSecretKey.trim() };
      if (hasBybit) body.bybit = { apiKey: bybitApiKey.trim(), secret: bybitSecret.trim() };
      const res = await fetch("/api/keys/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        addToast({ type: "error", message: (data.error as string) || "Failed to save keys" });
        setSaving(false);
        return;
      }
      addToast({ type: "success", message: "API keys saved securely" });
    } catch {
      addToast({ type: "error", message: "Save request failed" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-full max-w-[100vw] overflow-x-hidden px-4">
      <h2 className="text-lg font-semibold text-[var(--foreground)]">Exchange Setup</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Configure API keys for Binance and Bybit. Keys are encrypted and saved locally.
      </p>

      <div className="mt-6 space-y-6">
        <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
          <h3 className="text-sm font-medium text-[var(--foreground)]">Binance Futures</h3>
          <div className="mt-3 flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-[var(--muted)]">API Key</span>
              <input
                type="password"
                value={binanceApiKey}
                onChange={(e) => setBinanceApiKey(e.target.value)}
                placeholder="Binance API key"
                autoComplete="off"
                className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-[var(--muted)]">Secret Key</span>
              <input
                type="password"
                value={binanceSecretKey}
                onChange={(e) => setBinanceSecretKey(e.target.value)}
                placeholder="Binance secret key"
                autoComplete="off"
                className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
              />
            </label>
          </div>
        </section>

        <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
          <h3 className="text-sm font-medium text-[var(--foreground)]">Bybit (Linear)</h3>
          <div className="mt-3 flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-[var(--muted)]">API Key</span>
              <input
                type="password"
                value={bybitApiKey}
                onChange={(e) => setBybitApiKey(e.target.value)}
                placeholder="Bybit API key"
                autoComplete="off"
                className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-[var(--muted)]">Secret</span>
              <input
                type="password"
                value={bybitSecret}
                onChange={(e) => setBybitSecret(e.target.value)}
                placeholder="Bybit secret"
                autoComplete="off"
                className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
              />
            </label>
          </div>
        </section>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleTest}
            disabled={testing}
            className="rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {testing ? "Testing…" : "Test Connection"}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave || saving}
            className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 py-2.5 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--border)] disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save keys"}
          </button>
        </div>
      </div>
    </div>
  );
}
