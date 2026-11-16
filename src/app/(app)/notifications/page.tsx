import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/database";
import { notifications } from "@/lib/database/schema";
import { requireMembership } from "@/lib/permissions";
import { NotificationsClient } from "@/features/notifications/notifications-client";
import { ensureDailyNotifications } from "@/lib/notifications/generate";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
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
  return <NotificationsClient initial={rows} />;
}
