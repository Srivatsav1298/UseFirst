import Link from "next/link";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { AlertTriangle, ArrowRight, ChefHat, Leaf, ListChecks, Plus, ScanLine, ShoppingBasket } from "lucide-react";
import { db } from "@/lib/database";
import {
  inventory,
  inventoryEvents,
  recipeIngredients,
  recipes,
  shoppingListItems,
  userPreferences,
  users,
} from "@/lib/database/schema";
import { requireMembership } from "@/lib/permissions";
import { getPriority, needsAttention } from "@/lib/inventory/priority";
import { formatDate, daysUntil } from "@/lib/date-recognition/parse";
import { recommendRecipes, type Ingredient, type StockItem } from "@/lib/meals/recommend";
import { translate } from "@/i18n";
import { getServerLocale } from "@/lib/locale";
import { formatQuantity } from "@/lib/utils";
import { Card, CardHeader, Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const membership = await requireMembership();
  const locale = await getServerLocale();
  const t = (key: Parameters<typeof translate>[1], vars?: Record<string, string | number>) =>
    translate(locale, key, vars);
  const database = await db();
  const since = new Date(Date.now() - 14 * 86_400_000);

  const [stockRows, recentEvents, shoppingCount, recipeRows, ingredientRows, prefsRows] = await Promise.all([
    database
      .select()
      .from(inventory)
      .where(eq(inventory.householdId, membership.householdId))
      .orderBy(sql`${inventory.dateValue} ASC NULLS LAST`),
    database
      .select({
        id: inventoryEvents.id,
        type: inventoryEvents.type,
        payload: inventoryEvents.payload,
        createdAt: inventoryEvents.createdAt,
        userName: users.name,
      })
      .from(inventoryEvents)
      .innerJoin(users, eq(users.id, inventoryEvents.userId))
      .where(and(eq(inventoryEvents.householdId, membership.householdId), gte(inventoryEvents.createdAt, since)))
      .orderBy(desc(inventoryEvents.createdAt))
      .limit(6),
    database
      .select({ count: sql<number>`count(*)::int` })
      .from(shoppingListItems)
      .where(and(eq(shoppingListItems.householdId, membership.householdId), eq(shoppingListItems.checked, false))),
    database.select().from(recipes),
    database.select().from(recipeIngredients),
    database.select().from(userPreferences).where(eq(userPreferences.userId, membership.user.id)).limit(1),
  ]);

  const priority = stockRows.map((item) => ({ ...item, priority: getPriority(item) }));
  const attention = priority.filter((item) => needsAttention(item));
  const pastUseBy = attention.filter((item) => item.priority.status === "past_use_by");
  const recent = [...stockRows].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 4);

  const stock: StockItem[] = stockRows
    .filter((row) => !(row.dateType === "use_by" && row.dateValue && daysUntil(row.dateValue) < 0))
    .map((row) => ({
      name: row.name,
      category: row.category,
      quantity: Number(row.quantity),
      unit: row.unit,
      dateValue: row.dateValue,
      dateType: row.dateType,
    }));
  const ingredientsByRecipe = new Map<string, Ingredient[]>();
  for (const row of ingredientRows) {
    const list = ingredientsByRecipe.get(row.recipeId) ?? [];
    list.push({ name: row.name, quantity: Number(row.quantity), unit: row.unit, optional: row.optional });
    ingredientsByRecipe.set(row.recipeId, list);
  }
  const mealIdeas = recommendRecipes(
    recipeRows.map((recipe) => ({
      id: recipe.id,
      name: recipe.name,
      cookingTimeMinutes: recipe.cookingTimeMinutes,
      dietaryTags: recipe.dietaryTags,
      servings: recipe.servings,
      ingredients: ingredientsByRecipe.get(recipe.id) ?? [],
    })),
    stock,
    { dietaryTags: prefsRows[0]?.dietaryTags ?? [], limit: 3 },
  );

  const totalShopping = shoppingCount[0]?.count ?? 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-1">
        <p className="text-sm text-stone-500">{membership.householdName}</p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {t("dashboard.greeting", { name: membership.user.name.split(" ")[0] })}
        </h1>
        <p className="text-sm text-stone-500">{t("dashboard.subtitle")}</p>
      </header>

      {stockRows.length === 0 ? (
        <Card className="bg-gradient-to-br from-forest-600 to-forest-800 text-white">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-md">
              <h2 className="text-xl font-semibold">{t("dashboard.emptyTitle")}</h2>
              <p className="mt-1.5 text-sm text-forest-50/90">{t("dashboard.emptyBody")}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/scan">
                <Button variant="secondary" className="bg-white text-forest-800 hover:bg-forest-50">
                  <ScanLine className="h-4 w-4" />
                  {t("dashboard.scanFirst")}
                </Button>
              </Link>
              <Link href="/scan?tab=manual">
                <Button variant="ghost" className="text-white hover:bg-white/10">
                  <Plus className="h-4 w-4" />
                  {t("dashboard.addManual")}
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">{t("dashboard.products")}</p>
          <p className="mt-1 text-2xl font-bold">{stockRows.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">{t("dashboard.attention")}</p>
          <p className="mt-1 text-2xl font-bold text-amber-700">{attention.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">{t("nav.shopping")}</p>
          <p className="mt-1 text-2xl font-bold">{totalShopping}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">{t("nav.meals")}</p>
          <p className="mt-1 text-2xl font-bold">{mealIdeas.length}</p>
        </Card>
      </div>

      {pastUseBy.length > 0 ? (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" role="alert">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold">{t("dashboard.expiredUseBy")}</p>
            <p className="mt-0.5">
              {pastUseBy
                .slice(0, 4)
                .map((item) => item.name)
                .join(", ")}
              {pastUseBy.length > 4 ? "…" : ""}
            </p>
          </div>
        </div>
      ) : null}

      <section aria-labelledby="use-first-heading">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="use-first-heading" className="flex items-center gap-2 text-lg font-semibold">
            <Leaf className="h-5 w-5 text-forest-600" aria-hidden="true" />
            {t("dashboard.useFirst")}
          </h2>
          <Link href="/food" className="flex items-center gap-1 text-sm font-medium text-forest-700 hover:underline">
            {t("common.viewAll")} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        {attention.length === 0 ? (
          <Card className="flex items-center gap-3 border-forest-100 bg-forest-50/60 py-4">
            <Leaf className="h-5 w-5 text-forest-600" aria-hidden="true" />
            <p className="text-sm text-forest-900">{t("dashboard.useFirstEmpty")}</p>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {attention.slice(0, 6).map((item) => (
              <Link
                key={item.id}
                href={`/food/${item.id}`}
                className="group flex items-center gap-3 rounded-2xl border border-stone-200 bg-white p-3.5 shadow-soft transition-colors hover:border-forest-200"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-forest-50 text-forest-700">
                  <ShoppingBasket className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{item.name}</p>
                  <p className="truncate text-xs text-stone-500">
                    {item.dateValue
                      ? `${t(`dateType.${item.dateType}` as Parameters<typeof t>[0])} · ${formatDate(item.dateValue, locale)}`
                      : t("priority.noDate")}
                    {" · "}
                    {formatQuantity(item.quantity)} {t(`unit.${item.unit}` as Parameters<typeof t>[0])}
                  </p>
                </div>
                <Badge tone={item.priority.severity === "danger" ? "danger" : item.priority.severity === "warning" ? "warning" : "info"}>
                  {t(item.priority.labelKey as Parameters<typeof t>[0])}
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="meals-heading">
          <CardHeader
            title={<span id="meals-heading">{t("dashboard.meals")}</span>}
            action={
              <Link href="/meals" className="text-sm font-medium text-forest-700 hover:underline">
                {t("common.viewAll")}
              </Link>
            }
          />
          {mealIdeas.length === 0 ? (
            <EmptyState icon={<ChefHat className="h-7 w-7" />} title={t("meals.empty")} />
          ) : (
            <div className="space-y-3">
              {mealIdeas.map((idea) => (
                <Link key={idea.recipe.id} href="/meals" className="block">
                  <Card className="flex items-center gap-3 p-4 transition-colors hover:border-forest-200">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sage-100 text-sage-700">
                      <ChefHat className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{idea.recipe.name}</p>
                      <p className="text-xs text-stone-500">
                        {t("meals.available", { count: idea.availableCount, total: idea.recipe.ingredients.filter((i) => !i.optional).length })}
                        {" · "}
                        {t("meals.minutes", { count: idea.recipe.cookingTimeMinutes })}
                      </p>
                    </div>
                    {idea.usesExpiring.length > 0 ? <Badge tone="success">{t("meals.uses")}</Badge> : null}
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section aria-labelledby="activity-heading">
          <CardHeader
            title={<span id="activity-heading">{t("dashboard.activity")}</span>}
            action={
              <Link href="/household" className="text-sm font-medium text-forest-700 hover:underline">
                {t("household.activity")}
              </Link>
            }
          />
          <Card className="divide-y divide-stone-100 p-0">
            {recentEvents.length === 0 ? (
              <p className="p-5 text-sm text-stone-500">{t("household.noActivity")}</p>
            ) : (
              recentEvents.map((event) => {
                const payload = event.payload as Record<string, unknown>;
                return (
                  <div key={event.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="h-2 w-2 shrink-0 rounded-full bg-forest-400" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">
                        <span className="font-medium">{event.userName}</span>{" "}
                        <span className="text-stone-600">{event.type.replaceAll("_", " ")}</span>{" "}
                        <span className="font-medium">{String(payload.name ?? "")}</span>
                      </p>
                      <p className="text-xs text-stone-400">
                        {new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(event.createdAt))}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </Card>
        </section>
      </div>

      <section aria-labelledby="recent-heading">
        <CardHeader
          title={<span id="recent-heading">{t("dashboard.recent")}</span>}
          action={
            <Link href="/scan" className="inline-flex items-center gap-1 text-sm font-medium text-forest-700 hover:underline">
              <ScanLine className="h-4 w-4" /> {t("nav.scan")}
            </Link>
          }
        />
        {recent.length === 0 ? (
          <EmptyState
            icon={<ShoppingBasket className="h-7 w-7" />}
            title={t("dashboard.noProducts")}
            action={
              <Link href="/scan">
                <Button>
                  <ScanLine className="h-4 w-4" /> {t("dashboard.scanFirst")}
                </Button>
              </Link>
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {recent.map((item) => (
              <Link key={item.id} href={`/food/${item.id}`}>
                <Card className="p-4 transition-colors hover:border-forest-200">
                  <p className="truncate text-sm font-semibold">{item.name}</p>
                  <p className="mt-0.5 truncate text-xs text-stone-500">
                    {formatQuantity(item.quantity)} {t(`unit.${item.unit}` as Parameters<typeof t>[0])}
                    {item.brand ? ` · ${item.brand}` : ""}
                  </p>
                  <p className="mt-2 text-xs text-stone-400">
                    {t("common.added")} {new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(new Date(item.createdAt))}
                  </p>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      {totalShopping > 0 ? (
        <Link href="/shopping" className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <ListChecks className="h-5 w-5" aria-hidden="true" />
          <span className="flex-1">{t("notifications.shopping", { count: totalShopping })}</span>
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      ) : null}
    </div>
  );
}
