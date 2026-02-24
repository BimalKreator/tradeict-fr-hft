import type { ExchangeId } from "@/lib/types";
import type {
  FundingRateSnapshot,
  MarkPriceUpdate,
  UserPositionUpdate,
} from "@/lib/types";
import { BinanceWS } from "./BinanceWS";
import { BybitWS } from "./BybitWS";

export type WsManagerListener = {
  onFundingRate?: (data: FundingRateSnapshot) => void;
  onMarkPrice?: (data: MarkPriceUpdate) => void;
  onPosition?: (data: UserPositionUpdate) => void;
  onError?: (exchange: ExchangeId, err: Error) => void;
  /** Fired when any exchange WS disconnects. Use to pause auto-trade (Runtime Safety Rule). */
  onDisconnect?: (exchange: ExchangeId) => void;
};

const WS_MANAGER_KEY = "__WS_MANAGER__";

/**
 * Central manager for exchange WebSocket streams. Connects Binance and Bybit WS,
 * forwards Mark Price, Funding Rate, and User Position updates. Robust error
 * handling so malformed payloads or listener throws never crash the manager.
 * Singleton on globalThis so API and BotController share the same instance.
 */
export class WsManager {
  private binance = new BinanceWS();
  private bybit = new BybitWS();
  private listener: WsManagerListener = {};

  static getInstance(): WsManager {
    const g = globalThis as Record<string, unknown>;
    if (!g[WS_MANAGER_KEY]) g[WS_MANAGER_KEY] = new WsManager();
    return g[WS_MANAGER_KEY] as WsManager;
  }

  private safeForward<T>(exchange: ExchangeId, fn: ((p: T) => void) | undefined, payload: T): void {
    if (fn == null) return;
    try {
      fn(payload);
    } catch (e) {
      try {
        this.listener.onError?.(
          exchange,
          e instanceof Error ? e : new Error(String(e))
        );
      } catch {
        // Prevent any throw from bringing down the manager
      }
    }
  }

  private safeError(exchange: ExchangeId, err: Error): void {
    try {
      this.listener.onError?.(exchange, err);
    } catch {
      // ignore
    }
  }

  setListener(listener: WsManagerListener): void {
    this.listener = listener;
    this.binance.setListener({
      onFundingRate: (d) => this.safeForward("binance", this.listener.onFundingRate, d),
      onMarkPrice: (d) => this.safeForward("binance", this.listener.onMarkPrice, d),
      onPosition: (d) => this.safeForward("binance", this.listener.onPosition, d),
      onError: (err) => this.safeError("binance", err),
      onClose: () => {
        try { this.listener.onDisconnect?.("binance"); } catch { /* no-op */ }
      },
    });
    this.bybit.setListener({
      onFundingRate: (d) => this.safeForward("bybit", this.listener.onFundingRate, d),
      onMarkPrice: (d) => this.safeForward("bybit", this.listener.onMarkPrice, d),
      onPosition: (d) => this.safeForward("bybit", this.listener.onPosition, d),
      onError: (err) => this.safeError("bybit", err),
      onClose: () => {
        try { this.listener.onDisconnect?.("bybit"); } catch { /* no-op */ }
      },
    });
  }

  connect(exchanges: ExchangeId[] = ["binance", "bybit"]): void {
    if (exchanges.includes("binance")) this.binance.connect();
    if (exchanges.includes("bybit")) this.bybit.connect();
  }

  /** Binance: connect user data stream for position updates (requires listenKey from REST). */
  connectBinanceUserStream(listenKey: string): void {
    this.binance.connectUserStream(listenKey);
  }

  /** Bybit: connect private stream for position updates (pass signed WS URL with auth params). */
  connectBybitPrivate(signedWsUrl: string): void {
    this.bybit.connectPrivate(signedWsUrl);
  }

  subscribe(exchange: ExchangeId, symbol: string): void {
    if (exchange === "binance") this.binance.subscribeSymbol(symbol);
    else if (exchange === "bybit") this.bybit.subscribeSymbol(symbol);
  }

  unsubscribe(exchange: ExchangeId, symbol: string): void {
    if (exchange === "binance") this.binance.unsubscribeSymbol(symbol);
    else if (exchange === "bybit") this.bybit.unsubscribeSymbol(symbol);
  }

  disconnect(): void {
    this.binance.disconnect();
    this.bybit.disconnect();
  }

  isConnected(exchange?: ExchangeId): boolean {
    if (exchange === "binance") return this.binance.isConnected();
    if (exchange === "bybit") return this.bybit.isConnected();
    return this.binance.isConnected() && this.bybit.isConnected();
  }

  isBinanceUserStreamConnected(): boolean {
    return this.binance.isUserStreamConnected();
  }

  isBybitPrivateConnected(): boolean {
    return this.bybit.isPrivateConnected();
  }
}
