export default function Home() {
  return (
    <div className="w-full max-w-[100vw] overflow-x-hidden px-4">
      <section className="rounded-xl bg-[var(--card)] p-4 border border-[var(--border)]">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">
          Trading
        </h2>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Crypto trading bot – mobile-first PWA. Use the bottom nav to open Orders, Portfolio, and History.
        </p>
      </section>
    </div>
  );
}
