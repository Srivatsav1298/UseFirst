import { and, eq } from "drizzle-orm";
import { db } from "@/lib/database";
import { shoppingListItems } from "@/lib/database/schema";
import { requireMembership } from "@/lib/permissions";
import { assertSameOrigin, handle, ok } from "@/lib/api/http";

export const runtime = "nodejs";

export async function DELETE(request: Request) {
  return handle(async () => {
    assertSameOrigin(request);
    const membership = await requireMembership();
    const database = await db();
    await database
      .delete(shoppingListItems)
      .where(and(eq(shoppingListItems.householdId, membership.householdId), eq(shoppingListItems.checked, true)));
    return ok({ success: true });
  });
}
