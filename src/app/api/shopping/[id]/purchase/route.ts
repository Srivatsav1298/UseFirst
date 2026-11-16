import { and, eq } from "drizzle-orm";
import { db } from "@/lib/database";
import { inventory, inventoryEvents, shoppingListItems } from "@/lib/database/schema";
import { requireMembership } from "@/lib/permissions";
import { assertSameOrigin, handle, ok, ApiError } from "@/lib/api/http";
import { purchaseSchema } from "@/lib/validation/schemas";
import { recordAudit } from "@/lib/audit";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    assertSameOrigin(request);
    const membership = await requireMembership();
    const { id } = await context.params;
    const body = purchaseSchema.parse(await request.json());
    const database = await db();

    const rows = await database
      .select()
      .from(shoppingListItems)
      .where(and(eq(shoppingListItems.id, id), eq(shoppingListItems.householdId, membership.householdId)))
      .limit(1);
    const item = rows[0];
    if (!item) throw new ApiError(404, "Shopping item not found.", "not_found");

    let createdInventory = null;
    await database.transaction(async (tx) => {
      if (body.addToInventory && body.inventory) {
        const inv = body.inventory;
        if (inv.barcode) {
          const duplicate = await tx
            .select({ id: inventory.id })
            .from(inventory)
            .where(and(eq(inventory.householdId, membership.householdId), eq(inventory.barcode, inv.barcode)))
            .limit(1);
          if (duplicate[0]) throw new ApiError(409, "This barcode is already in your kitchen.", "duplicate_inventory");
        }
        const inventoryId = crypto.randomUUID();
        const inserted = await tx
          .insert(inventory)
          .values({
            id: inventoryId,
            householdId: membership.householdId,
            productId: inv.productId ?? null,
            name: inv.name,
            brand: inv.brand ?? null,
            barcode: inv.barcode ?? null,
            category: inv.category ?? null,
            quantity: String(inv.quantity),
            unit: inv.unit,
            packageSize: inv.packageSize ?? null,
            imageUrl: inv.imageUrl ?? null,
            dateValue: inv.dateValue ?? null,
            dateType: inv.dateValue ? inv.dateType : "unknown",
            originalDateText: inv.originalDateText ?? null,
            dateConfidence: inv.dateValue ? inv.dateConfidence : "none",
            storageLocation: inv.storageLocation,
            notes: inv.notes ?? null,
            price: inv.price !== null && inv.price !== undefined ? String(inv.price) : null,
            currency: inv.currency,
            addedBy: membership.user.id,
          })
          .returning();
        createdInventory = inserted[0];
        await tx.insert(inventoryEvents).values({
          id: crypto.randomUUID(),
          householdId: membership.householdId,
          inventoryId,
          userId: membership.user.id,
          type: "added",
          payload: { name: inv.name, quantity: inv.quantity, unit: inv.unit, source: "shopping" },
        });
      }
      await tx
        .update(shoppingListItems)
        .set({ checked: true, checkedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(shoppingListItems.id, id), eq(shoppingListItems.householdId, membership.householdId)));
    });

    await recordAudit({
      householdId: membership.householdId,
      userId: membership.user.id,
      action: "shopping.purchased",
      entity: "shopping_item",
      entityId: id,
    });
    return ok({ item: createdInventory, addedToInventory: Boolean(createdInventory) });
  });
}
