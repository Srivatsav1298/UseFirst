import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { and, eq, gt, lt } from "drizzle-orm";
import { db } from "@/lib/database";
import { sessions, users } from "@/lib/database/schema";

export const SESSION_COOKIE = "usefirst_session";
const TTL_DAYS = Number(process.env.SESSION_TTL_DAYS || 30);

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const database = await db();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + TTL_DAYS * 24 * 60 * 60 * 1000);
  await database.insert(sessions).values({
    id: crypto.randomUUID(),
    tokenHash: hashToken(token),
    userId,
    expiresAt,
  });
  await database.delete(sessions).where(lt(sessions.expiresAt, new Date()));
  return { token, expiresAt };
}

async function shouldUseSecureCookies(): Promise<boolean> {
  const override = process.env.COOKIE_SECURE;
  if (override === "true") return true;
  if (override === "false") return false;
  const requestHeaders = await headers();
  const proto = requestHeaders.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (proto) return proto === "https";
  return (process.env.NEXT_PUBLIC_APP_URL ?? "").startsWith("https://");
}

export async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: await shouldUseSecureCookies(),
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: await shouldUseSecureCookies(),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  locale: string;
};

export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const database = await db();
  const rows = await database
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      locale: users.locale,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return rows[0] ?? null;
}

export async function destroyCurrentSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    const database = await db();
    await database.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  }
  await clearSessionCookie();
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("Authentication required");
  return user;
}

export class AuthError extends Error {
  status = 401;
}
