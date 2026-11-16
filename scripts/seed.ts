import { eq } from "drizzle-orm";
import { db, closeDb } from "../src/lib/database";
import { recipeIngredients, recipes } from "../src/lib/database/schema";

type SeedRecipe = {
  id: string;
  name: string;
  description: string;
  instructions: string;
  cookingTimeMinutes: number;
  difficulty: "easy" | "medium" | "hard";
  dietaryTags: string[];
  allergens: string[];
  cuisine: string;
  servings: number;
  ingredients: { name: string; quantity: number; unit: string; optional?: boolean }[];
};

const seedRecipes: SeedRecipe[] = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    name: "Vegetable frittata",
    description: "A forgiving oven omelette that uses up almost any vegetable.",
    instructions:
      "1. Heat the oven to 190°C.\n2. Cook potato and onion in oil until soft, about 8 minutes.\n3. Add spinach and cook until wilted.\n4. Whisk eggs with a pinch of salt and pepper, then pour over the vegetables.\n5. Sprinkle with cheese and bake for 15–20 minutes until set.",
    cookingTimeMinutes: 30,
    difficulty: "easy",
    dietaryTags: ["vegetarian"],
    allergens: ["eggs", "dairy"],
    cuisine: "european",
    servings: 4,
    ingredients: [
      { name: "eggs", quantity: 6, unit: "item" },
      { name: "potato", quantity: 2, unit: "item" },
      { name: "onion", quantity: 1, unit: "item" },
      { name: "spinach", quantity: 100, unit: "g" },
      { name: "cheese", quantity: 80, unit: "g", optional: true },
    ],
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    name: "Quick tomato pasta",
    description: "A weeknight staple with a short ingredient list.",
    instructions:
      "1. Cook pasta in salted water.\n2. Gently fry garlic in olive oil, add chopped tomatoes and simmer for 10 minutes.\n3. Season and stir through the drained pasta.\n4. Finish with basil and a little olive oil.",
    cookingTimeMinutes: 20,
    difficulty: "easy",
    dietaryTags: ["vegan", "vegetarian"],
    allergens: ["gluten"],
    cuisine: "italian",
    servings: 4,
    ingredients: [
      { name: "pasta", quantity: 400, unit: "g" },
      { name: "tomato", quantity: 4, unit: "item" },
      { name: "garlic", quantity: 2, unit: "item" },
      { name: "olive oil", quantity: 2, unit: "tbsp" },
      { name: "basil", quantity: 1, unit: "bunch", optional: true },
    ],
  },
  {
    id: "00000000-0000-4000-8000-000000000003",
    name: "Chicken and vegetable stir-fry",
    description: "Fast, flexible and good for using up odds and ends.",
    instructions:
      "1. Cook rice according to the packet.\n2. Slice chicken and stir-fry in a hot pan until cooked through.\n3. Add chopped vegetables and garlic, cooking for 4–5 minutes.\n4. Add soy sauce, toss with rice and serve.",
    cookingTimeMinutes: 25,
    difficulty: "easy",
    dietaryTags: [],
    allergens: ["soy"],
    cuisine: "asian",
    servings: 4,
    ingredients: [
      { name: "chicken", quantity: 400, unit: "g" },
      { name: "rice", quantity: 300, unit: "g" },
      { name: "broccoli", quantity: 1, unit: "item" },
      { name: "carrot", quantity: 2, unit: "item" },
      { name: "soy sauce", quantity: 3, unit: "tbsp" },
      { name: "garlic", quantity: 2, unit: "item" },
    ],
  },
  {
    id: "00000000-0000-4000-8000-000000000004",
    name: "Lentil and vegetable soup",
    description: "A cheap, warming soup that keeps well.",
    instructions:
      "1. Soften onion, carrot and celery in oil.\n2. Add lentils, chopped tomatoes and stock.\n3. Simmer for 25–30 minutes until the lentils are tender.\n4. Season to taste and serve with bread.",
    cookingTimeMinutes: 40,
    difficulty: "easy",
    dietaryTags: ["vegan", "vegetarian", "dairy-free"],
    allergens: ["celery"],
    cuisine: "european",
    servings: 4,
    ingredients: [
      { name: "lentils", quantity: 250, unit: "g" },
      { name: "carrot", quantity: 2, unit: "item" },
      { name: "onion", quantity: 1, unit: "item" },
      { name: "celery", quantity: 2, unit: "item" },
      { name: "tomato", quantity: 2, unit: "item" },
      { name: "stock", quantity: 1, unit: "l" },
    ],
  },
  {
    id: "00000000-0000-4000-8000-000000000005",
    name: "Banana oat pancakes",
    description: "A good way to use ripe bananas.",
    instructions:
      "1. Mash the bananas.\n2. Mix with oats, egg, milk and flour to make a thick batter.\n3. Cook spoonfuls in a lightly oiled pan for 2 minutes each side.\n4. Serve with yogurt or fruit.",
    cookingTimeMinutes: 15,
    difficulty: "easy",
    dietaryTags: ["vegetarian"],
    allergens: ["eggs", "dairy", "gluten"],
    cuisine: "international",
    servings: 3,
    ingredients: [
      { name: "banana", quantity: 2, unit: "item" },
      { name: "oats", quantity: 100, unit: "g" },
      { name: "egg", quantity: 1, unit: "item" },
      { name: "milk", quantity: 150, unit: "ml" },
      { name: "flour", quantity: 80, unit: "g" },
    ],
  },
  {
    id: "00000000-0000-4000-8000-000000000006",
    name: "Greek salad",
    description: "No cooking, just chopping. Best with ripe tomatoes and cucumber.",
    instructions:
      "1. Chop tomatoes, cucumber and onion.\n2. Add olives and cubed feta.\n3. Dress with olive oil, salt and pepper.",
    cookingTimeMinutes: 10,
    difficulty: "easy",
    dietaryTags: ["vegetarian", "gluten-free"],
    allergens: ["dairy"],
    cuisine: "greek",
    servings: 4,
    ingredients: [
      { name: "cucumber", quantity: 1, unit: "item" },
      { name: "tomato", quantity: 4, unit: "item" },
      { name: "feta", quantity: 150, unit: "g" },
      { name: "olives", quantity: 100, unit: "g", optional: true },
      { name: "onion", quantity: 1, unit: "item" },
      { name: "olive oil", quantity: 2, unit: "tbsp" },
    ],
  },
  {
    id: "00000000-0000-4000-8000-000000000007",
    name: "Egg fried rice",
    description: "The classic use-it-up dish for leftover rice.",
    instructions:
      "1. Heat oil in a wide pan.\n2. Scramble the eggs and set aside.\n3. Fry onion, peas and carrot for 3 minutes.\n4. Add cooked rice, soy sauce and the eggs. Toss until hot.",
    cookingTimeMinutes: 15,
    difficulty: "easy",
    dietaryTags: ["vegetarian"],
    allergens: ["eggs", "soy"],
    cuisine: "asian",
    servings: 3,
    ingredients: [
      { name: "rice", quantity: 300, unit: "g" },
      { name: "egg", quantity: 3, unit: "item" },
      { name: "peas", quantity: 100, unit: "g" },
      { name: "carrot", quantity: 1, unit: "item" },
      { name: "soy sauce", quantity: 2, unit: "tbsp" },
      { name: "onion", quantity: 1, unit: "item" },
    ],
  },
  {
    id: "00000000-0000-4000-8000-000000000008",
    name: "Potato and leek soup",
    description: "Simple, creamy and comforting.",
    instructions:
      "1. Wash and slice the leeks, then soften with onion in butter.\n2. Add diced potato and stock.\n3. Simmer for 20 minutes until the potato is soft.\n4. Blend, stir in cream and season.",
    cookingTimeMinutes: 35,
    difficulty: "easy",
    dietaryTags: ["vegetarian"],
    allergens: ["dairy"],
    cuisine: "european",
    servings: 4,
    ingredients: [
      { name: "potato", quantity: 4, unit: "item" },
      { name: "leek", quantity: 2, unit: "item" },
      { name: "onion", quantity: 1, unit: "item" },
      { name: "stock", quantity: 1, unit: "l" },
      { name: "cream", quantity: 100, unit: "ml", optional: true },
    ],
  },
  {
    id: "00000000-0000-4000-8000-000000000009",
    name: "Salmon with roast potatoes",
    description: "A complete traybake with minimal washing up.",
    instructions:
      "1. Heat the oven to 200°C.\n2. Toss potatoes in oil and roast for 25 minutes.\n3. Add salmon and broccoli to the tray and cook for a further 12–15 minutes.\n4. Finish with lemon.",
    cookingTimeMinutes: 45,
    difficulty: "medium",
    dietaryTags: ["pescatarian", "gluten-free"],
    allergens: ["fish"],
    cuisine: "european",
    servings: 4,
    ingredients: [
      { name: "salmon", quantity: 4, unit: "item" },
      { name: "potato", quantity: 600, unit: "g" },
      { name: "broccoli", quantity: 1, unit: "item" },
      { name: "lemon", quantity: 1, unit: "item" },
      { name: "olive oil", quantity: 2, unit: "tbsp" },
    ],
  },
  {
    id: "00000000-0000-4000-8000-000000000010",
    name: "Bread pudding",
    description: "Turns stale bread into dessert.",
    instructions:
      "1. Heat the oven to 180°C.\n2. Tear the bread into a baking dish.\n3. Whisk milk, eggs, sugar and cinnamon and pour over.\n4. Bake for 30 minutes until golden and set.",
    cookingTimeMinutes: 40,
    difficulty: "easy",
    dietaryTags: ["vegetarian"],
    allergens: ["gluten", "eggs", "dairy"],
    cuisine: "british",
    servings: 4,
    ingredients: [
      { name: "bread", quantity: 6, unit: "item" },
      { name: "milk", quantity: 400, unit: "ml" },
      { name: "egg", quantity: 3, unit: "item" },
      { name: "sugar", quantity: 60, unit: "g" },
      { name: "cinnamon", quantity: 1, unit: "tsp" },
    ],
  },
  {
    id: "00000000-0000-4000-8000-000000000011",
    name: "Chickpea curry",
    description: "A pantry-friendly curry with a creamy coconut sauce.",
    instructions:
      "1. Fry onion and garlic until soft.\n2. Add curry powder and chopped tomato, cook for 2 minutes.\n3. Add chickpeas and coconut milk, simmer for 15 minutes.\n4. Serve with rice.",
    cookingTimeMinutes: 30,
    difficulty: "easy",
    dietaryTags: ["vegan", "vegetarian", "dairy-free"],
    allergens: [],
    cuisine: "indian",
    servings: 4,
    ingredients: [
      { name: "chickpeas", quantity: 2, unit: "can" },
      { name: "coconut milk", quantity: 400, unit: "ml" },
      { name: "onion", quantity: 1, unit: "item" },
      { name: "tomato", quantity: 2, unit: "item" },
      { name: "curry powder", quantity: 2, unit: "tbsp" },
      { name: "rice", quantity: 300, unit: "g" },
    ],
  },
  {
    id: "00000000-0000-4000-8000-000000000012",
    name: "Yogurt and fruit bowl",
    description: "A quick breakfast that makes the most of ripe fruit.",
    instructions:
      "1. Spoon yogurt into bowls.\n2. Slice the fruit and arrange on top.\n3. Sprinkle with oats and a little honey.",
    cookingTimeMinutes: 5,
    difficulty: "easy",
    dietaryTags: ["vegetarian", "gluten-free"],
    allergens: ["dairy"],
    cuisine: "international",
    servings: 2,
    ingredients: [
      { name: "yogurt", quantity: 300, unit: "g" },
      { name: "banana", quantity: 1, unit: "item" },
      { name: "apple", quantity: 1, unit: "item" },
      { name: "oats", quantity: 40, unit: "g", optional: true },
      { name: "honey", quantity: 1, unit: "tbsp", optional: true },
    ],
  },
  {
    id: "00000000-0000-4000-8000-000000000013",
    name: "Cheese omelette",
    description: "Five minutes, three ingredients.",
    instructions:
      "1. Whisk eggs with a splash of milk.\n2. Melt butter in a non-stick pan.\n3. Pour in the eggs, cook gently, then add cheese and fold.",
    cookingTimeMinutes: 8,
    difficulty: "easy",
    dietaryTags: ["vegetarian", "gluten-free"],
    allergens: ["eggs", "dairy"],
    cuisine: "french",
    servings: 1,
    ingredients: [
      { name: "egg", quantity: 3, unit: "item" },
      { name: "cheese", quantity: 40, unit: "g" },
      { name: "milk", quantity: 20, unit: "ml", optional: true },
      { name: "butter", quantity: 1, unit: "tsp" },
    ],
  },
  {
    id: "00000000-0000-4000-8000-000000000014",
    name: "Cheesy pasta bake",
    description: "Comfort food that uses leftover pasta and cheese.",
    instructions:
      "1. Heat the oven to 200°C.\n2. Fry onion and garlic, add tomatoes and simmer.\n3. Mix with cooked pasta, top with cheese.\n4. Bake for 20 minutes until bubbling.",
    cookingTimeMinutes: 35,
    difficulty: "easy",
    dietaryTags: ["vegetarian"],
    allergens: ["gluten", "dairy"],
    cuisine: "italian",
    servings: 4,
    ingredients: [
      { name: "pasta", quantity: 400, unit: "g" },
      { name: "tomato", quantity: 3, unit: "item" },
      { name: "cheese", quantity: 150, unit: "g" },
      { name: "onion", quantity: 1, unit: "item" },
      { name: "garlic", quantity: 2, unit: "item" },
    ],
  },
];

async function main() {
  const database = await db();
  let created = 0;
  for (const recipe of seedRecipes) {
    const existing = await database.select({ id: recipes.id }).from(recipes).where(eq(recipes.id, recipe.id)).limit(1);
    if (existing.length) continue;
    await database.transaction(async (tx) => {
      await tx.insert(recipes).values({
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
      });
      await tx.insert(recipeIngredients).values(
        recipe.ingredients.map((ingredient) => ({
          id: crypto.randomUUID(),
          recipeId: recipe.id,
          name: ingredient.name,
          quantity: String(ingredient.quantity),
          unit: ingredient.unit,
          optional: ingredient.optional ?? false,
        })),
      );
    });
    created += 1;
  }
  console.log(`Seed complete. ${created} new recipe(s), ${seedRecipes.length} total.`);
  await closeDb();
}

main().catch(async (error) => {
  console.error("Seed failed:", error);
  await closeDb();
  process.exit(1);
});
