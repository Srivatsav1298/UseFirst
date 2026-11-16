import { eq } from "drizzle-orm";
import { db } from "@/lib/database";
import {
  householdMembers,
  households,
  notifications,
  sessions,
  userPreferences,
  users,
} from "@/lib/database/schema";
import { requireUser, clearSessionCookie } from "@/lib/auth/session";
import { verifyPassword } from "@/lib/auth/password";
import { getMembership } from "@/lib/permissions";
import { assertSameOrigin, clientKey, handle, ok, ApiError, rateLimit } from "@/lib/api/http";
import { deleteAccountSchema } from "@/lib/validation/schemas";
import { recordAudit } from "@/lib/audit";

export const runtime = "nodejs";

export async function DELETE(request: Request) {
  return handle(async () => {
    assertSameOrigin(request);
    rateLimit(clientKey(request, "delete-account"), 5, 15 * 60 * 1000);
    const user = await requireUser();
    const body = deleteAccountSchema.parse(await request.json());
    const database = await db();
    const rows = await database.select().from(users).where(eq(users.id, user.id)).limit(1);
    const record = rows[0];
    if (!record || !(await verifyPassword(body.password, record.passwordHash))) {
      throw new ApiError(401, "Password is incorrect.", "invalid_credentials");
    }
    const membership = await getMembership(user.id);
    if (membership) {
      await recordAudit({
        householdId: membership.householdId,
        userId: user.id,
        action: "account.deleted",
        entity: "user",
        entityId: user.id,
      });
      if (membership.role === "owner") {
        await database.transaction(async (tx) => {
          await tx.delete(households).where(eq(households.id, membership.householdId));
          await tx.delete(users).where(eq(users.id, user.id));
        });
      } else {
        await database.transaction(async (tx) => {
          await tx.delete(sessions).where(eq(sessions.userId, user.id));
          await tx.delete(notifications).where(eq(notifications.userId, user.id));
          await tx.delete(userPreferences).where(eq(userPreferences.userId, user.id));
          await tx
            .delete(householdMembers)
            .where(eq(householdMembers.userId, user.id));
          await tx
            .update(users)
            .set({
              email: `deleted-${user.id}@invalid.local`,
              name: "Deleted member",
              passwordHash: "deleted",
              locale: "en",
            })
            .where(eq(users.id, user.id));
        });
      }
    } else {
      await database.delete(users).where(eq(users.id, user.id));
    }
    await clearSessionCookie();
    return ok({ success: true });
  });
}
