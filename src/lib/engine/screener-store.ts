import type { ScreenerRow } from "@/lib/types";

/** Estimated round-trip fee in bps (e.g. 8 bps = 0.08% for both legs). */
export const ESTIMATED_FEE_BPS = 8;

/** In-memory store of latest screener rows; updated by Screener when both exchanges have data. */
const rows = new Map<string, ScreenerRow>();

export function setScreenerRow(symbol: string, row: ScreenerRow): void {
  rows.set(symbol, row);
}

export function getScreenerRows(): ScreenerRow[] {
  return Array.from(rows.values());
}

export function clearScreenerStore(): void {
  rows.clear();
}
