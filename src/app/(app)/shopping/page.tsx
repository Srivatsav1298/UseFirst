import { and, eq } from "drizzle-orm";
import { db } from "@/lib/database";
import { inventory, shoppingListItems, shoppingLists } from "@/lib/database/schema";
import { requireMembership } from "@/lib/permissions";
import { ingredientMatches } from "@/lib/meals/recommend";
import { ShoppingClient } from "@/features/shopping/shopping-client";

export const dynamic = "force-dynamic";

export default async function ShoppingPage() {
  const membership = await requireMembership();
  const database = await db();
  const lists = await database
    .select({ id: shoppingLists.id })
    .from(shoppingLists)
    .where(eq(shoppingLists.householdId, membership.householdId))
    .limit(1);

  let listId = lists[0]?.id;
  if (!listId) {
    listId = crypto.randomUUID();
    await database.insert(shoppingLists).values({ id: listId, householdId: membership.householdId, name: "Shopping list" });
  }

  const [items, stock] = await Promise.all([
    database
      .select()
      .from(shoppingListItems)
      .where(eq(shoppingListItems.listId, listId))
      .orderBy(shoppingListItems.checked, shoppingListItems.createdAt),
    database
      .select({ name: inventory.name, quantity: inventory.quantity, unit: inventory.unit })
      .from(inventory)
      .where(and(eq(inventory.householdId, membership.householdId))),
  ]);

  const withMatches = items.map((item) => ({
    ...item,
    atHome: stock
      .filter((s) => ingredientMatches(item.name, s.name))
      .map((m) => ({ name: m.name, quantity: Number(m.quantity), unit: m.unit })),
  }));

  return <ShoppingClient initialItems={withMatches} />;
}
