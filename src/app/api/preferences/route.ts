import { eq } from "drizzle-orm";
import { db } from "@/lib/database";
import { userPreferences } from "@/lib/database/schema";
import { requireUser } from "@/lib/auth/session";
import { assertSameOrigin, handle, ok } from "@/lib/api/http";
import { preferencesSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    const database = await db();
    const rows = await database
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, user.id))
      .limit(1);
    return ok({ preferences: rows[0] ?? null });
  });
}

export async function PATCH(request: Request) {
  return handle(async () => {
    assertSameOrigin(request);
    const user = await requireUser();
    const body = preferencesSchema.parse(await request.json());
    const database = await db();
    const updated = await database
      .insert(userPreferences)
      .values({
        userId: user.id,
        locale: body.locale ?? user.locale,
        currency: body.currency ?? "USD",
        units: body.units ?? "metric",
        notificationFrequency: body.notificationFrequency ?? "daily",
        dietaryTags: body.dietaryTags ?? [],
        householdServings: body.householdServings ?? 4,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: userPreferences.userId,
        set: {
          ...(body.locale !== undefined ? { locale: body.locale } : {}),
          ...(body.currency !== undefined ? { currency: body.currency } : {}),
          ...(body.units !== undefined ? { units: body.units } : {}),
          ...(body.notificationFrequency !== undefined
            ? { notificationFrequency: body.notificationFrequency }
            : {}),
          ...(body.dietaryTags !== undefined ? { dietaryTags: body.dietaryTags } : {}),
          ...(body.householdServings !== undefined ? { householdServings: body.householdServings } : {}),
          updatedAt: new Date(),
        },
      })
      .returning();
    if (body.locale) {
      const { users } = await import("@/lib/database/schema");
      await database.update(users).set({ locale: body.locale, updatedAt: new Date() }).where(eq(users.id, user.id));
    }
    return ok({ preferences: updated[0] });
  });
}
