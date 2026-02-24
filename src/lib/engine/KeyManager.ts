import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";

const ALG = "aes-256-gcm";
const KEY_LEN = 32;
const IV_LEN = 16;
const AUTH_TAG_LEN = 16;
const DEFAULT_KEYS_PATH = "data/secure_keys.json";

export type StoredKeys = {
  binance?: { apiKey: string; secretKey: string };
  bybit?: { apiKey: string; secret: string };
};

function getEncryptionSecret(): string {
  const raw = process.env.KEYS_ENCRYPTION_SECRET;
  const secret = typeof raw === "string" ? raw.trim() : "";
  if (!secret || secret.length < 16) {
    throw new Error(
      "KEYS_ENCRYPTION_SECRET must be set in .env.local (min 16 chars). " +
        "Add it from .env.local.example and restart the server."
    );
  }
  return secret;
}

function deriveKey(secret: string): Buffer {
  return crypto.createHash("sha256").update(secret, "utf8").digest();
}

function encrypt(plaintext: string, key: Buffer): string {
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALG, key, iv, { authTagLength: AUTH_TAG_LEN });
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

function decrypt(encoded: string, key: Buffer): string {
  const buf = Buffer.from(encoded, "base64");
  if (buf.length < IV_LEN + AUTH_TAG_LEN) throw new Error("Invalid encrypted payload");
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + AUTH_TAG_LEN);
  const data = buf.subarray(IV_LEN + AUTH_TAG_LEN);
  const decipher = crypto.createDecipheriv(ALG, key, iv, { authTagLength: AUTH_TAG_LEN });
  decipher.setAuthTag(tag);
  return decipher.update(data) + decipher.final("utf8");
}

/**
 * Securely store and load Binance/Bybit API keys. Keys are encrypted with
 * KEYS_ENCRYPTION_SECRET from .env.local and stored in data/secure_keys.json.
 */
export class KeyManager {
  private keysPath: string;

  constructor(keysPath: string = DEFAULT_KEYS_PATH) {
    this.keysPath = path.isAbsolute(keysPath) ? keysPath : path.join(process.cwd(), keysPath);
  }

  private ensureDataDir(): void {
    const dir = path.dirname(this.keysPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  encryptAndSave(keys: StoredKeys): void {
    const secret = getEncryptionSecret();
    const key = deriveKey(secret);
    const toEncrypt = JSON.stringify(keys);
    const encrypted = encrypt(toEncrypt, key);
    this.ensureDataDir();
    fs.writeFileSync(this.keysPath, JSON.stringify({ encrypted }), "utf8");
  }

  loadAndDecrypt(): StoredKeys {
    if (!fs.existsSync(this.keysPath)) {
      return {};
    }
    const secret = getEncryptionSecret();
    const key = deriveKey(secret);
    const raw = fs.readFileSync(this.keysPath, "utf8");
    let data: { encrypted?: string };
    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error("Invalid secure_keys.json format");
    }
    if (!data.encrypted || typeof data.encrypted !== "string") {
      throw new Error("Missing encrypted payload");
    }
    const decrypted = decrypt(data.encrypted, key);
    return JSON.parse(decrypted) as StoredKeys;
  }

  hasStoredKeys(): boolean {
    if (!fs.existsSync(this.keysPath)) return false;
    try {
      const k = this.loadAndDecrypt();
      return !!(k.binance?.apiKey && k.binance?.secretKey) || !!(k.bybit?.apiKey && k.bybit?.secret);
    } catch {
      return false;
    }
  }
}
