import type {
  ExchangeId,
  PositionSnapshot,
  OrderUpdate,
  MarkPriceUpdate,
  ExitSignal,
} from "@/lib/types";

export type MonitorConfig = {
  pnlTargetBps: number;
  pnlStopBps: number;
  exitOnFundingFlip: boolean;
  maxHoldMs: number;
};

export type MonitorListener = (signal: ExitSignal) => void;

/** Internal position state for PnL and exit logic */
interface OpenPosition {
  positionId: string;
  longExchange: ExchangeId;
  shortExchange: ExchangeId;
  longSymbol: string;
  shortSymbol: string;
  longSize: number;
  shortSize: number;
  longEntryPrice: number;
  shortEntryPrice: number;
  openedAt: number;
  longMarkPrice: number;
  shortMarkPrice: number;
}

/**
 * Monitor: holds open position state, receives OrderUpdate (fills) and MarkPriceUpdate,
 * computes real-time PnL and emits ExitSignal when exit conditions are met.
 */
export class Monitor {
  private config: MonitorConfig;
  private listener: MonitorListener | null = null;
  private positions = new Map<string, OpenPosition>();

  constructor(config: MonitorConfig) {
    this.config = config;
  }

  setListener(listener: MonitorListener | null): void {
    this.listener = listener;
  }

  /** Register a new position (called when entry fills are confirmed). */
  registerPosition(position: OpenPosition): void {
    this.positions.set(position.positionId, position);
  }

  /** Update from order fill; update entry size/price and optionally trigger exit check. */
  onOrderUpdate(update: OrderUpdate): void {
    // Match update to open position and update filled qty / avg price.
    // Then call this.evaluatePosition(positionId).
    void update;
  }

  /** Update mark prices for PnL and exit logic. */
  onMarkPrice(update: MarkPriceUpdate): void {
    for (const pos of this.positions.values()) {
      if (pos.longExchange === update.exchange && pos.longSymbol === update.symbol) {
        pos.longMarkPrice = update.markPrice;
      }
      if (pos.shortExchange === update.exchange && pos.shortSymbol === update.symbol) {
        pos.shortMarkPrice = update.markPrice;
      }
    }
    this.positions.forEach((_, id) => this.evaluatePosition(id));
  }

  /** Compute current PnL for a position (both legs). */
  getUnrealizedPnl(positionId: string): number {
    const pos = this.positions.get(positionId);
    if (!pos) return 0;
    const longPnl = (pos.longMarkPrice - pos.longEntryPrice) * pos.longSize;
    const shortPnl = (pos.shortEntryPrice - pos.shortMarkPrice) * pos.shortSize;
    return longPnl + shortPnl;
  }

  /** Build position snapshot for UI or logging. */
  getPositionSnapshot(positionId: string): PositionSnapshot | null {
    const pos = this.positions.get(positionId);
    if (!pos) return null;
    const pnl = this.getUnrealizedPnl(positionId);
    return {
      exchange: pos.longExchange,
      symbol: pos.longSymbol,
      side: "long",
      size: pos.longSize,
      entryPrice: pos.longEntryPrice,
      markPrice: pos.longMarkPrice,
      unrealizedPnl: pnl / 2,
      timestamp: Date.now(),
    };
  }

  private evaluatePosition(positionId: string): void {
    const pos = this.positions.get(positionId);
    if (!pos) return;
    const pnl = this.getUnrealizedPnl(positionId);
    const notional = pos.longEntryPrice * pos.longSize + pos.shortEntryPrice * pos.shortSize;
    const pnlBps = notional > 0 ? (pnl / notional) * 10000 : 0;
    const holdMs = Date.now() - pos.openedAt;

    if (pnlBps >= this.config.pnlTargetBps) {
      this.emitExit(positionId, "pnl_target", pnl);
      return;
    }
    if (pnlBps <= -this.config.pnlStopBps) {
      this.emitExit(positionId, "pnl_stop", pnl);
      return;
    }
    if (holdMs >= this.config.maxHoldMs) {
      this.emitExit(positionId, "timeout", pnl);
      return;
    }
    // funding_flip and manual would be triggered elsewhere; Monitor emits when conditions hit.
  }

  private emitExit(positionId: string, reason: ExitSignal["reason"], pnl: number): void {
    this.positions.delete(positionId);
    this.listener?.({
      reason,
      positionId,
      pnl,
      timestamp: Date.now(),
    });
  }

  getConfig(): MonitorConfig {
    return { ...this.config };
  }

  updateConfig(partial: Partial<MonitorConfig>): void {
    this.config = { ...this.config, ...partial };
  }
}
