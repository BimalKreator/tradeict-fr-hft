/**
 * Strict types for HFT funding arbitrage data flow.
 * Data flows: Exchange WS -> Funding/Mark -> Screener -> Engine -> OrderManager -> Monitor.
 */

/** Exchange identifier */
export type ExchangeId = "binance" | "bybit";

/** Single funding rate snapshot from an exchange (WS or REST) */
export interface FundingRateSnapshot {
  exchange: ExchangeId;
  symbol: string;
  fundingRate: number;
  nextFundingTime: number; // UTC ms
  markPrice?: number;
  indexPrice?: number;
  timestamp: number;
}

/** Mark price / index price update from WS */
export interface MarkPriceUpdate {
  exchange: ExchangeId;
  symbol: string;
  markPrice: number;
  indexPrice?: number;
  timestamp: number;
}

/** User position update from WS (private/user stream) */
export interface UserPositionUpdate {
  exchange: ExchangeId;
  symbol: string;
  side: "long" | "short";
  size: number;
  entryPrice: number;
  markPrice: number;
  unrealizedPnl: number;
  timestamp: number;
}

/** Normalized funding + mark for screener input */
export interface FundingMarkPayload {
  exchange: ExchangeId;
  symbol: string;
  fundingRate: number;
  markPrice: number;
  nextFundingTime: number;
  timestamp: number;
}

/** Screener output: detected opportunity */
export interface FundingArbOpportunity {
  longSymbol: string;
  shortSymbol: string;
  longExchange: ExchangeId;
  shortExchange: ExchangeId;
  spreadBps: number;
  longFundingRate: number;
  shortFundingRate: number;
  longMarkPrice: number;
  shortMarkPrice: number;
  detectedAt: number;
}

/** Entry decision from TradingEngine */
export interface EntryDecision {
  opportunity: FundingArbOpportunity;
  side: "long_short" | "short_long"; // long on A, short on B vs opposite
  sizeBase: number;
  maxSlippageBps: number;
  requestedAt: number;
}

/** Order placement request (to OrderManager) */
export interface OrderRequest {
  exchange: ExchangeId;
  symbol: string;
  side: "buy" | "sell";
  sizeBase: number;
  orderType: "market" | "limit";
  limitPrice?: number;
  reduceOnly?: boolean;
  clientOrderId?: string;
  requestedAt: number;
}

/** Order fill / status from exchange */
export interface OrderUpdate {
  exchange: ExchangeId;
  orderId: string;
  clientOrderId?: string;
  symbol: string;
  side: "buy" | "sell";
  status: "new" | "filled" | "partially_filled" | "canceled" | "rejected";
  filledQty: number;
  avgPrice: number;
  timestamp: number;
}

/** Position snapshot for PnL and exit logic */
export interface PositionSnapshot {
  exchange: ExchangeId;
  symbol: string;
  side: "long" | "short";
  size: number;
  entryPrice: number;
  markPrice: number;
  unrealizedPnl: number;
  timestamp: number;
}

/** Monitor output: exit signal */
export interface ExitSignal {
  reason: "pnl_target" | "pnl_stop" | "funding_flip" | "timeout" | "manual";
  positionId: string;
  pnl: number;
  timestamp: number;
}

/** Wallet balance from an exchange. Use actualBalance only for capital logic. */
export interface WalletBalance {
  exchange: ExchangeId;
  /** Total wallet balance / equity. Use this for capital; ignore availableBalance and usedMargin. */
  actualBalance: number;
  /** Available balance (optional, not used in capital calculation). */
  availableBalance?: number;
  /** Used margin (optional, not used in capital calculation). */
  usedMargin?: number;
  /** Quote currency, e.g. "USDT". */
  currency: string;
  timestamp: number;
}

/** Capital allocation config for delta-neutral funding arbitrage. */
export interface CapitalConfig {
  /** Max number of concurrent trades; allocation formula is static across all up to this limit. */
  maxTrades: number;
  /** Default capital percentage per trade (0–100). Overridable per getAllocation call. */
  capitalPercentage: number;
}
