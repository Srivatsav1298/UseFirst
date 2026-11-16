import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/database";
import { users } from "@/lib/database/schema";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, setSessionCookie } from "@/lib/auth/session";
import { assertSameOrigin, clientKey, handle, ok, ApiError, rateLimit } from "@/lib/api/http";
import { loginSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handle(async () => {
    assertSameOrigin(request);
    rateLimit(clientKey(request, "login"), 15, 15 * 60 * 1000);
    const body = loginSchema.parse(await request.json());
    const database = await db();
    const rows = await database
      .select()
      .from(users)
      .where(eq(sql`lower(${users.email})`, body.email))
      .limit(1);
    const user = rows[0];
    const valid = user ? await verifyPassword(body.password, user.passwordHash) : false;
    if (!user || !valid) throw new ApiError(401, "Email or password is incorrect.", "invalid_credentials");

    const session = await createSession(user.id);
    await setSessionCookie(session.token, session.expiresAt);
    return ok({ user: { id: user.id, email: user.email, name: user.name, locale: user.locale } });
  });
}
