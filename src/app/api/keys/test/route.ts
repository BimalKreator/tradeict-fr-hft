import { NextResponse } from "next/server";
import { KeyManager, type StoredKeys } from "@/lib/engine/KeyManager";
import * as binanceRest from "@/lib/exchange/binance-rest";
import * as bybitRest from "@/lib/exchange/bybit-rest";

function parseBody(body: unknown): StoredKeys | null {
  if (body == null || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const binance = b.binance;
  const bybit = b.bybit;
  const keys: StoredKeys = {};
  if (binance && typeof binance === "object") {
    const bn = binance as Record<string, unknown>;
    const apiKey = typeof bn.apiKey === "string" ? bn.apiKey.trim() : "";
    const secretKey = typeof bn.secretKey === "string" ? bn.secretKey.trim() : "";
    if (apiKey && secretKey) keys.binance = { apiKey, secretKey };
  }
  if (bybit && typeof bybit === "object") {
    const bb = bybit as Record<string, unknown>;
    const apiKey = typeof bb.apiKey === "string" ? bb.apiKey.trim() : "";
    const secret = typeof bb.secret === "string" ? bb.secret.trim() : "";
    if (apiKey && secret) keys.bybit = { apiKey, secret };
  }
  return Object.keys(keys).length > 0 ? keys : null;
}

export type TestResult = {
  ok: boolean;
  binance?: { error?: string; warning?: string; hedgeMode?: boolean };
  bybit?: { error?: string; warning?: string; hedgeMode?: boolean | null };
};

export async function POST(request: Request): Promise<NextResponse<TestResult>> {
  let keys: StoredKeys | null = null;
  try {
    const body = await request.json().catch(() => null);
    keys = parseBody(body);
    if (!keys) {
      const manager = new KeyManager();
      if (manager.hasStoredKeys()) keys = manager.loadAndDecrypt();
    }
    if (!keys || (Object.keys(keys).length === 0)) {
      return NextResponse.json({
        ok: false,
        binance: { error: "No keys provided and none stored" },
      } satisfies TestResult);
    }
  } catch (e) {
    return NextResponse.json({
      ok: false,
      binance: { error: e instanceof Error ? e.message : "Failed to load keys" },
    } satisfies TestResult);
  }

  const result: TestResult = { ok: true };

  if (keys.binance) {
    try {
      const account = await binanceRest.getAccount(keys.binance.apiKey, keys.binance.secretKey);
      if (!account.canTrade) {
        result.ok = false;
        result.binance = { error: "Futures trading is disabled for this API key." };
      } else {
        const hedgeMode = await binanceRest.getPositionMode(keys.binance.apiKey, keys.binance.secretKey);
        if (!hedgeMode) {
          result.ok = false;
          result.binance = { error: "Hedge Mode (Dual Position Side) is not enabled. Enable it in Binance Futures." };
        } else {
          result.binance = { hedgeMode: true };
          if (account.canWithdraw) result.binance.warning = "Withdrawal permission is enabled. Consider disabling for safety.";
        }
      }
    } catch (e) {
      result.ok = false;
      result.binance = { error: e instanceof Error ? e.message : "Binance API request failed." };
    }
  }

  if (keys.bybit) {
    try {
      await bybitRest.getAccountInfo(keys.bybit.apiKey, keys.bybit.secret);
      const { hedgeMode } = await bybitRest.getPositionList(keys.bybit.apiKey, keys.bybit.secret);
      if (hedgeMode === false) {
        result.ok = false;
        result.bybit = { error: "Hedge Mode (Both Sides) is not enabled. Enable it in Bybit Position Mode." };
      } else if (hedgeMode === null) {
        result.bybit = {
          hedgeMode: null,
          warning: "Hedge mode could not be confirmed (no open positions). Ensure Hedge Mode is enabled in Bybit.",
        };
      } else {
        result.bybit = { hedgeMode: true };
      }
    } catch (e) {
      result.ok = false;
      result.bybit = { error: e instanceof Error ? e.message : "Bybit API request failed." };
    }
  }

  return NextResponse.json(result);
}
