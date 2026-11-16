import { and, eq } from "drizzle-orm";
import { db } from "@/lib/database";
import { inventory, shoppingListItems, shoppingLists } from "@/lib/database/schema";
import { requireMembership } from "@/lib/permissions";
import { assertSameOrigin, handle, ok, ApiError } from "@/lib/api/http";
import { shoppingItemCreateSchema } from "@/lib/validation/schemas";
import { ingredientMatches } from "@/lib/meals/recommend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getOrCreateList(householdId: string): Promise<string> {
  const database = await db();
  const existing = await database
    .select({ id: shoppingLists.id })
    .from(shoppingLists)
    .where(eq(shoppingLists.householdId, householdId))
    .limit(1);
  if (existing[0]) return existing[0].id;
  const id = crypto.randomUUID();
  await database.insert(shoppingLists).values({ id, householdId, name: "Shopping list" });
  return id;
}

export async function GET() {
  return handle(async () => {
    const membership = await requireMembership();
    const database = await db();
    const listId = await getOrCreateList(membership.householdId);
    const items = await database
      .select()
      .from(shoppingListItems)
      .where(eq(shoppingListItems.listId, listId))
      .orderBy(shoppingListItems.checked, shoppingListItems.createdAt);
    const stock = await database
      .select({ name: inventory.name, quantity: inventory.quantity, unit: inventory.unit })
      .from(inventory)
      .where(eq(inventory.householdId, membership.householdId));
    const withMatches = items.map((item) => {
      const matches = stock.filter((s) => ingredientMatches(item.name, s.name));
      return {
        ...item,
        atHome: matches.map((m) => ({ name: m.name, quantity: Number(m.quantity), unit: m.unit })),
      };
    });
    return ok({ listId, items: withMatches });
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    assertSameOrigin(request);
    const membership = await requireMembership();
    const body = shoppingItemCreateSchema.parse(await request.json());
    const database = await db();
    const listId = await getOrCreateList(membership.householdId);
    const duplicate = await database
      .select({ id: shoppingListItems.id })
      .from(shoppingListItems)
      .where(
        and(
          eq(shoppingListItems.listId, listId),
          eq(shoppingListItems.checked, false),
          eq(shoppingListItems.name, body.name),
        ),
      )
      .limit(1);
    if (duplicate[0]) {
      throw new ApiError(409, "This item is already on your list.", "duplicate_item", duplicate[0]);
    }
    const inserted = await database
      .insert(shoppingListItems)
      .values({
        id: crypto.randomUUID(),
        listId,
        householdId: membership.householdId,
        name: body.name,
        quantity: String(body.quantity),
        unit: body.unit,
        category: body.category,
        addedBy: membership.user.id,
      })
      .returning();
    return ok({ item: inserted[0] }, { status: 201 });
  });
}
