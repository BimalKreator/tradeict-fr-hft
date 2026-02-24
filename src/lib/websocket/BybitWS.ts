import WebSocket from "ws";
import type { FundingRateSnapshot, MarkPriceUpdate, UserPositionUpdate } from "@/lib/types";

const BYBIT_FUTURES_WS = "wss://stream.bybit.com/v5/public/linear";

const HEARTBEAT_INTERVAL_MS = 30_000;
const INITIAL_RECONNECT_MS = 1_000;
const MAX_RECONNECT_MS = 30_000;
const BACKOFF_MULTIPLIER = 2;
const MAX_TIMESTAMP_AGE_MS = 60_000;

export type BybitWSListener = {
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
 * Bybit Linear WebSocket client: real-time Mark Price, Funding Rate, and optional User Position.
 * Production-grade: heartbeat, exponential backoff, zero leak cleanup, strict timestamp validation.
 */
export class BybitWS {
  private ws: WebSocket | null = null;
  private privateWs: WebSocket | null = null;
  private subscriptions = new Set<string>();
  private positionSubscribed = false;
  private listener: BybitWSListener = {};
  private heartbeatIntervalId: ReturnType<typeof setInterval> | null = null;
  private privateHeartbeatIntervalId: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private privateReconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private privateReconnectAttempts = 0;

  setListener(listener: BybitWSListener): void {
    this.listener = listener;
  }

  connect(): void {
    this.clearPublicTimers();
    if (this.ws != null) {
      this.cleanupWs(this.ws);
      this.ws = null;
    }
    this.ws = new WebSocket(BYBIT_FUTURES_WS);
    this.ws.on("open", () => this.onPublicOpen());
    this.ws.on("message", (raw) => this.handlePublicMessage(raw));
    this.ws.on("pong", () => { /* keepalive */ });
    this.ws.on("error", (err) => this.listener.onError?.(err as Error));
    this.ws.on("close", () => this.onPublicClose());
  }

  /**
   * Connect to private stream for position updates. Pass full URL with auth query params
   * (api_key, timestamp, sign) as required by Bybit v5.
   */
  connectPrivate(signedWsUrl: string): void {
    this.clearPrivateTimers();
    if (this.privateWs != null) {
      this.cleanupWs(this.privateWs);
      this.privateWs = null;
    }
    this.privateWs = new WebSocket(signedWsUrl);
    this.privateWs.on("open", () => this.onPrivateOpen());
    this.privateWs.on("message", (raw) => this.handlePrivateMessage(raw));
    this.privateWs.on("pong", () => { /* keepalive */ });
    this.privateWs.on("error", (err) => this.listener.onError?.(err as Error));
    this.privateWs.on("close", () => this.onPrivateClose());
  }

  private onPublicOpen(): void {
    this.reconnectAttempts = 0;
    this.startHeartbeat();
    this.resubscribe();
  }

  private onPrivateOpen(): void {
    this.privateReconnectAttempts = 0;
    this.startPrivateHeartbeat();
    this.subscribePositionTopic();
  }

  private onPublicClose(): void {
    this.clearPublicTimers();
    this.listener.onClose?.();
    this.scheduleReconnect();
  }

  private onPrivateClose(): void {
    this.clearPrivateTimers();
    if (this.privateWs) {
      this.cleanupWs(this.privateWs);
      this.privateWs = null;
    }
    this.positionSubscribed = false;
    this.schedulePrivateReconnect();
  }

  private startHeartbeat(): void {
    if (this.heartbeatIntervalId) clearInterval(this.heartbeatIntervalId);
    this.heartbeatIntervalId = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.ping();
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  private startPrivateHeartbeat(): void {
    if (this.privateHeartbeatIntervalId) clearInterval(this.privateHeartbeatIntervalId);
    this.privateHeartbeatIntervalId = setInterval(() => {
      if (this.privateWs?.readyState === WebSocket.OPEN) {
        this.privateWs.ping();
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  private clearPublicTimers(): void {
    if (this.heartbeatIntervalId != null) {
      clearInterval(this.heartbeatIntervalId);
      this.heartbeatIntervalId = null;
    }
    if (this.reconnectTimer != null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private clearPrivateTimers(): void {
    if (this.privateHeartbeatIntervalId != null) {
      clearInterval(this.privateHeartbeatIntervalId);
      this.privateHeartbeatIntervalId = null;
    }
    if (this.privateReconnectTimer != null) {
      clearTimeout(this.privateReconnectTimer);
      this.privateReconnectTimer = null;
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

  private schedulePrivateReconnect(): void {
    if (this.privateReconnectTimer != null) return;
    const delay = Math.min(
      INITIAL_RECONNECT_MS * Math.pow(BACKOFF_MULTIPLIER, this.privateReconnectAttempts),
      MAX_RECONNECT_MS
    );
    this.privateReconnectAttempts++;
    this.privateReconnectTimer = setTimeout(() => {
      this.privateReconnectTimer = null;
      this.listener.onError?.(new Error("Bybit private reconnect requires new signed URL"));
    }, delay);
  }

  private resubscribe(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || this.subscriptions.size === 0) return;
    const topics = Array.from(this.subscriptions).map((s) => `tickers.${s}`);
    this.sendPublic({ op: "subscribe", args: topics });
  }

  /** Subscription payload for Mark Price + Funding Rate (tickers). */
  subscribeMarkPriceAndFunding(symbol: string): void {
    const topic = symbol;
    this.subscriptions.add(topic);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendPublic({ op: "subscribe", args: [`tickers.${topic}`] });
    }
  }

  /** Subscription payload for User Position (private stream only). */
  private subscribePositionTopic(): void {
    if (!this.privateWs || this.privateWs.readyState !== WebSocket.OPEN || this.positionSubscribed) return;
    this.sendPrivate({ op: "subscribe", args: ["position"] });
    this.positionSubscribed = true;
  }

  subscribeSymbol(symbol: string): void {
    this.subscribeMarkPriceAndFunding(symbol);
  }

  unsubscribeSymbol(symbol: string): void {
    this.subscriptions.delete(symbol);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendPublic({ op: "unsubscribe", args: [`tickers.${symbol}`] });
    }
  }

  private sendPublic(obj: object): void {
    try {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(obj));
      }
    } catch (e) {
      this.listener.onError?.(e instanceof Error ? e : new Error(String(e)));
    }
  }

  private sendPrivate(obj: object): void {
    try {
      if (this.privateWs?.readyState === WebSocket.OPEN) {
        this.privateWs.send(JSON.stringify(obj));
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
    if (m.topic != null && typeof m.topic === "string" && m.topic.startsWith("tickers.")) {
      const symbol = m.topic.replace("tickers.", "");
      const data = m.data;
      if (data == null || typeof data !== "object") return;
      const d = data as Record<string, unknown>;
      const markPrice = parseFloat(String(d.markPrice ?? d.lastPrice ?? 0));
      if (!isFiniteNumber(markPrice)) return;
      const ts = parseTimestamp(d.timestamp, Date.now());
      if (!isTimestampValid(ts, MAX_TIMESTAMP_AGE_MS)) return;
      const update: MarkPriceUpdate = {
        exchange: "bybit",
        symbol,
        markPrice,
        indexPrice: d.indexPrice != null ? parseFloat(String(d.indexPrice)) : undefined,
        timestamp: ts,
      };
      this.listener.onMarkPrice?.(update);
      if (d.fundingRate != null) {
        const fundingRate = parseFloat(String(d.fundingRate));
        if (!Number.isFinite(fundingRate)) return;
        const snapshot: FundingRateSnapshot = {
          exchange: "bybit",
          symbol,
          fundingRate,
          nextFundingTime: parseTimestamp(d.nextFundingTime, 0),
          markPrice: update.markPrice,
          indexPrice: update.indexPrice,
          timestamp: ts,
        };
        this.listener.onFundingRate?.(snapshot);
      }
    }
  }

  private handlePrivateMessage(raw: WebSocket.Data): void {
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
    const topic = m.topic;
    if (topic !== "position" && topic !== "position.linear") return;
    const data = m.data;
    if (data == null || typeof data !== "object") return;
    const list = Array.isArray(data) ? data : [data];
    const ts = parseTimestamp(m.ts ?? m.timestamp_e6, Date.now());
    const eventTime = typeof ts === "number" && ts > 1e12 ? ts / 1000 : ts;
    if (!isTimestampValid(eventTime, MAX_TIMESTAMP_AGE_MS)) return;
    for (const item of list) {
      const pos = item && typeof item === "object" ? (item as Record<string, unknown>) : null;
      if (!pos) continue;
      const symbol = typeof pos.symbol === "string" ? pos.symbol : "";
      const size = parseFloat(String(pos.size ?? 0));
      if (!symbol || !Number.isFinite(size) || size === 0) continue;
      const side: "long" | "short" = (String(pos.side ?? "").toLowerCase() === "short") ? "short" : "long";
      const entryPrice = parseFloat(String(pos.avgPrice ?? pos.entryPrice ?? 0));
      const markPrice = parseFloat(String(pos.markPrice ?? pos.avgPrice ?? 0));
      const unrealizedPnl = parseFloat(String(pos.unrealisedPnl ?? pos.unrealizedPnl ?? 0));
      const update: UserPositionUpdate = {
        exchange: "bybit",
        symbol,
        side,
        size: Math.abs(size),
        entryPrice: Number.isFinite(entryPrice) ? entryPrice : 0,
        markPrice: Number.isFinite(markPrice) ? markPrice : entryPrice,
        unrealizedPnl: Number.isFinite(unrealizedPnl) ? unrealizedPnl : 0,
        timestamp: eventTime,
      };
      this.listener.onPosition?.(update);
    }
  }

  disconnect(): void {
    this.clearPublicTimers();
    this.clearPrivateTimers();
    if (this.ws) {
      this.cleanupWs(this.ws);
      this.ws = null;
    }
    if (this.privateWs) {
      this.cleanupWs(this.privateWs);
      this.privateWs = null;
    }
    this.positionSubscribed = false;
    this.subscriptions.clear();
    this.reconnectAttempts = 0;
    this.privateReconnectAttempts = 0;
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  isPrivateConnected(): boolean {
    return this.privateWs?.readyState === WebSocket.OPEN;
  }
}
