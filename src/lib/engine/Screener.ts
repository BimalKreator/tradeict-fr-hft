import type {
  ExchangeId,
  FundingMarkPayload,
  FundingArbOpportunity,
  FundingRateSnapshot,
  MarkPriceUpdate,
} from "@/lib/types";

/** In-memory cache of latest funding + mark per exchange/symbol for screener input */
const payloadCache = new Map<string, FundingMarkPayload>();

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
 * Screener: consumes real-time funding rate and mark price data, maintains a cache,
 * and emits FundingArbOpportunity when the spread between two exchanges exceeds threshold.
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

  /** Feed funding rate snapshot (from WsManager). Updates cache and may emit opportunity. */
  onFundingRate(snap: FundingRateSnapshot): void {
    const key = cacheKey(snap.exchange, snap.symbol);
    if (!this.config.symbols.includes(snap.symbol)) return;
    payloadCache.set(key, toPayload(snap));
    this.evaluate(snap.symbol);
  }

  /** Feed mark price update to keep cache fresh when funding tick doesn’t include mark. */
  onMarkPrice(update: MarkPriceUpdate): void {
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
    for (const [exA, exB] of this.config.exchangePairs) {
      const a = payloadCache.get(cacheKey(exA, symbol));
      const b = payloadCache.get(cacheKey(exB, symbol));
      if (!a || !b) continue;
      const spreadBps = (a.fundingRate - b.fundingRate) * 10000;
      if (Math.abs(spreadBps) < this.config.minSpreadBps) continue;
      const opportunity: FundingArbOpportunity = {
        longSymbol: symbol,
        shortSymbol: symbol,
        longExchange: spreadBps > 0 ? exB : exA,
        shortExchange: spreadBps > 0 ? exA : exB,
        spreadBps: Math.abs(spreadBps),
        longFundingRate: spreadBps > 0 ? b.fundingRate : a.fundingRate,
        shortFundingRate: spreadBps > 0 ? a.fundingRate : b.fundingRate,
        longMarkPrice: spreadBps > 0 ? b.markPrice : a.markPrice,
        shortMarkPrice: spreadBps > 0 ? a.markPrice : b.markPrice,
        detectedAt: Date.now(),
      };
      this.listener?.(opportunity);
    }
  }

  getConfig(): ScreenerConfig {
    return { ...this.config };
  }

  updateConfig(partial: Partial<ScreenerConfig>): void {
    this.config = { ...this.config, ...partial };
  }
}
