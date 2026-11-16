import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/database";
import {
  inventory,
  inventoryEvents,
  mealPlans,
  recipeIngredients,
  recipes,
} from "@/lib/database/schema";
import { requireMembership } from "@/lib/permissions";
import { assertSameOrigin, handle, ok, ApiError } from "@/lib/api/http";
import { cookSchema } from "@/lib/validation/schemas";
import { ingredientMatches } from "@/lib/meals/recommend";
import { convertQuantity, unitsCompatible } from "@/lib/meals/units";
import { recordAudit } from "@/lib/audit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handle(async () => {
    assertSameOrigin(request);
    const membership = await requireMembership();
    const body = cookSchema.parse(await request.json());
    const database = await db();

    const recipeRows = await database.select().from(recipes).where(eq(recipes.id, body.recipeId)).limit(1);
    const recipe = recipeRows[0];
    if (!recipe) throw new ApiError(404, "Recipe not found.", "not_found");
    const ingredientRows = await database
      .select()
      .from(recipeIngredients)
      .where(eq(recipeIngredients.recipeId, recipe.id));

    const factor = body.servings / recipe.servings;
    const consumed: { name: string; quantity: number; unit: string }[] = [];

    await database.transaction(async (tx) => {
      if (body.updateInventory) {
        const stock = await tx
          .select()
          .from(inventory)
          .where(
            and(
              eq(inventory.householdId, membership.householdId),
              sql`NOT (${inventory.dateType} = 'use_by' AND ${inventory.dateValue} < CURRENT_DATE)`,
            ),
          )
          .orderBy(sql`${inventory.dateValue} ASC NULLS LAST`);
        const remaining = new Map(stock.map((row) => [row.id, Number(row.quantity)]));

        for (const ingredient of ingredientRows) {
          if (ingredient.optional) continue;
          let needed = Math.round(Number(ingredient.quantity) * factor * 100) / 100;
          if (needed <= 0) continue;
          for (const row of stock) {
            if (needed <= 0) break;
            const available = remaining.get(row.id) ?? 0;
            if (available <= 0) continue;
            if (!ingredientMatches(ingredient.name, row.name)) continue;
            if (!unitsCompatible(ingredient.unit, row.unit)) continue;
            const neededInRowUnit = convertQuantity(needed, ingredient.unit, row.unit);
            if (neededInRowUnit === null || neededInRowUnit <= 0) continue;
            const take = Math.min(available, neededInRowUnit);
            const left = Math.round((available - take) * 100) / 100;
            remaining.set(row.id, left);
            const consumedInIngredientUnit = convertQuantity(take, row.unit, ingredient.unit);
            if (consumedInIngredientUnit === null) continue;
            needed = Math.round((needed - consumedInIngredientUnit) * 100) / 100;
            consumed.push({ name: row.name, quantity: take, unit: row.unit });
            await tx.insert(inventoryEvents).values({
              id: crypto.randomUUID(),
              householdId: membership.householdId,
              inventoryId: row.id,
              userId: membership.user.id,
              type: "consumed",
              payload: {
                name: row.name,
                quantity: take,
                unit: row.unit,
                price: row.price ? Number(row.price) : null,
                value: row.price ? Math.round(Number(row.price) * take * 100) / 100 : null,
                recipeId: recipe.id,
              },
            });
            if (left <= 0) {
              await tx.delete(inventory).where(eq(inventory.id, row.id));
            } else {
              await tx
                .update(inventory)
                .set({ quantity: String(left), version: row.version + 1, updatedAt: new Date() })
                .where(eq(inventory.id, row.id));
            }
          }
        }
      }

      await tx.insert(mealPlans).values({
        id: crypto.randomUUID(),
        householdId: membership.householdId,
        recipeId: recipe.id,
        plannedFor: body.planFor ?? new Date().toISOString().slice(0, 10),
        servings: body.servings,
        status: "cooked",
        createdBy: membership.user.id,
      });
    });

    await recordAudit({
      householdId: membership.householdId,
      userId: membership.user.id,
      action: "meal.cooked",
      entity: "recipe",
      entityId: recipe.id,
      meta: { servings: body.servings, consumed },
    });

    return ok({ success: true, consumed });
  });
}
