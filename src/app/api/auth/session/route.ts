import { getCurrentUser } from "@/lib/auth/session";
import { getMembership } from "@/lib/permissions";
import { db } from "@/lib/database";
import { userPreferences } from "@/lib/database/schema";
import { eq } from "drizzle-orm";
import { handle, ok } from "@/lib/api/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const user = await getCurrentUser();
    if (!user) return ok({ user: null, membership: null, preferences: null });
    const membership = await getMembership(user.id);
    const database = await db();
    const prefs = await database
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, user.id))
      .limit(1);
    return ok({ user, membership, preferences: prefs[0] ?? null });
  });
}
