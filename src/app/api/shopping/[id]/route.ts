import { and, eq } from "drizzle-orm";
import { db } from "@/lib/database";
import { shoppingListItems } from "@/lib/database/schema";
import { requireMembership } from "@/lib/permissions";
import { assertSameOrigin, handle, ok, ApiError } from "@/lib/api/http";
import { shoppingItemUpdateSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";

async function findItem(householdId: string, id: string) {
  const database = await db();
  const rows = await database
    .select()
    .from(shoppingListItems)
    .where(and(eq(shoppingListItems.id, id), eq(shoppingListItems.householdId, householdId)))
    .limit(1);
  if (!rows[0]) throw new ApiError(404, "Shopping item not found.", "not_found");
  return rows[0];
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    assertSameOrigin(request);
    const membership = await requireMembership();
    const { id } = await context.params;
    await findItem(membership.householdId, id);
    const body = shoppingItemUpdateSchema.parse(await request.json());
    const database = await db();
    const updated = await database
      .update(shoppingListItems)
      .set({
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.quantity !== undefined ? { quantity: String(body.quantity) } : {}),
        ...(body.unit !== undefined ? { unit: body.unit } : {}),
        ...(body.category !== undefined ? { category: body.category } : {}),
        ...(body.checked !== undefined
          ? { checked: body.checked, checkedAt: body.checked ? new Date() : null }
          : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(shoppingListItems.id, id), eq(shoppingListItems.householdId, membership.householdId)))
      .returning();
    return ok({ item: updated[0] });
  });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    assertSameOrigin(request);
    const membership = await requireMembership();
    const { id } = await context.params;
    await findItem(membership.householdId, id);
    const database = await db();
    await database
      .delete(shoppingListItems)
      .where(and(eq(shoppingListItems.id, id), eq(shoppingListItems.householdId, membership.householdId)));
    return ok({ success: true });
  });
}
