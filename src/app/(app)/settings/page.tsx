import { eq } from "drizzle-orm";
import { db } from "@/lib/database";
import { userPreferences } from "@/lib/database/schema";
import { requireUser } from "@/lib/auth/session";
import { SettingsClient } from "@/features/settings/settings-client";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireUser();
  const database = await db();
  const rows = await database.select().from(userPreferences).where(eq(userPreferences.userId, user.id)).limit(1);
  const prefs = rows[0];
  const initial = {
    locale: (prefs?.locale ?? user.locale) === "nb" ? ("nb" as const) : ("en" as const),
    currency: prefs?.currency ?? "USD",
    units: prefs?.units ?? ("metric" as const),
    notificationFrequency: prefs?.notificationFrequency ?? ("daily" as const),
    dietaryTags: prefs?.dietaryTags ?? [],
    householdServings: prefs?.householdServings ?? 4,
  };
  return <SettingsClient initial={initial} />;
}
