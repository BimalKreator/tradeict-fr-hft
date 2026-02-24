import { NextResponse } from "next/server";
import { KeyManager, type StoredKeys } from "@/lib/engine/KeyManager";

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

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const keys = parseBody(body);
    if (!keys) {
      return NextResponse.json(
        { error: "Provide at least one exchange with apiKey and secretKey/secret" },
        { status: 400 }
      );
    }
    const manager = new KeyManager();
    manager.encryptAndSave(keys);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to save keys";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
