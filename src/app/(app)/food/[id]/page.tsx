import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/database";
import { inventory, inventoryEvents, users } from "@/lib/database/schema";
import { requireMembership } from "@/lib/permissions";
import { InventoryDetail } from "@/features/inventory/inventory-detail";

export const dynamic = "force-dynamic";

export default async function FoodItemPage({ params }: { params: Promise<{ id: string }> }) {
  const membership = await requireMembership();
  const { id } = await params;
  const database = await db();

  const rows = await database
    .select({ item: inventory, addedByName: users.name })
    .from(inventory)
    .innerJoin(users, eq(users.id, inventory.addedBy))
    .where(and(eq(inventory.id, id), eq(inventory.householdId, membership.householdId)))
    .limit(1);

  const row = rows[0];
  if (!row) notFound();

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

  return <InventoryDetail item={{ ...row.item, addedByName: row.addedByName }} events={events} />;
}
