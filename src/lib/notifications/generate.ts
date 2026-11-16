import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/database";
import { inventory, notifications, shoppingListItems, userPreferences } from "@/lib/database/schema";
import { needsAttention } from "@/lib/inventory/priority";
import { translate } from "@/i18n";

export async function ensureDailyNotifications(input: {
  userId: string;
  householdId: string;
  locale: string;
}): Promise<void> {
  const database = await db();
  const prefs = (
    await database.select().from(userPreferences).where(eq(userPreferences.userId, input.userId)).limit(1)
  )[0];
  const frequency = prefs?.notificationFrequency ?? "daily";
  if (frequency === "off") return;
  const locale = prefs?.locale ?? input.locale;

  const since = new Date();
  if (frequency === "weekly") {
    since.setDate(since.getDate() - 7);
  } else {
    since.setHours(0, 0, 0, 0);
  }
  const existing = await database
    .select({ id: notifications.id })
    .from(notifications)
    .where(and(eq(notifications.userId, input.userId), gte(notifications.createdAt, since)))
    .limit(1);
  if (existing.length) return;

  const [stock, shopping] = await Promise.all([
    database
      .select({ name: inventory.name, dateValue: inventory.dateValue, dateType: inventory.dateType })
      .from(inventory)
      .where(eq(inventory.householdId, input.householdId)),
    database
      .select({ count: sql<number>`count(*)::int` })
      .from(shoppingListItems)
      .where(
        and(
          eq(shoppingListItems.householdId, input.householdId),
          eq(shoppingListItems.checked, false),
        ),
      ),
  ]);

  const attention = stock.filter((row) => needsAttention(row));
  const values: (typeof notifications.$inferInsert)[] = [];
  if (attention.length > 0) {
    values.push({
      id: crypto.randomUUID(),
      userId: input.userId,
      householdId: input.householdId,
      type: "attention",
      title: translate(locale, "notifications.attentionTitle"),
      body: translate(locale, "notifications.attentionBody", {
        count: attention.length,
        names: attention
          .slice(0, 3)
          .map((row) => row.name)
          .join(", "),
      }),
    });
  }
  const shoppingCount = shopping[0]?.count ?? 0;
  if (shoppingCount > 0) {
    values.push({
      id: crypto.randomUUID(),
      userId: input.userId,
      householdId: input.householdId,
      type: "shopping",
      title: translate(locale, "notifications.shoppingTitle"),
      body: translate(locale, "notifications.shoppingBody", { count: shoppingCount }),
    });
  }
  if (values.length) await database.insert(notifications).values(values);
}
