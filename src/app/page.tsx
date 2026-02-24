"use client";

import { useEffect, useState } from "react";

type ScreenerRow = {
  symbol: string;
  binanceRate: number;
  bybitRate: number;
  grossSpreadBps: number;
  netSpreadBps: number;
  periodLabel: string;
  intervalHours: number;
  nextFundingTime: number;
  updatedAt: number;
};

function formatRate(rate: number): string {
  return (rate * 100).toFixed(4) + "%";
}

function formatSpreadBps(bps: number): string {
  const sign = bps >= 0 ? "+" : "";
  return `${sign}${bps.toFixed(2)} bps`;
}

function useCountdown(nextFundingTime: number) {
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.floor((nextFundingTime - Date.now()) / 1000))
  );
  useEffect(() => {
    const tick = () => {
      const s = Math.max(0, Math.floor((nextFundingTime - Date.now()) / 1000));
      setSecondsLeft(s);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [nextFundingTime]);
  const h = Math.floor(secondsLeft / 3600);
  const m = Math.floor((secondsLeft % 3600) / 60);
  const s = secondsLeft % 60;
  return `${h}h ${m}m ${s}s`;
}

function Countdown({ nextFundingTime }: { nextFundingTime: number }) {
  const text = useCountdown(nextFundingTime);
  return <span className="tabular-nums">{text}</span>;
}

export default function Home() {
  const [data, setData] = useState<{ rows: ScreenerRow[]; total: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchScreener = async () => {
      try {
        const res = await fetch("/api/screener?limit=20");
        if (!res.ok) throw new Error("Failed to load screener");
        const json = await res.json();
        setData({ rows: json.rows ?? [], total: json.total ?? 0 });
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error loading data");
      } finally {
        setLoading(false);
      }
    };

    fetchScreener();
    const interval = setInterval(fetchScreener, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full max-w-[100vw] overflow-x-hidden px-4">
      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">Funding screener</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Top 20 pairs by net spread (Binance − Bybit). Updates every 5s.
        </p>

        {loading && !data && (
          <p className="mt-4 text-sm text-[var(--muted)]">Loading…</p>
        )}
        {error && (
          <p className="mt-4 text-sm text-[var(--loss)]" role="alert">{error}</p>
        )}

        {data && data.rows.length === 0 && !loading && (
          <p className="mt-4 text-sm text-[var(--muted)]">
            No pairs with both exchanges yet. Connect market data to populate.
          </p>
        )}

        {data && data.rows.length > 0 && (
          <div className="mt-4 w-full overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-[var(--muted)]">
                  <th className="py-2 pr-2 font-medium">Symbol</th>
                  <th className="py-2 pr-2 font-medium">Binance</th>
                  <th className="py-2 pr-2 font-medium">Bybit</th>
                  <th className="py-2 pr-2 font-medium">Net spread</th>
                  <th className="py-2 pr-2 font-medium">Period</th>
                  <th className="py-2 font-medium">Next funding</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr
                    key={row.symbol}
                    className="border-b border-[var(--border)] last:border-b-0"
                  >
                    <td className="py-2.5 pr-2 font-medium text-[var(--foreground)]">
                      {row.symbol}
                    </td>
                    <td className="py-2.5 pr-2 tabular-nums text-[var(--foreground)]">
                      {formatRate(row.binanceRate)}
                    </td>
                    <td className="py-2.5 pr-2 tabular-nums text-[var(--foreground)]">
                      {formatRate(row.bybitRate)}
                    </td>
                    <td className="py-2.5 pr-2 tabular-nums">
                      <span
                        style={{
                          color: row.netSpreadBps >= 0 ? "#22c55e" : "#ef4444",
                        }}
                      >
                        {formatSpreadBps(row.netSpreadBps)}
                      </span>
                    </td>
                    <td className="py-2.5 pr-2 text-[var(--muted)]">{row.periodLabel}</td>
                    <td className="py-2.5 text-[var(--muted)]">
                      <Countdown nextFundingTime={row.nextFundingTime} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.total > data.rows.length && (
              <p className="mt-2 text-xs text-[var(--muted)]">
                Showing top {data.rows.length} of {data.total} pairs.
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
