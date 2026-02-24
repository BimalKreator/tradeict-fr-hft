import * as fs from "fs";
import * as fsp from "fs/promises";
import * as path from "path";
import type { ScreenerRow } from "@/lib/types";

/** Estimated round-trip fee in bps (e.g. 8 bps = 0.08% for both legs). */
export const ESTIMATED_FEE_BPS = 8;

const STORE_KEY = "__SCREENER_STORE_ROWS__";
/** Throttle: persist at most once every 2s to avoid disk thrash from high WS volume. */
const PERSIST_THROTTLE_MS = 2000;

/** Resolve at runtime so all workers/contexts use the same project path. */
function getScreenerLiveFilePath(): string {
  return path.join(process.cwd(), "data", "screener_live.json");
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;
let lastPersistTime = 0;

function getStore(): Map<string, ScreenerRow> {
  const g = globalThis as Record<string, unknown>;
  if (!g[STORE_KEY]) g[STORE_KEY] = new Map<string, ScreenerRow>();
  return g[STORE_KEY] as Map<string, ScreenerRow>;
}

async function persistToFile(): Promise<void> {
  const filePath = getScreenerLiveFilePath();
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const rows = Array.from(getStore().values());
    await fsp.writeFile(filePath, JSON.stringify(rows), "utf8");
    console.log("Successfully wrote to screener_live.json");
  } catch (e) {
    console.error("[screener-store] persist failed:", filePath, e);
  }
}

/** Schedules a single persist at most once every PERSIST_THROTTLE_MS. */
function schedulePersist(): void {
  const now = Date.now();
  const elapsed = now - lastPersistTime;
  if (elapsed >= PERSIST_THROTTLE_MS) {
    lastPersistTime = now;
    void persistToFile();
    return;
  }
  if (persistTimer != null) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    lastPersistTime = Date.now();
    void persistToFile();
  }, PERSIST_THROTTLE_MS - elapsed);
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
  const filePath = getScreenerLiveFilePath();
  try {
    const raw = await fsp.readFile(filePath, "utf8");
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
