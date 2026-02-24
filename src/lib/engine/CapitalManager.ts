import type { CapitalConfig, WalletBalance } from "@/lib/types";

/**
 * CapitalManager: strict capital logic for delta-neutral funding arbitrage.
 * Tracks Actual Balance (Total Wallet Balance/Equity) only; ignores Available Balance and Used Margin.
 * BaseCapital = min(Binance, Bybit). TradeAllocation = BaseCapital * (CapitalPercentage / 100).
 * Used capital is NOT subtracted; the same formula applies for all concurrent trades up to MaxTrades.
 */
export class CapitalManager {
  private config: CapitalConfig;
  private binanceActualBalance = 0;
  private bybitActualBalance = 0;

  constructor(config: CapitalConfig) {
    this.config = config;
  }

  /** Update balances from exchange data. Only actualBalance is used. */
  updateBalance(balance: WalletBalance): void {
    if (balance.exchange === "binance") {
      this.binanceActualBalance = balance.actualBalance;
    } else if (balance.exchange === "bybit") {
      this.bybitActualBalance = balance.actualBalance;
    }
  }

  /** Base capital = min(Binance actual, Bybit actual). Used capital is not subtracted. */
  getBaseCapital(): number {
    return Math.min(this.binanceActualBalance, this.bybitActualBalance);
  }

  /**
   * Per-trade allocation in dollars per leg.
   * Formula: BaseCapital * (capitalPct / 100). Static for all concurrent trades up to MaxTrades.
   * @param binanceBal Binance actual balance (total wallet/equity).
   * @param bybitBal Bybit actual balance (total wallet/equity).
   * @param capitalPct Capital percentage per trade (0–100).
   * @returns Dollar amount per leg.
   */
  getAllocation(
    binanceBal: number,
    bybitBal: number,
    capitalPct: number
  ): number {
    const baseCapital = Math.min(binanceBal, bybitBal);
    return baseCapital * (capitalPct / 100);
  }

  /** Allocation using currently tracked balances and config default capital percentage. */
  getAllocationFromTracked(): number {
    return this.getAllocation(
      this.binanceActualBalance,
      this.bybitActualBalance,
      this.config.capitalPercentage
    );
  }

  getConfig(): CapitalConfig {
    return { ...this.config };
  }

  updateConfig(partial: Partial<CapitalConfig>): void {
    this.config = { ...this.config, ...partial };
  }

  getBinanceActualBalance(): number {
    return this.binanceActualBalance;
  }

  getBybitActualBalance(): number {
    return this.bybitActualBalance;
  }
}
