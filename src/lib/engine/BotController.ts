import type { ExchangeId } from "@/lib/types";
import { WsManager } from "@/lib/websocket/WsManager";
import { Screener } from "./Screener";

const BOT_CONTROLLER_KEY = "__BOT_CONTROLLER__";
const SCREENER_KEY = "__SCREENER__";

/** Top 50 USDT-perpetual pairs for funding screener (Binance + Bybit). */
export const SCREENER_SYMBOLS: string[] = [
  "BTCUSDT",
  "ETHUSDT",
  "BNBUSDT",
  "SOLUSDT",
  "XRPUSDT",
  "ADAUSDT",
  "DOGEUSDT",
  "AVAXUSDT",
  "DOTUSDT",
  "MATICUSDT",
  "LTCUSDT",
  "LINKUSDT",
  "UNIUSDT",
  "ATOMUSDT",
  "ETCUSDT",
  "XLMUSDT",
  "BCHUSDT",
  "NEARUSDT",
  "APTUSDT",
  "FILUSDT",
  "INJUSDT",
  "OPUSDT",
  "ARBUSDT",
  "SUIUSDT",
  "PEPEUSDT",
  "WLDUSDT",
  "FETUSDT",
  "RENDERUSDT",
  "IMXUSDT",
  "TAOUSDT",
  "STXUSDT",
  "HBARUSDT",
  "VETUSDT",
  "MKRUSDT",
  "GRTUSDT",
  "AAVEUSDT",
  "ICPUSDT",
  "LDOUSDT",
  "RUNEUSDT",
  "THETAUSDT",
  "FTMUSDT",
  "ALGOUSDT",
  "SANDUSDT",
  "AXSUSDT",
  "CRVUSDT",
  "MANAUSDT",
  "GALAUSDT",
  "APEUSDT",
  "DYDXUSDT",
];

/**
 * Singleton on globalThis so API route and any background context share the same
 * instance. Wires WsManager and Screener; on first /api/screener, connects and
 * subscribes to SCREENER_SYMBOLS so the screener store is populated.
 */
export class BotController {
  private wsManager: WsManager;
  private screener: Screener;
  private initialized = false;

  private constructor() {
    this.wsManager = WsManager.getInstance();
    this.screener = new Screener({
      minSpreadBps: 0,
      symbols: SCREENER_SYMBOLS,
      exchangePairs: [["binance", "bybit"] as [ExchangeId, ExchangeId]],
    });

    this.wsManager.setListener({
      onFundingRate: (data) => this.screener.onFundingRate(data),
      onMarkPrice: (data) => this.screener.onMarkPrice(data),
    });
    (globalThis as Record<string, unknown>)[SCREENER_KEY] = this.screener;
  }

  static getInstance(): BotController {
    const g = globalThis as Record<string, unknown>;
    if (!g[BOT_CONTROLLER_KEY]) g[BOT_CONTROLLER_KEY] = new BotController();
    return g[BOT_CONTROLLER_KEY] as BotController;
  }

  /** Connect WS and subscribe to all screener symbols for both exchanges. Idempotent. */
  init(): void {
    if (this.initialized) return;
    console.log("--- BOT ENGINE STARTING ---");
    this.initialized = true;
    this.wsManager.connect(["binance", "bybit"]);
    console.log("Subscribing to pairs...");
    for (const symbol of SCREENER_SYMBOLS) {
      this.wsManager.subscribe("binance", symbol);
      this.wsManager.subscribe("bybit", symbol);
    }
    console.log(`Subscribed to ${SCREENER_SYMBOLS.length} pairs on Binance and Bybit.`);
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getWsManager(): WsManager {
    return this.wsManager;
  }

  getScreener(): Screener {
    return this.screener;
  }
}
