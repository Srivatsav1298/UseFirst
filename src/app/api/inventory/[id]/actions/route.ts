import { and, eq } from "drizzle-orm";
import { db } from "@/lib/database";
import { foodWasteRecords, inventory, inventoryEvents } from "@/lib/database/schema";
import { requireMembership, assertInventoryAccess } from "@/lib/permissions";
import { assertSameOrigin, handle, ok, ApiError } from "@/lib/api/http";
import { inventoryActionSchema } from "@/lib/validation/schemas";
import { recordAudit } from "@/lib/audit";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    assertSameOrigin(request);
    const membership = await requireMembership();
    const { id } = await context.params;
    const item = await assertInventoryAccess(membership.householdId, id);
    const body = inventoryActionSchema.parse(await request.json());
    const database = await db();

    if (body.action === "freeze" || body.action === "unfreeze") {
      const location = body.action === "freeze" ? "freezer" : "refrigerator";
      const updated = await database
        .update(inventory)
        .set({ storageLocation: location, version: item.version + 1, updatedAt: new Date() })
        .where(and(eq(inventory.id, id), eq(inventory.version, item.version)))
        .returning();
      if (!updated[0]) throw new ApiError(409, "This item was changed by someone else.", "version_conflict");
      await database.insert(inventoryEvents).values({
        id: crypto.randomUUID(),
        householdId: membership.householdId,
        inventoryId: id,
        userId: membership.user.id,
        type: body.action === "freeze" ? "frozen" : "unfrozen",
        payload: { location },
      });
      return ok({ item: updated[0] });
    }

    if (body.action === "quantity") {
      const updated = await database
        .update(inventory)
        .set({ quantity: String(body.quantity), version: item.version + 1, updatedAt: new Date() })
        .where(and(eq(inventory.id, id), eq(inventory.version, body.version)))
        .returning();
      if (!updated[0]) throw new ApiError(409, "This item was changed by someone else.", "version_conflict");
      await database.insert(inventoryEvents).values({
        id: crypto.randomUUID(),
        householdId: membership.householdId,
        inventoryId: id,
        userId: membership.user.id,
        type: "quantity_changed",
        payload: { from: Number(item.quantity), to: body.quantity },
      });
      return ok({ item: updated[0] });
    }

    const currentQuantity = Number(item.quantity);
    const changeQuantity = Math.min(body.quantity ?? currentQuantity, currentQuantity);
    const remaining = Math.round((currentQuantity - changeQuantity) * 100) / 100;
    const unitPrice = item.price ? Number(item.price) : null;

    const estimatedValue =
      body.action === "discard"
        ? body.estimatedValue !== undefined && body.estimatedValue !== null
          ? body.estimatedValue
          : unitPrice !== null
            ? Math.round(unitPrice * changeQuantity * 100) / 100
            : null
        : null;

    const updatedItem = await database.transaction(async (tx) => {
      if (body.action === "discard") {
        await tx.insert(foodWasteRecords).values({
          id: crypto.randomUUID(),
          householdId: membership.householdId,
          inventoryId: id,
          productName: item.name,
          quantity: String(changeQuantity),
          unit: item.unit,
          reason: body.reason,
          estimatedValue: estimatedValue !== null ? String(estimatedValue) : null,
          currency: item.currency,
          recordedBy: membership.user.id,
        });
        await tx.insert(inventoryEvents).values({
          id: crypto.randomUUID(),
          householdId: membership.householdId,
          inventoryId: id,
          userId: membership.user.id,
          type: "discarded",
          payload: {
            name: item.name,
            quantity: changeQuantity,
            unit: item.unit,
            reason: body.reason,
            estimatedValue,
          },
        });
      } else {
        await tx.insert(inventoryEvents).values({
          id: crypto.randomUUID(),
          householdId: membership.householdId,
          inventoryId: id,
          userId: membership.user.id,
          type: "consumed",
          payload: {
            name: item.name,
            quantity: changeQuantity,
            unit: item.unit,
            price: unitPrice,
            value: unitPrice !== null ? Math.round(unitPrice * changeQuantity * 100) / 100 : null,
          },
        });
      }

      if (remaining <= 0) {
        const deleted = await tx
          .delete(inventory)
          .where(
            and(
              eq(inventory.id, id),
              eq(inventory.householdId, membership.householdId),
              eq(inventory.version, item.version),
            ),
          )
          .returning({ id: inventory.id });
        if (!deleted[0]) throw new ApiError(409, "This item was changed by someone else.", "version_conflict");
        return null;
      }

      const updated = await tx
        .update(inventory)
        .set({ quantity: String(remaining), version: item.version + 1, updatedAt: new Date() })
        .where(and(eq(inventory.id, id), eq(inventory.version, item.version)))
        .returning();
      if (!updated[0]) throw new ApiError(409, "This item was changed by someone else.", "version_conflict");
      return updated[0];
    });

    await recordAudit({
      householdId: membership.householdId,
      userId: membership.user.id,
      action: body.action === "discard" ? "inventory.discarded" : "inventory.consumed",
      entity: "inventory",
      entityId: id,
      meta: { quantity: changeQuantity },
    });

    return ok({ item: updatedItem, removed: remaining <= 0 });
  });
}
