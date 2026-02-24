import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createToken, getAuthCookieName } from "@/lib/auth";

const ADMIN_EMAIL = "admin@tradeicterner.site";
const ADMIN_PLAIN_PASSWORD = "Tikhat@999";
const DEFAULT_HASH =
  "$2b$10$vBezI73sCcbxxODBDSAwe.wbP7.OL5E8fm5K4FTdueQkT/x3mga/y";

function getStoredHash(): string {
  return process.env.ADMIN_PASSWORD_HASH ?? DEFAULT_HASH;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    if (email !== ADMIN_EMAIL) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    const hash = getStoredHash();
    const valid = await bcrypt.compare(password, hash);
    if (!valid) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    const token = await createToken(
      { sub: "admin", email: ADMIN_EMAIL },
      2
    );
    const cookieName = getAuthCookieName();
    const res = NextResponse.json({ ok: true });
    res.cookies.set(cookieName, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 2 * 60 * 60,
      path: "/",
    });
    return res;
  } catch {
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
