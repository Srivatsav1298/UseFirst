import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/lib/database";
import { inventory, inventoryEvents, users } from "@/lib/database/schema";
import { requireMembership } from "@/lib/permissions";
import { assertSameOrigin, handle, ok, ApiError } from "@/lib/api/http";
import { inventoryCreateSchema } from "@/lib/validation/schemas";
import { recordAudit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handle(async () => {
    const membership = await requireMembership();
    const database = await db();
    const url = new URL(request.url);
    const search = url.searchParams.get("search")?.trim();
    const location = url.searchParams.get("location");
    const rows = await database
      .select({
        item: inventory,
        addedByName: users.name,
      })
      .from(inventory)
      .innerJoin(users, eq(users.id, inventory.addedBy))
      .where(
        and(
          eq(inventory.householdId, membership.householdId),
          location && location !== "all"
            ? sql`${inventory.storageLocation} = ${location}`
            : undefined,
          search
            ? or(ilike(inventory.name, `%${search}%`), ilike(inventory.brand, `%${search}%`))
            : undefined,
        ),
      )
      .orderBy(sql`${inventory.dateValue} ASC NULLS LAST`, desc(inventory.createdAt));

    const items = rows.map((row) => ({ ...row.item, addedByName: row.addedByName }));
    return ok({ items, householdId: membership.householdId });
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    assertSameOrigin(request);
    const membership = await requireMembership();
    const url = new URL(request.url);
    const allowDuplicate = url.searchParams.get("allowDuplicate") === "true";
    const body = inventoryCreateSchema.parse(await request.json());
    const database = await db();

    if (body.barcode && !allowDuplicate) {
      const existing = await database
        .select({ id: inventory.id, name: inventory.name, quantity: inventory.quantity, unit: inventory.unit })
        .from(inventory)
        .where(and(eq(inventory.householdId, membership.householdId), eq(inventory.barcode, body.barcode)))
        .limit(1);
      if (existing[0]) {
        throw new ApiError(409, "This barcode is already in your kitchen.", "duplicate_inventory", existing[0]);
      }
    }

    const id = crypto.randomUUID();
    const inserted = await database
      .insert(inventory)
      .values({
        id,
        householdId: membership.householdId,
        productId: body.productId ?? null,
        name: body.name,
        brand: body.brand ?? null,
        barcode: body.barcode ?? null,
        category: body.category ?? null,
        quantity: String(body.quantity),
        unit: body.unit,
        packageSize: body.packageSize ?? null,
        imageUrl: body.imageUrl ?? null,
        dateValue: body.dateValue ?? null,
        dateType: body.dateValue ? body.dateType : "unknown",
        originalDateText: body.originalDateText ?? null,
        dateConfidence: body.dateValue ? body.dateConfidence : "none",
        storageLocation: body.storageLocation,
        notes: body.notes ?? null,
        price: body.price !== null && body.price !== undefined ? String(body.price) : null,
        currency: body.currency,
        addedBy: membership.user.id,
      })
      .returning();

    await database.insert(inventoryEvents).values({
      id: crypto.randomUUID(),
      householdId: membership.householdId,
      inventoryId: id,
      userId: membership.user.id,
      type: "added",
      payload: {
        name: body.name,
        quantity: body.quantity,
        unit: body.unit,
        barcode: body.barcode ?? null,
        source: body.productId ? "catalogue" : "manual",
      },
    });
    await recordAudit({
      householdId: membership.householdId,
      userId: membership.user.id,
      action: "inventory.created",
      entity: "inventory",
      entityId: id,
    });

    return ok({ item: inserted[0] }, { status: 201 });
  });
}
