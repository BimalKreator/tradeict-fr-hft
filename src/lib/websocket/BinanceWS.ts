import WebSocket from "ws";
import type { FundingRateSnapshot, MarkPriceUpdate, UserPositionUpdate } from "@/lib/types";

const BINANCE_FUTURES_WS = "wss://fstream.binance.com/ws";
const BINANCE_FUTURES_USER_WS = "wss://fstream.binance.com/ws";

/** Heartbeat interval to keep connection alive during high volatility */
const HEARTBEAT_INTERVAL_MS = 30_000;
const INITIAL_RECONNECT_MS = 1_000;
const MAX_RECONNECT_MS = 30_000;
const BACKOFF_MULTIPLIER = 2;
/** Reject payloads with timestamp older than this (ms) */
const MAX_TIMESTAMP_AGE_MS = 60_000;

export type BinanceWSListener = {
  onFundingRate?: (data: FundingRateSnapshot) => void;
  onMarkPrice?: (data: MarkPriceUpdate) => void;
  onPosition?: (data: UserPositionUpdate) => void;
  onError?: (err: Error) => void;
  onClose?: () => void;
};

function isFiniteNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function parseTimestamp(ts: unknown, fallback: number): number {
  if (ts == null) return fallback;
  const t = typeof ts === "number" ? ts : typeof ts === "string" ? parseInt(ts, 10) : NaN;
  return Number.isFinite(t) ? t : fallback;
}

function isTimestampValid(ts: number, maxAgeMs: number): boolean {
  return Number.isFinite(ts) && ts > 0 && Date.now() - ts < maxAgeMs;
}

/**
 * Binance Futures WebSocket client: real-time Mark Price, Funding Rate, and optional User Position.
 * Production-grade: heartbeat, exponential backoff, zero leak cleanup, strict timestamp validation.
 */
export class BinanceWS {
  private ws: WebSocket | null = null;
  private userWs: WebSocket | null = null;
  private subscriptions = new Set<string>();
  private userListenKey: string | null = null;
  private listener: BinanceWSListener = {};
  private heartbeatIntervalId: ReturnType<typeof setInterval> | null = null;
  private userHeartbeatIntervalId: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private userReconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private userReconnectAttempts = 0;

  setListener(listener: BinanceWSListener): void {
    this.listener = listener;
  }

  connect(): void {
    this.clearPublicTimers();
    if (this.ws != null) {
      this.cleanupWs(this.ws);
      this.ws = null;
    }
    this.ws = new WebSocket(BINANCE_FUTURES_WS);
    this.ws.on("open", () => this.onPublicOpen());
    this.ws.on("message", (raw) => this.handlePublicMessage(raw));
    this.ws.on("pong", () => { /* keepalive */ });
    this.ws.on("error", (err) => this.listener.onError?.(err as Error));
    this.ws.on("close", () => this.onPublicClose());
  }

  /** Optional: connect to user data stream for position updates. Requires a valid listenKey. */
  connectUserStream(listenKey: string): void {
    this.clearUserTimers();
    if (this.userWs != null) {
      this.cleanupWs(this.userWs);
      this.userWs = null;
    }
    this.userListenKey = listenKey;
    const url = `${BINANCE_FUTURES_USER_WS}/${listenKey}`;
    this.userWs = new WebSocket(url);
    this.userWs.on("open", () => this.onUserOpen());
    this.userWs.on("message", (raw) => this.handleUserMessage(raw));
    this.userWs.on("pong", () => { /* keepalive */ });
    this.userWs.on("error", (err) => this.listener.onError?.(err as Error));
    this.userWs.on("close", () => this.onUserClose());
  }

  private onPublicOpen(): void {
    this.reconnectAttempts = 0;
    this.startHeartbeat();
    this.resubscribe();
  }

  private onUserOpen(): void {
    this.userReconnectAttempts = 0;
    this.startUserHeartbeat();
  }

  private onPublicClose(): void {
    this.clearPublicTimers();
    this.listener.onClose?.();
    this.scheduleReconnect();
  }

  private onUserClose(): void {
    this.clearUserTimers();
    if (this.userWs) {
      this.cleanupWs(this.userWs);
      this.userWs = null;
    }
    this.scheduleUserReconnect();
  }

  private startHeartbeat(): void {
    this.clearHeartbeat();
    this.heartbeatIntervalId = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.ping();
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  private startUserHeartbeat(): void {
    if (this.userHeartbeatIntervalId) clearInterval(this.userHeartbeatIntervalId);
    this.userHeartbeatIntervalId = setInterval(() => {
      if (this.userWs?.readyState === WebSocket.OPEN) {
        this.userWs.ping();
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  private clearHeartbeat(): void {
    if (this.heartbeatIntervalId != null) {
      clearInterval(this.heartbeatIntervalId);
      this.heartbeatIntervalId = null;
    }
  }

  private clearUserTimers(): void {
    if (this.userHeartbeatIntervalId != null) {
      clearInterval(this.userHeartbeatIntervalId);
      this.userHeartbeatIntervalId = null;
    }
    if (this.userReconnectTimer != null) {
      clearTimeout(this.userReconnectTimer);
      this.userReconnectTimer = null;
    }
  }

  private clearPublicTimers(): void {
    this.clearHeartbeat();
    if (this.reconnectTimer != null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private cleanupWs(socket: WebSocket): void {
    socket.removeAllListeners();
    try {
      socket.close();
    } catch {
      // ignore
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer != null) return;
    const delay = Math.min(
      INITIAL_RECONNECT_MS * Math.pow(BACKOFF_MULTIPLIER, this.reconnectAttempts),
      MAX_RECONNECT_MS
    );
    this.reconnectAttempts++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private scheduleUserReconnect(): void {
    if (this.userListenKey == null || this.userReconnectTimer != null) return;
    const delay = Math.min(
      INITIAL_RECONNECT_MS * Math.pow(BACKOFF_MULTIPLIER, this.userReconnectAttempts),
      MAX_RECONNECT_MS
    );
    this.userReconnectAttempts++;
    this.userReconnectTimer = setTimeout(() => {
      this.userReconnectTimer = null;
      this.connectUserStream(this.userListenKey!);
    }, delay);
  }

  private resubscribe(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || this.subscriptions.size === 0) return;
    const streams = Array.from(this.subscriptions).map((s) => `${s}@markPrice@1s`);
    this.send({ method: "SUBSCRIBE", params: streams, id: Date.now() });
  }

  /** Subscribe to Mark Price + Funding Rate (combined stream @markPrice@1s). */
  subscribeMarkPriceAndFunding(symbol: string): void {
    const stream = symbol.toLowerCase();
    this.subscriptions.add(stream);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send({
        method: "SUBSCRIBE",
        params: [`${stream}@markPrice@1s`],
        id: Date.now(),
      });
    }
  }

  subscribeSymbol(symbol: string): void {
    this.subscribeMarkPriceAndFunding(symbol);
  }

  unsubscribeSymbol(symbol: string): void {
    const stream = symbol.toLowerCase();
    this.subscriptions.delete(stream);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send({
        method: "UNSUBSCRIBE",
        params: [`${stream}@markPrice@1s`],
        id: Date.now(),
      });
    }
  }

  private send(obj: object): void {
    try {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(obj));
      }
    } catch (e) {
      this.listener.onError?.(e instanceof Error ? e : new Error(String(e)));
    }
  }

  private handlePublicMessage(raw: WebSocket.Data): void {
    let msg: unknown;
    try {
      const str = typeof raw === "string" ? raw : raw.toString();
      if (!str || typeof str !== "string") return;
      msg = JSON.parse(str);
    } catch {
      return;
    }
    if (msg == null || typeof msg !== "object") return;
    const m = msg as Record<string, unknown>;
    if (m.e !== "markPriceUpdate") return;
    const eventTime = parseTimestamp(m.E, Date.now());
    if (!isTimestampValid(eventTime, MAX_TIMESTAMP_AGE_MS)) return;
    const symbol = typeof m.s === "string" ? m.s : "";
    if (!symbol) return;
    const markPrice = typeof m.p === "string" || typeof m.p === "number" ? parseFloat(String(m.p)) : NaN;
    if (!isFiniteNumber(markPrice)) return;
    const update: MarkPriceUpdate = {
      exchange: "binance",
      symbol,
      markPrice,
      indexPrice: m.i != null && (typeof m.i === "string" || typeof m.i === "number")
        ? parseFloat(String(m.i))
        : undefined,
      timestamp: eventTime,
    };
    this.listener.onMarkPrice?.(update);
    if (m.r != null) {
      const fundingRate = parseFloat(String(m.r));
      if (!Number.isFinite(fundingRate)) return;
      const nextFundingTime = parseTimestamp(m.T, 0);
      const snapshot: FundingRateSnapshot = {
        exchange: "binance",
        symbol,
        fundingRate,
        nextFundingTime,
        markPrice: update.markPrice,
        indexPrice: update.indexPrice,
        timestamp: eventTime,
      };
      this.listener.onFundingRate?.(snapshot);
    }
  }

  private handleUserMessage(raw: WebSocket.Data): void {
    let msg: unknown;
    try {
      const str = typeof raw === "string" ? raw : raw.toString();
      if (!str || typeof str !== "string") return;
      msg = JSON.parse(str);
    } catch {
      return;
    }
    if (msg == null || typeof msg !== "object") return;
    const m = msg as Record<string, unknown>;
    const eventTime = parseTimestamp(m.E, Date.now());
    if (!isTimestampValid(eventTime, MAX_TIMESTAMP_AGE_MS)) return;
    if (m.e === "ACCOUNT_UPDATE") {
      const a = m.a as Record<string, unknown> | undefined;
      const positions = Array.isArray(a?.P) ? (a.P as unknown[]) : [];
      for (const p of positions) {
        const pos = p as Record<string, unknown>;
        const symbol = typeof pos.s === "string" ? pos.s : "";
        const pa = typeof pos.pa === "string" ? parseFloat(pos.pa) : typeof pos.pa === "number" ? pos.pa : NaN;
        const ep = typeof pos.ep === "string" ? parseFloat(pos.ep) : typeof pos.ep === "number" ? pos.ep : NaN;
        const up = typeof pos.up === "string" ? parseFloat(pos.up) : typeof pos.up === "number" ? pos.up : 0;
        if (!symbol || !Number.isFinite(pa)) continue;
        const side: "long" | "short" = pa >= 0 ? "long" : "short";
        const update: UserPositionUpdate = {
          exchange: "binance",
          symbol,
          side,
          size: Math.abs(pa),
          entryPrice: Number.isFinite(ep) ? ep : 0,
          markPrice: Number.isFinite(ep) ? ep : 0,
          unrealizedPnl: Number.isFinite(up) ? up : 0,
          timestamp: eventTime,
        };
        this.listener.onPosition?.(update);
      }
    }
  }

  disconnect(): void {
    this.clearPublicTimers();
    this.clearUserTimers();
    if (this.ws) {
      this.cleanupWs(this.ws);
      this.ws = null;
    }
    if (this.userWs) {
      this.cleanupWs(this.userWs);
      this.userWs = null;
    }
    this.userListenKey = null;
    this.subscriptions.clear();
    this.reconnectAttempts = 0;
    this.userReconnectAttempts = 0;
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  isUserStreamConnected(): boolean {
    return this.userWs?.readyState === WebSocket.OPEN;
  }
}
