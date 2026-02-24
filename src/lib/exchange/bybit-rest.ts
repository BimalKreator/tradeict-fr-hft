import * as crypto from "crypto";

const BASE = "https://api.bybit.com";
const RECV_WINDOW = "5000";

function sign(secret: string, payload: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

export async function getAccountInfo(apiKey: string, secret: string): Promise<{ ok: boolean }> {
  const timestamp = Date.now().toString();
  const query = "";
  const signPayload = timestamp + apiKey + RECV_WINDOW + query;
  const signature = sign(secret, signPayload);
  const url = `${BASE}/v5/account/info`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "X-BAPI-API-KEY": apiKey,
      "X-BAPI-TIMESTAMP": timestamp,
      "X-BAPI-SIGN": signature,
      "X-BAPI-RECV-WINDOW": RECV_WINDOW,
    },
  });
  const data = (await res.json()) as { retCode?: number; retMsg?: string };
  if (data.retCode !== 0 && data.retCode !== undefined) {
    throw new Error(data.retMsg || `Bybit API error: ${res.status}`);
  }
  if (!res.ok) throw new Error(data.retMsg || `Bybit request failed: ${res.status}`);
  return { ok: true };
}

/** Bybit v5: position list returns positionIdx. 0 = one-way, 1/2 = hedge. settleCoin=USDT required for linear. */
export async function getPositionList(apiKey: string, secret: string): Promise<{ hedgeMode: boolean | null }> {
  const timestamp = Date.now().toString();
  const query = "category=linear&settleCoin=USDT";
  const signPayload = timestamp + apiKey + RECV_WINDOW + query;
  const signature = sign(secret, signPayload);
  const url = `${BASE}/v5/position/list?${query}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "X-BAPI-API-KEY": apiKey,
      "X-BAPI-TIMESTAMP": timestamp,
      "X-BAPI-SIGN": signature,
      "X-BAPI-RECV-WINDOW": RECV_WINDOW,
    },
  });
  const data = (await res.json()) as {
    retCode?: number;
    retMsg?: string;
    result?: { list?: Array<{ positionIdx?: number }> };
  };
  if (data.retCode !== 0 && data.retCode !== undefined) {
    throw new Error(data.retMsg || `Bybit API error: ${res.status}`);
  }
  if (!res.ok) throw new Error(data.retMsg || `Bybit request failed: ${res.status}`);
  const list = data.result?.list ?? [];
  if (list.length === 0) return { hedgeMode: null };
  const hasOneWay = list.some((p) => p.positionIdx === 0);
  const hasHedge = list.some((p) => p.positionIdx === 1 || p.positionIdx === 2);
  return { hedgeMode: hasHedge && !hasOneWay };
}
