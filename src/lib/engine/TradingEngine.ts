import type { EntryDecision, FundingArbOpportunity, ExitSignal } from "@/lib/types";
import type { OrderManager } from "./OrderManager";
import type { Monitor } from "./Monitor";

/**
 * DATA FLOW (HFT funding arbitrage):
 *
 * 1. Funding rate (and mark price) — Real-time streams from Binance/Bybit via WebSocket
 *    (BinanceWS, BybitWS, WsManager) deliver FundingRateSnapshot and MarkPriceUpdate.
 *
 * 2. Screener — Consumes these updates, caches per exchange/symbol, and compares funding
 *    rates across exchanges. When spread exceeds threshold, it emits FundingArbOpportunity.
 *
 * 3. Entry decision — TradingEngine receives the opportunity and decides whether to enter
 *    (size, side, slippage). Output: EntryDecision (long_short or short_long, sizeBase, etc.).
 *
 * 4. Order placement — OrderManager receives OrderRequest(s) derived from EntryDecision and
 *    places market/limit orders on each exchange (API or WS order flow).
 *
 * 5. Monitoring — Monitor holds position state, receives fills and mark updates, computes
 *    real-time PnL and checks exit conditions (target, stop, funding flip, timeout).
 *
 * 6. Exit — Monitor emits ExitSignal; TradingEngine (or orchestrator) triggers OrderManager
 *    to close positions (reduce-only orders), completing the cycle.
 */

export type TradingEngineConfig = {
  defaultSizeBase: number;
  maxSlippageBps: number;
  maxOpenOpportunities: number;
};

export type TradingEngineListener = {
  onEntryDecision?: (decision: EntryDecision) => void;
  onExitSignal?: (signal: ExitSignal) => void;
};

/**
 * TradingEngine: entry/exit logic. Consumes opportunities from Screener,
 * produces EntryDecision for OrderManager; consumes ExitSignal from Monitor to close.
 */
export class TradingEngine {
  private config: TradingEngineConfig;
  private orderManager: OrderManager | null = null;
  private monitor: Monitor | null = null;
  private listener: TradingEngineListener = {};
  private openCount = 0;

  constructor(config: TradingEngineConfig) {
    this.config = config;
  }

  setOrderManager(om: OrderManager | null): void {
    this.orderManager = om;
  }

  setMonitor(monitor: Monitor | null): void {
    this.monitor = monitor;
  }

  setListener(listener: TradingEngineListener): void {
    this.listener = listener;
  }

  /** Called by Screener when an opportunity is found. */
  onOpportunity(opportunity: FundingArbOpportunity): void {
    if (this.openCount >= this.config.maxOpenOpportunities) return;
    const decision: EntryDecision = {
      opportunity,
      side: "long_short",
      sizeBase: this.config.defaultSizeBase,
      maxSlippageBps: this.config.maxSlippageBps,
      requestedAt: Date.now(),
    };
    this.openCount++;
    this.listener.onEntryDecision?.(decision);
    this.orderManager?.placeFromEntry(decision);
  }

  /** Called by Monitor when exit conditions are met. */
  onExitSignal(signal: ExitSignal): void {
    this.openCount = Math.max(0, this.openCount - 1);
    this.listener.onExitSignal?.(signal);
    this.orderManager?.closeFromExit(signal);
  }

  getConfig(): TradingEngineConfig {
    return { ...this.config };
  }

  updateConfig(partial: Partial<TradingEngineConfig>): void {
    this.config = { ...this.config, ...partial };
  }
}
