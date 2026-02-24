import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { BotController } from "@/lib/engine/BotController";

const SCREENER_KEY = "__SCREENER__";
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export async function GET(request: NextRequest) {
  try {
    const controller = BotController.getInstance();
    if (!controller.isInitialized()) {
      controller.init();
    }

    const screener = (globalThis as Record<string, unknown>)[SCREENER_KEY] as
      | { getTopOpportunities: (limit: number, minSpreadBps?: number) => unknown[] }
      | undefined;

    const { searchParams } = new URL(request.url);
    const minSpreadBps = searchParams.get("minSpreadBps");
    const limitParam = searchParams.get("limit");

    const minBps = minSpreadBps != null ? Number(minSpreadBps) : undefined;
    const limit = Math.min(
      limitParam != null ? Math.max(1, parseInt(limitParam, 10) || DEFAULT_LIMIT) : DEFAULT_LIMIT,
      MAX_LIMIT
    );

    const opportunities =
      screener && typeof screener.getTopOpportunities === "function"
        ? screener.getTopOpportunities(limit, minBps)
        : [];

    return NextResponse.json({ data: opportunities });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Screener failed" },
      { status: 500 }
    );
  }
}
