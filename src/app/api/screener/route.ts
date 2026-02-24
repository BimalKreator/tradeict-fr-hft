import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { BotController } from "@/lib/engine/BotController";
import { getScreenerRows } from "@/lib/engine/screener-store";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

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

    let rows = getScreenerRows();

    if (minBps != null && Number.isFinite(minBps)) {
      rows = rows.filter((r) => Math.abs(r.netSpreadBps) >= minBps);
    }

    rows = [...rows].sort((a, b) => b.netSpreadBps - a.netSpreadBps);
    const paginated = rows.slice(0, limit);

    return NextResponse.json({
      rows: paginated,
      total: rows.length,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Screener failed" },
      { status: 500 }
    );
  }
}
