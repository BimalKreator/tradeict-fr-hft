import * as jose from "jose";

const AUTH_COOKIE = "auth";
const JWT_ALG = "HS256";

export function getAuthCookieName(): string {
  return AUTH_COOKIE;
}

export function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET || "dev-secret-change-in-production";
  return new TextEncoder().encode(secret);
}

export async function createToken(payload: { sub: string; email: string }, expHours = 2): Promise<string> {
  const secret = getJwtSecret();
  return new jose.SignJWT({ ...payload })
    .setProtectedHeader({ alg: JWT_ALG })
    .setIssuedAt()
    .setExpirationTime(`${expHours}h`)
    .sign(secret);
}

export async function verifyToken(token: string): Promise<{ sub: string; email: string } | null> {
  try {
    const secret = getJwtSecret();
    const { payload } = await jose.jwtVerify(token, secret, { algorithms: [JWT_ALG] });
    const sub = payload.sub as string | undefined;
    const email = payload.email as string | undefined;
    if (typeof sub !== "string" || typeof email !== "string") return null;
    return { sub, email };
  } catch {
    return null;
  }
}
