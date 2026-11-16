import { describe, expect, it } from "vitest";
import {
  ingredientMatches,
  matchIngredients,
  normalizeIngredient,
  recommendRecipes,
  type Ingredient,
  type StockItem,
} from "@/lib/meals/recommend";

const now = new Date("2026-06-15T12:00:00Z");

const stock: StockItem[] = [
  { name: "Chicken breast", quantity: 400, unit: "g", dateValue: "2026-06-16", dateType: "use_by" },
  { name: "Rice", quantity: 500, unit: "g", dateValue: null, dateType: "unknown" },
  { name: "Onion", quantity: 2, unit: "pcs", dateValue: "2026-06-25", dateType: "best_before" },
  { name: "Spinach", quantity: 100, unit: "g", dateValue: "2026-06-17", dateType: "use_by" },
];

const ingredients: Ingredient[] = [
  { name: "chicken breasts", quantity: 300, unit: "g" },
  { name: "rice", quantity: 200, unit: "g" },
  { name: "onions", quantity: 1, unit: "pcs" },
  { name: "spinach", quantity: 50, unit: "g", optional: true },
];

describe("normalizeIngredient", () => {
  it("removes stop words, punctuation and plural endings", () => {
    expect(normalizeIngredient("Fresh chopped onions!")).toEqual(["onion"]);
    expect(normalizeIngredient("chicken breasts")).toEqual(["chicken", "breast"]);
  });
});

describe("ingredientMatches", () => {
  it("matches singular/plural and descriptive names", () => {
    expect(ingredientMatches("onions", "Onion")).toBe(true);
    expect(ingredientMatches("chicken breasts", "Chicken breast")).toBe(true);
    expect(ingredientMatches("rice", "Basmati rice")).toBe(true);
    expect(ingredientMatches("spinach", "Milk")).toBe(false);
    expect(ingredientMatches("smoke bread", "Smoke milk")).toBe(false);
    expect(ingredientMatches("tomato sauce", "Soy sauce")).toBe(false);
  });
});

describe("matchIngredients", () => {
  it("prefers the batch that expires soonest", () => {
    const matched = matchIngredients(
      [{ name: "chicken breast", quantity: 100, unit: "g" }],
      [
        { name: "Chicken breast", quantity: 1, unit: "g", dateValue: "2026-07-01", dateType: "use_by" },
        { name: "Chicken breast", quantity: 1, unit: "g", dateValue: "2026-06-16", dateType: "use_by" },
      ],
      now,
    );
    expect(matched[0].days).toBe(1);
    expect(matched[0].expiring).toBe(true);
  });

  it("marks unavailable ingredients", () => {
    const matched = matchIngredients([{ name: "cream", quantity: 1, unit: "dl" }], stock, now);
    expect(matched[0].available).toBe(false);
    expect(matched[0].expiring).toBe(false);
    expect(matched[0].days).toBeNull();
  });
});

describe("recommendRecipes", () => {
  const recipes = [
    {
      id: "chicken-rice",
      name: "Chicken and rice",
      cookingTimeMinutes: 25,
      dietaryTags: ["gluten-free"],
      servings: 4,
      ingredients,
    },
    {
      id: "rice-bowl",
      name: "Simple rice bowl",
      cookingTimeMinutes: 10,
      dietaryTags: ["vegan", "vegetarian"],
      servings: 2,
      ingredients: [
        { name: "rice", quantity: 200, unit: "g" },
        { name: "onion", quantity: 1, unit: "pcs" },
      ],
    },
    {
      id: "slow-roast",
      name: "Slow roast",
      cookingTimeMinutes: 120,
      dietaryTags: ["vegan"],
      servings: 6,
      ingredients: [{ name: "onion", quantity: 4, unit: "pcs" }],
    },
    {
      id: "empty",
      name: "Missing everything",
      cookingTimeMinutes: 15,
      dietaryTags: [],
      servings: 2,
      ingredients: [{ name: "lobster", quantity: 1, unit: "pcs" }],
    },
  ];

  it("filters by cooking time and dietary tags", () => {
    const result = recommendRecipes(recipes, stock, { maxMinutes: 30, dietaryTags: ["vegan"], now });
    expect(result.map((r) => r.recipe.id)).toEqual(["rice-bowl"]);
  });

  it("excludes recipes with no available required ingredients", () => {
    const result = recommendRecipes(recipes, stock, { now });
    expect(result.some((r) => r.recipe.id === "empty")).toBe(false);
  });

  it("scores recipes that use expiring food higher", () => {
    const result = recommendRecipes(recipes, stock, { maxMinutes: 30, now });
    const chicken = result.find((r) => r.recipe.id === "chicken-rice");
    const rice = result.find((r) => r.recipe.id === "rice-bowl");
    expect(chicken?.usesExpiring.map((m) => m.name)).toEqual(["chicken breasts", "spinach"]);
    expect(chicken?.score).toBeGreaterThan(rice?.score ?? 0);
  });

  it("reports missing required ingredients", () => {
    const result = recommendRecipes(recipes, stock, { now });
    const chicken = result.find((r) => r.recipe.id === "chicken-rice");
    expect(chicken?.missing).toEqual([]);
  });

  it("respects the limit", () => {
    const result = recommendRecipes(recipes, stock, { now, limit: 1 });
    expect(result).toHaveLength(1);
  });
});
