import * as crypto from "crypto";

const BASE = "https://fapi.binance.com";

function sign(secretKey: string, query: string): string {
  return crypto.createHmac("sha256", secretKey).update(query).digest("hex");
}

export async function getAccount(apiKey: string, secretKey: string): Promise<{
  canTrade: boolean;
  canWithdraw: boolean;
}> {
  const timestamp = Date.now();
  const query = `timestamp=${timestamp}`;
  const signature = sign(secretKey, query);
  const url = `${BASE}/fapi/v2/account?${query}&signature=${signature}`;
  const res = await fetch(url, {
    method: "GET",
    headers: { "X-MBX-APIKEY": apiKey },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `Binance account request failed: ${res.status}`);
  }
  const data = (await res.json()) as {
    canTrade?: boolean;
    canWithdraw?: boolean;
  };
  return {
    canTrade: data.canTrade === true,
    canWithdraw: data.canWithdraw === true,
  };
}

export async function getPositionMode(apiKey: string, secretKey: string): Promise<boolean> {
  const timestamp = Date.now();
  const query = `timestamp=${timestamp}`;
  const signature = sign(secretKey, query);
  const url = `${BASE}/fapi/v1/positionSide/dual?${query}&signature=${signature}`;
  const res = await fetch(url, {
    method: "GET",
    headers: { "X-MBX-APIKEY": apiKey },
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `Binance position mode request failed: ${res.status}`);
  }
  const data = (await res.json()) as { dualSidePosition?: boolean };
  return data.dualSidePosition === true;
}
