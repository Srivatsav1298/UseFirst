import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/database";
import { userPreferences, users } from "@/lib/database/schema";
import { hashPassword } from "@/lib/auth/password";
import { createSession, setSessionCookie } from "@/lib/auth/session";
import { assertSameOrigin, clientKey, handle, ok, ApiError, rateLimit } from "@/lib/api/http";
import { registerSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handle(async () => {
    assertSameOrigin(request);
    rateLimit(clientKey(request, "register"), 10, 15 * 60 * 1000);
    const body = registerSchema.parse(await request.json());
    const database = await db();

    const existing = await database
      .select({ id: users.id })
      .from(users)
      .where(eq(sql`lower(${users.email})`, body.email))
      .limit(1);
    if (existing.length) throw new ApiError(409, "An account with this email already exists.", "email_exists");

    const userId = crypto.randomUUID();
    const passwordHash = await hashPassword(body.password);
    await database.transaction(async (tx) => {
      await tx.insert(users).values({
        id: userId,
        email: body.email,
        name: body.name,
        passwordHash,
        locale: body.locale,
      });
      await tx.insert(userPreferences).values({ userId, locale: body.locale });
    });

    const session = await createSession(userId);
    await setSessionCookie(session.token, session.expiresAt);
    return ok({ user: { id: userId, email: body.email, name: body.name, locale: body.locale } }, { status: 201 });
  });
}
