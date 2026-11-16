import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/database";
import { inventory, inventoryEvents, users } from "@/lib/database/schema";
import { requireMembership, assertInventoryAccess } from "@/lib/permissions";
import { assertSameOrigin, handle, ok, ApiError } from "@/lib/api/http";
import { inventoryUpdateSchema } from "@/lib/validation/schemas";
import { recordAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const membership = await requireMembership();
    const { id } = await context.params;
    const item = await assertInventoryAccess(membership.householdId, id);
    const database = await db();
    const events = await database
      .select({
        id: inventoryEvents.id,
        type: inventoryEvents.type,
        payload: inventoryEvents.payload,
        createdAt: inventoryEvents.createdAt,
        userName: users.name,
      })
      .from(inventoryEvents)
      .innerJoin(users, eq(users.id, inventoryEvents.userId))
      .where(eq(inventoryEvents.inventoryId, id))
      .orderBy(desc(inventoryEvents.createdAt))
      .limit(50);
    return ok({ item, events });
  });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    assertSameOrigin(request);
    const membership = await requireMembership();
    const { id } = await context.params;
    const item = await assertInventoryAccess(membership.householdId, id);
    const body = inventoryUpdateSchema.parse(await request.json());
    const { version, ...fields } = body;
    const database = await db();

    const updates: Record<string, unknown> = { updatedAt: new Date(), version: version + 1 };
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) updates[key] = value;
    }
    const dateValueChanged = fields.dateValue !== undefined && fields.dateValue !== item.dateValue;
    if (dateValueChanged && fields.dateValue && fields.dateConfidence === undefined) {
      throw new ApiError(
        422,
        "Confirm the new date before saving.",
        "validation_error",
      );
    }
    if (dateValueChanged && fields.originalDateText === undefined) {
      updates.originalDateText = null;
    }
    if ("dateValue" in fields && fields.dateValue === null) {
      updates.dateType = "unknown";
      updates.dateConfidence = "none";
    }
    if (fields.dateValue && !fields.dateType) {
      updates.dateType = item.dateType === "unknown" ? "best_before" : item.dateType;
    }

    const finalDateValue = (updates.dateValue !== undefined ? updates.dateValue : item.dateValue) as string | null;
    const finalDateType = (updates.dateType !== undefined ? updates.dateType : item.dateType) as string;
    const finalConfidence = (updates.dateConfidence !== undefined
      ? updates.dateConfidence
      : item.dateConfidence) as string;
    if (finalDateValue) {
      if (finalDateType === "unknown") {
        throw new ApiError(422, "Choose whether this is a use-by or best-before date", "validation_error");
      }
      if (finalConfidence === "low" || finalConfidence === "none") {
        throw new ApiError(
          422,
          "Low-confidence dates cannot be saved. Confirm the date or type it manually.",
          "validation_error",
        );
      }
    } else if (finalConfidence !== "none") {
      throw new ApiError(422, "No date value provided", "validation_error");
    }

    const result = await database
      .update(inventory)
      .set(updates)
      .where(and(eq(inventory.id, id), eq(inventory.householdId, membership.householdId), eq(inventory.version, version)))
      .returning();

    if (!result[0]) {
      const current = await assertInventoryAccess(membership.householdId, id);
      throw new ApiError(409, "This item was changed by someone else. Please refresh and try again.", "version_conflict", {
        current,
      });
    }

    await database.insert(inventoryEvents).values({
      id: crypto.randomUUID(),
      householdId: membership.householdId,
      inventoryId: id,
      userId: membership.user.id,
      type: "updated",
      payload: { fields: Object.keys(fields) },
    });
    await recordAudit({
      householdId: membership.householdId,
      userId: membership.user.id,
      action: "inventory.updated",
      entity: "inventory",
      entityId: id,
    });
    return ok({ item: result[0] });
  });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    assertSameOrigin(request);
    const membership = await requireMembership();
    const { id } = await context.params;
    const item = await assertInventoryAccess(membership.householdId, id);
    const url = new URL(request.url);
    const version = Number(url.searchParams.get("version"));
    if (Number.isFinite(version) && version !== item.version) {
      throw new ApiError(409, "This item was changed by someone else. Please refresh and try again.", "version_conflict", {
        current: item,
      });
    }
    const database = await db();
    await database.delete(inventory).where(and(eq(inventory.id, id), eq(inventory.householdId, membership.householdId)));
    await database.insert(inventoryEvents).values({
      id: crypto.randomUUID(),
      householdId: membership.householdId,
      inventoryId: null,
      userId: membership.user.id,
      type: "deleted",
      payload: { name: item.name, quantity: Number(item.quantity), unit: item.unit },
    });
    await recordAudit({
      householdId: membership.householdId,
      userId: membership.user.id,
      action: "inventory.deleted",
      entity: "inventory",
      entityId: id,
    });
    return ok({ success: true });
  });
}
