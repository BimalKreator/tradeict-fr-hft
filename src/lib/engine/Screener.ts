import type {
  ExchangeId,
  FundingMarkPayload,
  FundingArbOpportunity,
  FundingRateSnapshot,
  MarkPriceUpdate,
  FundingIntervalHours,
  FundingPeriodLabel,
  ScreenerRow,
} from "@/lib/types";
import { setScreenerRow, getScreenerRows, ESTIMATED_FEE_BPS } from "./screener-store";

/** In-memory cache of latest funding + mark per exchange/symbol for screener input */
const payloadCache = new Map<string, FundingMarkPayload>();

const MS_4H = 4 * 60 * 60 * 1000;
const MS_8H = 8 * 60 * 60 * 1000;

function cacheKey(exchange: ExchangeId, symbol: string): string {
  return `${exchange}:${symbol}`;
}

function toPayload(snap: FundingRateSnapshot): FundingMarkPayload {
  return {
    exchange: snap.exchange,
    symbol: snap.symbol,
    fundingRate: snap.fundingRate,
    markPrice: snap.markPrice ?? 0,
    nextFundingTime: snap.nextFundingTime,
    timestamp: snap.timestamp,
  };
}

/** Detect funding interval from next funding time (typical 8h or 4h). */
function detectIntervalHours(nextFundingTime: number): FundingIntervalHours {
  const now = Date.now();
  const delta = nextFundingTime - now;
  if (delta <= 0) return 8;
  const near4h = Math.abs(delta - MS_4H) < MS_4H / 2 || Math.abs(delta % MS_4H) < MS_4H / 2;
  return near4h ? 4 : 8;
}

export type ScreenerConfig = {
  /** Minimum spread in bps to consider an opportunity (e.g. 5 = 0.05%) */
  minSpreadBps: number;
  /** Symbols to screen (e.g. ["BTCUSDT", "ETHUSDT"]) */
  symbols: string[];
  /** Exchange pairs to compare (e.g. [["binance","bybit"]]) */
  exchangePairs: [ExchangeId, ExchangeId][];
};

export type ScreenerListener = (opportunity: FundingArbOpportunity) => void;

/**
 * Screener: consumes real-time funding rate and mark price data from WsManager,
 * maintains a cache, computes Gross/Net spread, detects interval and period label,
 * writes rows to the screener store for GET /api/screener, and emits FundingArbOpportunity.
 */
export class Screener {
  private config: ScreenerConfig;
  private listener: ScreenerListener | null = null;

  constructor(config: ScreenerConfig) {
    this.config = config;
  }

  setListener(listener: ScreenerListener | null): void {
    this.listener = listener;
  }

  /** Feed funding rate snapshot (from WsManager). Updates cache, store, and may emit opportunity. */
  onFundingRate(snap: FundingRateSnapshot): void {
    console.log("Received WS data for:", snap.symbol);
    const key = cacheKey(snap.exchange, snap.symbol);
    if (!this.config.symbols.includes(snap.symbol)) return;
    payloadCache.set(key, toPayload(snap));
    this.evaluate(snap.symbol);
  }

  /** Feed mark price update to keep cache fresh when funding tick doesn't include mark. */
  onMarkPrice(update: MarkPriceUpdate): void {
    console.log("Received WS data for:", update.symbol);
    const key = cacheKey(update.exchange, update.symbol);
    const existing = payloadCache.get(key);
    if (!existing || !this.config.symbols.includes(update.symbol)) return;
    payloadCache.set(key, {
      ...existing,
      markPrice: update.markPrice,
      timestamp: update.timestamp,
    });
  }

  private evaluate(symbol: string): void {
    const now = Date.now();
    for (const [exA, exB] of this.config.exchangePairs) {
      const a = payloadCache.get(cacheKey(exA, symbol));
      const b = payloadCache.get(cacheKey(exB, symbol));
      if (!a || !b) continue;

      const binancePayload = exA === "binance" ? a : b;
      const bybitPayload = exA === "bybit" ? a : b;
      const binanceRate = binancePayload.fundingRate;
      const bybitRate = bybitPayload.fundingRate;

      const grossSpreadBps = (binanceRate - bybitRate) * 10000;
      const netSpreadBps = grossSpreadBps - ESTIMATED_FEE_BPS;

      const nextFundingTime = Math.max(a.nextFundingTime, b.nextFundingTime) || now + MS_8H;
      const intervalHours = detectIntervalHours(nextFundingTime);
      const periodLabel: FundingPeriodLabel = nextFundingTime > now ? "Active" : "Next";

      const row: ScreenerRow = {
        symbol,
        binanceRate,
        bybitRate,
        grossSpreadBps,
        netSpreadBps,
        periodLabel,
        intervalHours,
        nextFundingTime,
        updatedAt: now,
      };
      setScreenerRow(symbol, row);

      if (Math.abs(grossSpreadBps) < this.config.minSpreadBps) continue;
      const spreadBps = grossSpreadBps;
      const opportunity: FundingArbOpportunity = {
        longSymbol: symbol,
        shortSymbol: symbol,
        longExchange: spreadBps > 0 ? exB : exA,
        shortExchange: spreadBps > 0 ? exA : exB,
        spreadBps: Math.abs(spreadBps),
        longFundingRate: spreadBps > 0 ? bybitRate : binanceRate,
        shortFundingRate: spreadBps > 0 ? binanceRate : bybitRate,
        longMarkPrice: spreadBps > 0 ? bybitPayload.markPrice : binancePayload.markPrice,
        shortMarkPrice: spreadBps > 0 ? binancePayload.markPrice : bybitPayload.markPrice,
        detectedAt: now,
      };
      this.listener?.(opportunity);
    }
  }

  /**
   * Returns top screener rows (both exchanges have data), sorted by net spread.
   * Used by GET /api/screener to ensure we read from the same instance that receives WS data.
   */
  getTopOpportunities(limit = 20, minSpreadBps?: number): ScreenerRow[] {
    let rows = getScreenerRows();
    if (minSpreadBps != null && Number.isFinite(minSpreadBps)) {
      rows = rows.filter((r) => Math.abs(r.netSpreadBps) >= minSpreadBps);
    }
    rows = [...rows].sort((a, b) => b.netSpreadBps - a.netSpreadBps);
    const result = rows.slice(0, limit);
    console.log("Screener returning opportunities:", result.length);
    return result;
  }

  getConfig(): ScreenerConfig {
    return { ...this.config };
  }

  updateConfig(partial: Partial<ScreenerConfig>): void {
    this.config = { ...this.config, ...partial };
  }
}
