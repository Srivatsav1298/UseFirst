"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Check,
  ChefHat,
  Clock,
  Flame,
  Loader2,
  Plus,
  ShoppingBasket,
  Sparkles,
  UtensilsCrossed,
} from "lucide-react";
import { useI18n } from "@/i18n/provider";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Card, Badge } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import {
  matchIngredients,
  recommendRecipes,
  type Ingredient,
  type RecipeRecommendation,
  type StockItem,
} from "@/lib/meals/recommend";
import { formatQuantity, cn } from "@/lib/utils";

type Recipe = {
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
  ingredients: Ingredient[];
};

type Plan = {
  id: string;
  recipeId: string;
  plannedFor: string;
  servings: number;
  status: "planned" | "cooked" | "skipped";
  recipeName: string;
};

export function MealsClient({
  recipes,
  stock,
  plans,
  preferences,
}: {
  recipes: Recipe[];
  stock: StockItem[];
  plans: Plan[];
  preferences: { dietaryTags: string[]; householdServings: number };
}) {
  const { t } = useI18n();
  const [tab, setTab] = useState<"suggested" | "all" | "plan">("suggested");
  const [maxMinutes, setMaxMinutes] = useState(0);
  const [dietary, setDietary] = useState<string[]>(preferences.dietaryTags);
  const [selected, setSelected] = useState<Recipe | null>(null);

  const tags = useMemo(() => {
    const set = new Set<string>();
    for (const recipe of recipes) for (const tag of recipe.dietaryTags) set.add(tag);
    return [...set].sort();
  }, [recipes]);

  const recommendations = useMemo(
    () =>
      recommendRecipes(recipes, stock, {
        dietaryTags: dietary,
        maxMinutes: maxMinutes || undefined,
        limit: 30,
      }),
    [recipes, stock, dietary, maxMinutes],
  );

  const allMatches = useMemo(
    () =>
      recipes
        .map((recipe) => {
          const matched = matchIngredients(recipe.ingredients, stock);
          const required = matched.filter((m) => !m.optional);
          return {
            recipe,
            matched,
            availableCount: required.filter((m) => m.available).length,
            missing: required.filter((m) => !m.available),
            usesExpiring: matched.filter((m) => m.available && m.expiring),
            score: 0,
          } satisfies RecipeRecommendation<Recipe>;
        })
        .filter(
          (entry) =>
            dietary.every((tag) => entry.recipe.dietaryTags.includes(tag)) &&
            (!maxMinutes || entry.recipe.cookingTimeMinutes <= maxMinutes),
        )
        .sort((a, b) => b.availableCount - a.availableCount || a.recipe.name.localeCompare(b.recipe.name)),
    [recipes, stock, dietary, maxMinutes],
  );

  const selectedMatch = useMemo(
    () => (selected ? matchIngredients(selected.ingredients, stock) : []),
    [selected, stock],
  );

  const list = tab === "suggested" ? recommendations : allMatches;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{t("meals.title")}</h1>
        <p className="mt-1 text-sm text-stone-500">{t("meals.subtitle")}</p>
      </header>

      <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-xl border border-stone-200 bg-white p-1" role="tablist">
        {(
          [
            ["suggested", t("meals.suggested"), Sparkles],
            ["all", t("meals.allRecipes"), ChefHat],
            ["plan", t("meals.planTitle"), CalendarDays],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              "flex min-h-10 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-sm font-medium",
              tab === id ? "bg-forest-600 text-white" : "text-stone-600 hover:bg-stone-50",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      {tab !== "plan" ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-xs font-medium text-stone-600">
              <Clock className="h-4 w-4 text-stone-400" aria-hidden="true" />
              {t("meals.maxTime")}
              <Select
                value={String(maxMinutes)}
                onChange={(e) => setMaxMinutes(Number(e.target.value))}
                className="h-9 w-auto min-w-28 py-1 text-xs"
              >
                <option value="0">{t("meals.anyTime")}</option>
                <option value="15">15 min</option>
                <option value="30">30 min</option>
                <option value="45">45 min</option>
                <option value="60">60 min</option>
              </Select>
            </label>
          </div>
          {tags.length ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium text-stone-600">{t("meals.dietFilter")}:</span>
              {tags.map((tag) => {
                const active = dietary.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    aria-pressed={active}
                    onClick={() =>
                      setDietary((current) =>
                        active ? current.filter((x) => x !== tag) : [...current, tag],
                      )
                    }
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs font-medium capitalize",
                      active
                        ? "border-forest-600 bg-forest-600 text-white"
                        : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50",
                    )}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === "plan" ? (
        <Card>
          <h2 className="mb-3 text-base font-semibold">{t("meals.planTitle")}</h2>
          {plans.length === 0 ? (
            <p className="text-sm text-stone-500">{t("meals.noPlans")}</p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {plans.map((plan) => (
                <li key={plan.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{plan.recipeName}</p>
                    <p className="text-xs text-stone-500">
                      {plan.plannedFor} · {t("meals.servings", { count: plan.servings })}
                    </p>
                  </div>
                  <Badge tone={plan.status === "cooked" ? "success" : plan.status === "skipped" ? "neutral" : "info"}>
                    {t(`meals.status.${plan.status}`)}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : list.length === 0 ? (
        <Card className="py-10 text-center">
          <ChefHat className="mx-auto h-8 w-8 text-sage-500" aria-hidden="true" />
          <p className="mt-2 text-sm text-stone-600">{t("meals.empty")}</p>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {list.map((entry) => (
            <RecipeCard key={entry.recipe.id} entry={entry} onOpen={() => setSelected(entry.recipe)} />
          ))}
        </div>
      )}

      <RecipeModal
        recipe={selected}
        matched={selectedMatch}
        defaultServings={preferences.householdServings}
        onClose={() => setSelected(null)}
        onCooked={() => setSelected(null)}
        onPlanned={() => setSelected(null)}
      />
    </div>
  );
}

function RecipeCard({ entry, onOpen }: { entry: RecipeRecommendation<Recipe>; onOpen: () => void }) {
  const { t } = useI18n();
  const required = entry.matched.filter((m) => !m.optional);
  const total = required.length;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex flex-col rounded-2xl border border-stone-200 bg-white p-4 text-left shadow-soft transition-colors hover:border-forest-200"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold">{entry.recipe.name}</h3>
          <p className="mt-0.5 line-clamp-2 text-xs text-stone-500">{entry.recipe.description}</p>
        </div>
        <Badge tone={entry.missing.length === 0 ? "success" : "warning"}>
          {entry.availableCount}/{total}
        </Badge>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500">
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          {t("meals.minutes", { count: entry.recipe.cookingTimeMinutes })}
        </span>
        <span className="inline-flex items-center gap-1">
          <UtensilsCrossed className="h-3.5 w-3.5" aria-hidden="true" />
          {t("meals.servings", { count: entry.recipe.servings })}
        </span>
        {entry.usesExpiring.length ? (
          <span className="inline-flex items-center gap-1 font-medium text-amber-700">
            <Flame className="h-3.5 w-3.5" aria-hidden="true" />
            {t("meals.uses")}: {entry.usesExpiring.slice(0, 2).map((m) => m.inventoryName || m.name).join(", ")}
          </span>
        ) : null}
      </div>
      {entry.missing.length ? (
        <p className="mt-2 text-xs text-stone-500">
          {t("meals.missing")}: {entry.missing.map((m) => m.name).slice(0, 4).join(", ")}
          {entry.missing.length > 4 ? "…" : ""}
        </p>
      ) : (
        <p className="mt-2 text-xs font-medium text-forest-700">{t("meals.noneMissing")}</p>
      )}
    </button>
  );
}

function RecipeModal({
  recipe,
  matched,
  defaultServings,
  onClose,
  onCooked,
  onPlanned,
}: {
  recipe: Recipe | null;
  matched: ReturnType<typeof matchIngredients>;
  defaultServings: number;
  onClose: () => void;
  onCooked: () => void;
  onPlanned: () => void;
}) {
  const { t } = useI18n();
  const { toast } = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState<null | "cook" | "plan" | "missing">(null);
  const [servings, setServings] = useState(defaultServings);
  const [updateInventory, setUpdateInventory] = useState(true);
  const [planDate, setPlanDate] = useState(new Date().toISOString().slice(0, 10));

  if (!recipe) return null;

  const required = matched.filter((m) => !m.optional);
  const missing = required.filter((m) => !m.available);
  const steps = recipe.instructions
    .split(/\n+/)
    .map((step) => step.trim())
    .filter(Boolean);

  async function cook() {
    setBusy("cook");
    try {
      const response = await fetch("/api/meals/cook", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          recipeId: recipe!.id,
          servings,
          updateInventory,
          planFor: new Date().toISOString().slice(0, 10),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast(data.error || t("errors.generic"), "error");
        return;
      }
      toast(t("meals.cooked"));
      onCooked();
      router.refresh();
    } catch {
      toast(t("errors.offline"), "error");
    } finally {
      setBusy(null);
    }
  }

  async function plan() {
    setBusy("plan");
    try {
      const response = await fetch("/api/meals/plan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ recipeId: recipe!.id, plannedFor: planDate, servings }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast(data.error || t("errors.generic"), "error");
        return;
      }
      toast(t("meals.planned"));
      onPlanned();
      router.refresh();
    } catch {
      toast(t("errors.offline"), "error");
    } finally {
      setBusy(null);
    }
  }

  async function addMissing() {
    setBusy("missing");
    try {
      for (const item of missing) {
        await fetch("/api/shopping", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: item.name,
            quantity: item.quantity,
            unit: item.unit,
            category: "other",
          }),
        });
      }
      toast(t("meals.missingAdded"));
      router.refresh();
    } catch {
      toast(t("errors.offline"), "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Modal open={Boolean(recipe)} onClose={onClose} title={recipe.name} size="lg">
      <div className="space-y-5">
        <div>
          <p className="text-sm text-stone-600">{recipe.description}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge tone="info">
              <Clock className="h-3 w-3" /> {t("meals.minutes", { count: recipe.cookingTimeMinutes })}
            </Badge>
            <Badge tone="neutral">
              <UtensilsCrossed className="h-3 w-3" /> {t("meals.servings", { count: recipe.servings })}
            </Badge>
            <Badge tone={missing.length ? "warning" : "success"}>
              {t("meals.available", { count: required.length - missing.length, total: required.length })}
            </Badge>
            {recipe.dietaryTags.map((tag) => (
              <Badge key={tag} tone="neutral" className="capitalize">
                {tag}
              </Badge>
            ))}
          </div>
        </div>

        <section>
          <h3 className="mb-2 text-sm font-semibold">{t("meals.ingredients")}</h3>
          <ul className="space-y-1.5">
            {matched.map((item, index) => (
              <li key={`${item.name}-${index}`} className="flex items-start gap-2 text-sm">
                <span
                  className={cn(
                    "mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px]",
                    item.available ? "bg-forest-100 text-forest-700" : "bg-stone-100 text-stone-400",
                  )}
                  aria-hidden="true"
                >
                  {item.available ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                </span>
                <span className={cn(!item.available && "text-stone-500")}>
                  {formatQuantity(item.quantity)} {t(`unit.${item.unit}` as Parameters<typeof t>[0])} {item.name}
                  {item.optional ? <span className="text-xs text-stone-400"> ({t("common.optional")})</span> : null}
                  {item.available && item.inventoryName ? (
                    <span className="text-xs text-forest-700"> · {t("meals.have")}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
          {missing.length ? (
            <Button variant="secondary" size="sm" className="mt-3" onClick={addMissing} disabled={busy !== null}>
              {busy === "missing" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingBasket className="h-4 w-4" />}
              {t("meals.addMissing")}
            </Button>
          ) : null}
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold">{t("meals.instructions")}</h3>
          <ol className="list-inside list-decimal space-y-1.5 text-sm text-stone-700">
            {steps.map((step, index) => (
              <li key={index}>{step.replace(/^\d+[.)]\s*/, "")}</li>
            ))}
          </ol>
        </section>

        {recipe.allergens.length ? (
          <section>
            <h3 className="mb-1 text-sm font-semibold">{t("meals.allergens")}</h3>
            <p className="text-sm text-stone-600">{recipe.allergens.join(", ")}</p>
          </section>
        ) : null}

        <p className="rounded-xl bg-sage-50 px-3 py-2 text-xs text-sage-900">{t("meals.safety")}</p>

        <div className="grid gap-3 rounded-2xl border border-stone-200 p-4 sm:grid-cols-2">
          <Field label={t("settings.servings")} htmlFor="cook-servings">
            <Input
              id="cook-servings"
              type="number"
              min="1"
              max="30"
              value={servings}
              onChange={(e) => setServings(Number(e.target.value) || 1)}
            />
          </Field>
          <Field label={t("common.date")} htmlFor="plan-date">
            <Input id="plan-date" type="date" value={planDate} onChange={(e) => setPlanDate(e.target.value)} />
          </Field>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-stone-300"
              checked={updateInventory}
              onChange={(e) => setUpdateInventory(e.target.checked)}
            />
            {t("meals.updateStock")}
          </label>
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <Button onClick={cook} disabled={busy !== null}>
              {busy === "cook" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChefHat className="h-4 w-4" />}
              {t("meals.cook")}
            </Button>
            <Button variant="outline" onClick={plan} disabled={busy !== null || !planDate}>
              {busy === "plan" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarDays className="h-4 w-4" />}
              {t("meals.plan")}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
