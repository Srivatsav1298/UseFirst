import { eq } from "drizzle-orm";
import { db } from "@/lib/database";
import { mealPlans, recipes } from "@/lib/database/schema";
import { requireMembership } from "@/lib/permissions";
import { assertSameOrigin, handle, ok, ApiError } from "@/lib/api/http";
import { planSchema } from "@/lib/validation/schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handle(async () => {
    assertSameOrigin(request);
    const membership = await requireMembership();
    const body = planSchema.parse(await request.json());
    const database = await db();
    const recipe = await database.select({ id: recipes.id }).from(recipes).where(eq(recipes.id, body.recipeId)).limit(1);
    if (!recipe[0]) throw new ApiError(404, "Recipe not found.", "not_found");
    const inserted = await database
      .insert(mealPlans)
      .values({
        id: crypto.randomUUID(),
        householdId: membership.householdId,
        recipeId: body.recipeId,
        plannedFor: body.plannedFor,
        servings: body.servings,
        status: "planned",
        createdBy: membership.user.id,
      })
      .returning();
    return ok({ plan: inserted[0] }, { status: 201 });
  });
}
