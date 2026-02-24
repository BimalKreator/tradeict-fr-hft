import type { ScreenerRow } from "@/lib/types";

/** Estimated round-trip fee in bps (e.g. 8 bps = 0.08% for both legs). */
export const ESTIMATED_FEE_BPS = 8;

const STORE_KEY = "__SCREENER_STORE_ROWS__";

function getStore(): Map<string, ScreenerRow> {
  const g = globalThis as Record<string, unknown>;
  if (!g[STORE_KEY]) g[STORE_KEY] = new Map<string, ScreenerRow>();
  return g[STORE_KEY] as Map<string, ScreenerRow>;
}

/** In-memory store on globalThis so API route and BotController share the same data. */
export function setScreenerRow(symbol: string, row: ScreenerRow): void {
  getStore().set(symbol, row);
}

export function getScreenerRows(): ScreenerRow[] {
  return Array.from(getStore().values());
}

export function clearScreenerStore(): void {
  getStore().clear();
}
