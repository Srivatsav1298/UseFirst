import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/database";
import { inventory, mealPlans, recipeIngredients, recipes, userPreferences } from "@/lib/database/schema";
import { requireMembership } from "@/lib/permissions";
import type { Ingredient, StockItem } from "@/lib/meals/recommend";
import { MealsClient } from "@/features/meals/meals-client";

export const dynamic = "force-dynamic";

export default async function MealsPage() {
  const membership = await requireMembership();
  const database = await db();

  const [recipeRows, ingredientRows, stockRows, prefsRows, planRows] = await Promise.all([
    database.select().from(recipes),
    database.select().from(recipeIngredients),
    database
      .select({
        id: inventory.id,
        name: inventory.name,
        category: inventory.category,
        quantity: inventory.quantity,
        unit: inventory.unit,
        dateValue: inventory.dateValue,
        dateType: inventory.dateType,
      })
      .from(inventory)
      .where(
        and(
          eq(inventory.householdId, membership.householdId),
          sql`NOT (${inventory.dateType} = 'use_by' AND ${inventory.dateValue} < CURRENT_DATE)`,
        ),
      ),
    database.select().from(userPreferences).where(eq(userPreferences.userId, membership.user.id)).limit(1),
    database
      .select({
        id: mealPlans.id,
        recipeId: mealPlans.recipeId,
        plannedFor: mealPlans.plannedFor,
        servings: mealPlans.servings,
        status: mealPlans.status,
        recipeName: recipes.name,
      })
      .from(mealPlans)
      .innerJoin(recipes, eq(recipes.id, mealPlans.recipeId))
      .where(eq(mealPlans.householdId, membership.householdId))
      .orderBy(mealPlans.plannedFor),
  ]);

  const ingredientsByRecipe = new Map<string, Ingredient[]>();
  for (const row of ingredientRows) {
    const list = ingredientsByRecipe.get(row.recipeId) ?? [];
    list.push({ name: row.name, quantity: Number(row.quantity), unit: row.unit, optional: row.optional });
    ingredientsByRecipe.set(row.recipeId, list);
  }

  const recipeList = recipeRows.map((recipe) => ({
    id: recipe.id,
    name: recipe.name,
    description: recipe.description,
    instructions: recipe.instructions,
    cookingTimeMinutes: recipe.cookingTimeMinutes,
    difficulty: recipe.difficulty,
    dietaryTags: recipe.dietaryTags,
    allergens: recipe.allergens,
    cuisine: recipe.cuisine,
    servings: recipe.servings,
    ingredients: ingredientsByRecipe.get(recipe.id) ?? [],
  }));

  const stock: StockItem[] = stockRows.map((row) => ({
    name: row.name,
    category: row.category,
    quantity: Number(row.quantity),
    unit: row.unit,
    dateValue: row.dateValue,
    dateType: row.dateType,
  }));

  const prefs = prefsRows[0];
  return (
    <MealsClient
      recipes={recipeList}
      stock={stock}
      plans={planRows}
      preferences={
        prefs
          ? {
              dietaryTags: prefs.dietaryTags,
              householdServings: prefs.householdServings,
            }
          : { dietaryTags: [], householdServings: 4 }
      }
    />
  );
}
