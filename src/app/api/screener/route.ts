import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { BotController } from "@/lib/engine/BotController";
import { getScreenerRowsFromFile } from "@/lib/engine/screener-store";
import type { ScreenerRow } from "@/lib/types";

const SCREENER_KEY = "__SCREENER__";
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function applyFilterSortLimit(
  rows: ScreenerRow[],
  limit: number,
  minSpreadBps?: number
): ScreenerRow[] {
  let out = rows;
  if (minSpreadBps != null && Number.isFinite(minSpreadBps)) {
    out = out.filter((r) => Math.abs(r.netSpreadBps) >= minSpreadBps);
  }
  out = [...out].sort((a, b) => b.netSpreadBps - a.netSpreadBps);
  return out.slice(0, limit);
}

export async function GET(request: NextRequest) {
  try {
    const controller = BotController.getInstance();
    if (!controller.isInitialized()) {
      controller.init();
    }

    const { searchParams } = new URL(request.url);
    const minSpreadBps = searchParams.get("minSpreadBps");
    const limitParam = searchParams.get("limit");

    const minBps = minSpreadBps != null ? Number(minSpreadBps) : undefined;
    const limit = Math.min(
      limitParam != null ? Math.max(1, parseInt(limitParam, 10) || DEFAULT_LIMIT) : DEFAULT_LIMIT,
      MAX_LIMIT
    );

    const screener = (globalThis as Record<string, unknown>)[SCREENER_KEY] as
      | { getTopOpportunities: (limit: number, minSpreadBps?: number) => ScreenerRow[] }
      | undefined;

    let inMemory: ScreenerRow[] =
      screener && typeof screener.getTopOpportunities === "function"
        ? screener.getTopOpportunities(MAX_LIMIT, minBps)
        : [];
    const fileRows = await getScreenerRowsFromFile();
    const bySymbol = new Map<string, ScreenerRow>();
    for (const row of fileRows) bySymbol.set(row.symbol, row);
    for (const row of inMemory) bySymbol.set(row.symbol, row);
    const opportunities = applyFilterSortLimit(Array.from(bySymbol.values()), limit, minBps);

    return NextResponse.json({ data: opportunities });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Screener failed" },
      { status: 500 }
    );
  }
}
