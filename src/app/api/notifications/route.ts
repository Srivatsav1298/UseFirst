import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/database";
import { notifications } from "@/lib/database/schema";
import { requireMembership } from "@/lib/permissions";
import { assertSameOrigin, handle, ok } from "@/lib/api/http";
import { ensureDailyNotifications } from "@/lib/notifications/generate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const membership = await requireMembership();
    await ensureDailyNotifications({
      userId: membership.user.id,
      householdId: membership.householdId,
      locale: membership.user.locale,
    });
    const database = await db();
    const rows = await database
      .select()
      .from(notifications)
      .where(eq(notifications.userId, membership.user.id))
      .orderBy(desc(notifications.createdAt))
      .limit(30);
    return ok({ notifications: rows });
  });
}

export async function PATCH(request: Request) {
  return handle(async () => {
    assertSameOrigin(request);
    const membership = await requireMembership();
    const database = await db();
    await database
      .update(notifications)
      .set({ readAt: new Date() })
      .where(eq(notifications.userId, membership.user.id));
    return ok({ success: true });
  });
}
