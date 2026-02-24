import * as fs from "fs/promises";
import * as path from "path";
import type { ScreenerRow } from "@/lib/types";

/** Estimated round-trip fee in bps (e.g. 8 bps = 0.08% for both legs). */
export const ESTIMATED_FEE_BPS = 8;

const STORE_KEY = "__SCREENER_STORE_ROWS__";
const SCREENER_LIVE_FILE = path.join(process.cwd(), "data", "screener_live.json");
const PERSIST_DEBOUNCE_MS = 400;

let persistTimer: ReturnType<typeof setTimeout> | null = null;

function getStore(): Map<string, ScreenerRow> {
  const g = globalThis as Record<string, unknown>;
  if (!g[STORE_KEY]) g[STORE_KEY] = new Map<string, ScreenerRow>();
  return g[STORE_KEY] as Map<string, ScreenerRow>;
}

async function persistToFile(): Promise<void> {
  try {
    const rows = Array.from(getStore().values());
    await fs.mkdir(path.dirname(SCREENER_LIVE_FILE), { recursive: true });
    await fs.writeFile(SCREENER_LIVE_FILE, JSON.stringify(rows), "utf8");
  } catch {
    // ignore write errors
  }
}

function schedulePersist(): void {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    void persistToFile();
  }, PERSIST_DEBOUNCE_MS);
}

/** In-memory store on globalThis; also persisted to file for cross-context (e.g. API worker) reads. */
export function setScreenerRow(symbol: string, row: ScreenerRow): void {
  getStore().set(symbol, row);
  schedulePersist();
}

export function getScreenerRows(): ScreenerRow[] {
  return Array.from(getStore().values());
}

export function clearScreenerStore(): void {
  getStore().clear();
}

/**
 * Read screener rows from file. Used by API route when globalThis store is empty
 * (Next.js can run API routes in a different worker than the one holding the WebSocket).
 */
export async function getScreenerRowsFromFile(): Promise<ScreenerRow[]> {
  try {
    const raw = await fs.readFile(SCREENER_LIVE_FILE, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (r): r is ScreenerRow =>
        r != null &&
        typeof r === "object" &&
        typeof (r as ScreenerRow).symbol === "string" &&
        typeof (r as ScreenerRow).netSpreadBps === "number"
    );
  } catch {
    return [];
  }
}
