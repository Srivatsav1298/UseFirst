import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/database";
import { foodWasteRecords, inventory, inventoryEvents, users } from "@/lib/database/schema";
import { requireMembership } from "@/lib/permissions";
import { handle, ok } from "@/lib/api/http";
import { getPriority, needsAttention } from "@/lib/inventory/priority";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const membership = await requireMembership();
    const database = await db();
    const since = new Date(Date.now() - 30 * 86_400_000);

    const [wasteRows, consumedRows, stockRows] = await Promise.all([
      database
        .select()
        .from(foodWasteRecords)
        .where(and(eq(foodWasteRecords.householdId, membership.householdId), gte(foodWasteRecords.createdAt, since)))
        .orderBy(sql`${foodWasteRecords.createdAt} DESC`),
      database
        .select({
          id: inventoryEvents.id,
          payload: inventoryEvents.payload,
          createdAt: inventoryEvents.createdAt,
          userName: users.name,
        })
        .from(inventoryEvents)
        .innerJoin(users, eq(users.id, inventoryEvents.userId))
        .where(
          and(
            eq(inventoryEvents.householdId, membership.householdId),
            eq(inventoryEvents.type, "consumed"),
            gte(inventoryEvents.createdAt, since),
          ),
        )
        .orderBy(sql`${inventoryEvents.createdAt} DESC`),
      database
        .select({
          id: inventory.id,
          name: inventory.name,
          dateValue: inventory.dateValue,
          dateType: inventory.dateType,
          quantity: inventory.quantity,
          unit: inventory.unit,
          storageLocation: inventory.storageLocation,
        })
        .from(inventory)
        .where(eq(inventory.householdId, membership.householdId)),
    ]);

    const wasteValue = wasteRows.reduce((sum, row) => sum + (row.estimatedValue ? Number(row.estimatedValue) : 0), 0);
    const wasteQuantity = wasteRows.reduce((sum, row) => sum + Number(row.quantity), 0);
    const consumedValue = consumedRows.reduce((sum, row) => {
      const value = (row.payload as Record<string, unknown>)?.value;
      return sum + (typeof value === "number" ? value : 0);
    }, 0);
    const consumedQuantity = consumedRows.reduce((sum, row) => {
      const q = (row.payload as Record<string, unknown>)?.quantity;
      return sum + (typeof q === "number" ? q : 0);
    }, 0);

    const byReason = Object.entries(
      wasteRows.reduce<Record<string, { count: number; value: number }>>((acc, row) => {
        const entry = acc[row.reason] ?? { count: 0, value: 0 };
        entry.count += 1;
        entry.value += row.estimatedValue ? Number(row.estimatedValue) : 0;
        acc[row.reason] = entry;
        return acc;
      }, {}),
    ).map(([reason, data]) => ({ reason, ...data }));

    const attention = stockRows
      .map((row) => ({ ...row, priority: getPriority(row) }))
      .filter((row) => needsAttention(row));

    const weekly = Array.from({ length: 5 }, (_, index) => {
      const end = new Date(Date.now() - index * 7 * 86_400_000);
      const start = new Date(end.getTime() - 7 * 86_400_000);
      const inRange = wasteRows.filter((row) => new Date(row.createdAt) >= start && new Date(row.createdAt) < end);
      return {
        weekStart: start.toISOString().slice(0, 10),
        count: inRange.length,
        value: inRange.reduce((sum, row) => sum + (row.estimatedValue ? Number(row.estimatedValue) : 0), 0),
      };
    }).reverse();

    return ok({
      periodDays: 30,
      waste: {
        count: wasteRows.length,
        quantity: Math.round(wasteQuantity * 100) / 100,
        value: Math.round(wasteValue * 100) / 100,
        byReason,
        recent: wasteRows.slice(0, 10),
        weekly,
      },
      consumed: {
        count: consumedRows.length,
        quantity: Math.round(consumedQuantity * 100) / 100,
        value: Math.round(consumedValue * 100) / 100,
      },
      attentionCount: attention.length,
      totalProducts: stockRows.length,
      currency: membership.user.locale ? undefined : undefined,
      explanation:
        "Values use only prices you entered. Discarded value is the sum of recorded waste. Consumed value is the sum of priced items marked consumed. These are records, not guaranteed savings.",
    });
  });
}
