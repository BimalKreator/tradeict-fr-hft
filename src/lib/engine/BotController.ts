import type { ExchangeId } from "@/lib/types";
import { WsManager } from "@/lib/websocket/WsManager";
import { Screener } from "./Screener";

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

let instance: BotController | null = null;

/**
 * Singleton that wires WsManager and Screener: on first /api/screener (or startup),
 * connects to Binance and Bybit and subscribes to SCREENER_SYMBOLS so the screener
 * store is populated for the API to read.
 */
export class BotController {
  private wsManager: WsManager;
  private screener: Screener;
  private initialized = false;

  private constructor() {
    this.wsManager = new WsManager();
    this.screener = new Screener({
      minSpreadBps: 0,
      symbols: SCREENER_SYMBOLS,
      exchangePairs: [["binance", "bybit"] as [ExchangeId, ExchangeId]],
    });

    this.wsManager.setListener({
      onFundingRate: (data) => this.screener.onFundingRate(data),
      onMarkPrice: (data) => this.screener.onMarkPrice(data),
    });
  }

  static getInstance(): BotController {
    if (instance == null) {
      instance = new BotController();
    }
    return instance;
  }

  /** Connect WS and subscribe to all screener symbols for both exchanges. Idempotent. */
  init(): void {
    if (this.initialized) return;
    this.initialized = true;
    this.wsManager.connect(["binance", "bybit"]);
    for (const symbol of SCREENER_SYMBOLS) {
      this.wsManager.subscribe("binance", symbol);
      this.wsManager.subscribe("bybit", symbol);
    }
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
