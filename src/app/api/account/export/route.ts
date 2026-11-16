import { eq } from "drizzle-orm";
import { db } from "@/lib/database";
import {
  foodWasteRecords,
  householdMembers,
  householdInvitations,
  inventory,
  inventoryEvents,
  mealPlans,
  shoppingListItems,
  userPreferences,
  users,
} from "@/lib/database/schema";
import { requireUser } from "@/lib/auth/session";
import { getMembership } from "@/lib/permissions";
import { handle } from "@/lib/api/http";
import { recordAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const user = await requireUser();
    const membership = await getMembership(user.id);
    const database = await db();
    const prefs = await database.select().from(userPreferences).where(eq(userPreferences.userId, user.id)).limit(1);
    const payload: Record<string, unknown> = {
      exportedAt: new Date().toISOString(),
      format: "use-first-export-v1",
      user: { id: user.id, name: user.name, email: user.email, locale: user.locale },
      preferences: prefs[0] ?? null,
      household: null,
    };
    if (membership) {
      const [items, events, shopping, waste, plans, members, invitations] = await Promise.all([
        database.select().from(inventory).where(eq(inventory.householdId, membership.householdId)),
        database.select().from(inventoryEvents).where(eq(inventoryEvents.householdId, membership.householdId)),
        database.select().from(shoppingListItems).where(eq(shoppingListItems.householdId, membership.householdId)),
        database.select().from(foodWasteRecords).where(eq(foodWasteRecords.householdId, membership.householdId)),
        database.select().from(mealPlans).where(eq(mealPlans.householdId, membership.householdId)),
        database
          .select({ userId: users.id, name: users.name, email: users.email, role: householdMembers.role })
          .from(householdMembers)
          .innerJoin(users, eq(users.id, householdMembers.userId))
          .where(eq(householdMembers.householdId, membership.householdId)),
        database
          .select({ id: householdInvitations.id, role: householdInvitations.role, createdAt: householdInvitations.createdAt, acceptedAt: householdInvitations.acceptedAt })
          .from(householdInvitations)
          .where(eq(householdInvitations.householdId, membership.householdId)),
      ]);
      payload.household = {
        id: membership.householdId,
        name: membership.householdName,
        role: membership.role,
        members,
        invitations,
        inventory: items,
        inventoryEvents: events,
        shoppingListItems: shopping,
        foodWasteRecords: waste,
        mealPlans: plans,
      };
    }
    await recordAudit({
      householdId: membership?.householdId,
      userId: user.id,
      action: "data.exported",
      entity: "user",
      entityId: user.id,
    });
    return new Response(JSON.stringify(payload, null, 2), {
      headers: {
        "content-type": "application/json",
        "content-disposition": `attachment; filename="use-first-export-${new Date().toISOString().slice(0, 10)}.json"`,
        "cache-control": "no-store",
      },
    });
  });
}
