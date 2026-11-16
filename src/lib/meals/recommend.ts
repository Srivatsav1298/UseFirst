export type StockItem = {
  name: string;
  category?: string | null;
  quantity: number;
  unit: string;
  dateValue: string | null;
  dateType: "use_by" | "best_before" | "unknown";
};

export type Ingredient = {
  name: string;
  quantity: number;
  unit: string;
  optional?: boolean;
};

export type MatchedIngredient = Ingredient & {
  available: boolean;
  inventoryName?: string;
  expiring: boolean;
  days: number | null;
};

const STOP_WORDS = new Set(["fresh", "chopped", "diced", "minced", "large", "small", "medium", "of", "the"]);

export function normalizeIngredient(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9æøå\s]/g, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w))
    .map((w) => (w.endsWith("s") && w.length > 3 ? w.slice(0, -1) : w));
}

export function ingredientMatches(ingredient: string, stockName: string): boolean {
  const a = normalizeIngredient(ingredient);
  const b = normalizeIngredient(stockName);
  if (!a.length || !b.length) return false;
  const aJoined = a.join(" ");
  const bJoined = b.join(" ");
  return aJoined.includes(bJoined) || bJoined.includes(aJoined);
}

function daysUntil(value: string, now: Date): number {
  const target = new Date(`${value}T00:00:00Z`).getTime();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((target - today) / 86_400_000);
}

export function matchIngredients(
  ingredients: Ingredient[],
  stock: StockItem[],
  now = new Date(),
): MatchedIngredient[] {
  return ingredients.map((ingredient) => {
    const candidates = stock.filter((item) => ingredientMatches(ingredient.name, item.name));
    const best = candidates.sort((x, y) => {
      const xd = x.dateValue ? daysUntil(x.dateValue, now) : 9999;
      const yd = y.dateValue ? daysUntil(y.dateValue, now) : 9999;
      return xd - yd;
    })[0];
    const days = best?.dateValue ? daysUntil(best.dateValue, now) : null;
    return {
      ...ingredient,
      available: Boolean(best),
      inventoryName: best?.name,
      expiring: days !== null && days <= 3,
      days,
    };
  });
}

export type RecipeLike = {
  id: string;
  name: string;
  cookingTimeMinutes: number;
  dietaryTags: string[];
  servings: number;
  ingredients: Ingredient[];
};

export type RecipeRecommendation<T extends RecipeLike = RecipeLike> = {
  recipe: T;
  matched: MatchedIngredient[];
  availableCount: number;
  missing: MatchedIngredient[];
  usesExpiring: MatchedIngredient[];
  score: number;
};

export function recommendRecipes<T extends RecipeLike>(
  recipes: T[],
  stock: StockItem[],
  options: { dietaryTags?: string[]; maxMinutes?: number; now?: Date; limit?: number } = {},
): RecipeRecommendation<T>[] {
  const now = options.now || new Date();
  const maxMinutes = options.maxMinutes ?? Infinity;
  const requiredTags = options.dietaryTags ?? [];
  return recipes
    .filter((r) => r.cookingTimeMinutes <= maxMinutes)
    .filter((r) => requiredTags.every((tag) => r.dietaryTags.includes(tag)))
    .map((recipe) => {
      const matched = matchIngredients(recipe.ingredients, stock, now);
      const required = matched.filter((m) => !m.optional);
      const availableCount = required.filter((m) => m.available).length;
      const missing = required.filter((m) => !m.available);
      const usesExpiring = matched.filter((m) => m.available && m.expiring);
      const coverage = required.length ? availableCount / required.length : 0;
      const score =
        coverage * 60 +
        Math.min(usesExpiring.length, 3) * 12 -
        missing.length * 8 -
        recipe.cookingTimeMinutes / 60;
      return { recipe, matched, availableCount, missing, usesExpiring, score: Number(score.toFixed(2)) };
    })
    .filter((r) => r.availableCount > 0)
    .sort((a, b) => b.score - a.score || a.missing.length - b.missing.length)
    .slice(0, options.limit ?? 8);
}
