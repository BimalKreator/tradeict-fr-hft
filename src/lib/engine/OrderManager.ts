import type {
  ExchangeId,
  OrderRequest,
  OrderUpdate,
  EntryDecision,
  ExitSignal,
} from "@/lib/types";

export type OrderManagerListener = {
  onOrderUpdate?: (update: OrderUpdate) => void;
  onPlaceError?: (request: OrderRequest, err: Error) => void;
};

/**
 * OrderManager: places API/WS orders on exchanges. Translates EntryDecision into
 * OrderRequest(s) and ExitSignal into reduce-only close orders.
 */
export class OrderManager {
  private listener: OrderManagerListener = {};
  private apiClients: Partial<Record<ExchangeId, unknown>> = {};

  setListener(listener: OrderManagerListener): void {
    this.listener = listener;
  }

  /** Register exchange API client (e.g. Binance/Bybit REST or WS order client). */
  setApiClient(exchange: ExchangeId, client: unknown): void {
    this.apiClients[exchange] = client;
  }

  /**
   * Place orders from an entry decision: one order per leg (long on one exchange,
   * short on the other). Implement actual API/WS calls using apiClients.
   */
  placeFromEntry(decision: EntryDecision): void {
    const { opportunity, side, sizeBase, maxSlippageBps } = decision;
    const longReq: OrderRequest = {
      exchange: opportunity.longExchange,
      symbol: opportunity.longSymbol,
      side: "buy",
      sizeBase,
      orderType: "market",
      requestedAt: decision.requestedAt,
    };
    const shortReq: OrderRequest = {
      exchange: opportunity.shortExchange,
      symbol: opportunity.shortSymbol,
      side: "sell",
      sizeBase,
      orderType: "market",
      requestedAt: decision.requestedAt,
    };
    this.place(longReq);
    this.place(shortReq);
  }

  /**
   * Close positions from an exit signal. Implement reduce-only market/limit orders
   * per exchange/symbol based on positionId or internal state.
   */
  closeFromExit(signal: ExitSignal): void {
    // Resolve positionId to exchange + symbol + side and place reduce-only orders.
    // Skeleton: this.place({ ...request, reduceOnly: true });
    void signal;
  }

  /** Place a single order. Override or extend for real exchange API/WS. */
  place(request: OrderRequest): void {
    const client = this.apiClients[request.exchange];
    if (!client) {
      this.listener.onPlaceError?.(request, new Error(`No API client for ${request.exchange}`));
      return;
    }
    // TODO: call exchange-specific place order (REST or WS)
    void client;
  }

  /** Push order fill/status from exchange (e.g. WS execution report). */
  pushOrderUpdate(update: OrderUpdate): void {
    this.listener.onOrderUpdate?.(update);
  }
}
