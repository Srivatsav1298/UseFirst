import Link from "next/link";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { ArrowRight, MapPin, Plus, ScanLine, Search, ShoppingBasket } from "lucide-react";
import { db } from "@/lib/database";
import { inventory, users } from "@/lib/database/schema";
import { requireMembership } from "@/lib/permissions";
import { getPriority } from "@/lib/inventory/priority";
import { formatDate } from "@/lib/date-recognition/parse";
import { translate } from "@/i18n";
import { getServerLocale } from "@/lib/locale";
import { formatQuantity } from "@/lib/utils";
import { Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const locations = ["all", "refrigerator", "freezer", "pantry", "cupboard", "other"] as const;

export default async function FoodPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; location?: string; sort?: string }>;
}) {
  const membership = await requireMembership();
  const locale = await getServerLocale();
  const t = (key: Parameters<typeof translate>[1], vars?: Record<string, string | number>) =>
    translate(locale, key, vars);
  const params = await searchParams;
  const search = params.q?.trim() ?? "";
  const location = params.location && locations.includes(params.location as (typeof locations)[number])
    ? params.location
    : "all";
  const sort = params.sort === "added" || params.sort === "name" ? params.sort : "priority";

  const database = await db();
  const rows = await database
    .select({ item: inventory, addedByName: users.name })
    .from(inventory)
    .innerJoin(users, eq(users.id, inventory.addedBy))
    .where(
      and(
        eq(inventory.householdId, membership.householdId),
        location !== "all" ? sql`${inventory.storageLocation} = ${location}` : undefined,
        search ? or(ilike(inventory.name, `%${search}%`), ilike(inventory.brand, `%${search}%`)) : undefined,
      ),
    )
    .orderBy(sql`${inventory.dateValue} ASC NULLS LAST`, desc(inventory.createdAt));

  const items = rows.map((row) => ({ ...row.item, addedByName: row.addedByName }));
  if (sort === "priority") {
    items.sort((a, b) => getPriority(a).sortScore - getPriority(b).sortScore);
  } else if (sort === "name") {
    items.sort((a, b) => a.name.localeCompare(b.name, locale));
  } else {
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  const total = items.length;
  const locationCount = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.item.storageLocation] = (acc[row.item.storageLocation] ?? 0) + 1;
    return acc;
  }, {});

  const filterHref = (next: { q?: string; location?: string; sort?: string }) => {
    const query = new URLSearchParams();
    const q = next.q ?? search;
    const loc = next.location ?? location;
    const s = next.sort ?? sort;
    if (q) query.set("q", q);
    if (loc !== "all") query.set("location", loc);
    if (s !== "priority") query.set("sort", s);
    const suffix = query.toString();
    return suffix ? `/food?${suffix}` : "/food";
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("inventory.title")}</h1>
          <p className="mt-1 text-sm text-stone-500">{t("inventory.subtitle")}</p>
        </div>
        <Link href="/scan">
          <Button>
            <Plus className="h-4 w-4" /> {t("inventory.add")}
          </Button>
        </Link>
      </header>

      <form action="/food" method="get" className="flex flex-col gap-2 sm:flex-row" role="search">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" aria-hidden="true" />
          <input
            type="search"
            name="q"
            defaultValue={search}
            placeholder={t("inventory.searchPlaceholder")}
            aria-label={t("common.search")}
            className="flex h-11 w-full rounded-xl border border-stone-200 bg-white pl-9 pr-3 text-sm shadow-sm placeholder:text-stone-400 focus:border-forest-400"
          />
        </div>
        {location !== "all" ? <input type="hidden" name="location" value={location} /> : null}
        {sort !== "priority" ? <input type="hidden" name="sort" value={sort} /> : null}
        <Button type="submit" variant="outline">
          {t("common.search")}
        </Button>
      </form>

      <div className="space-y-2">
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
          {locations.map((loc) => {
            const active = location === loc;
            return (
              <Link
                key={loc}
                href={filterHref({ location: loc })}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium",
                  active
                    ? "border-forest-600 bg-forest-600 text-white"
                    : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50",
                )}
              >
                <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                {loc === "all" ? t("inventory.filterAll") : t(`storage.${loc}`)}
                <span className={cn("rounded-full px-1.5 py-0.5 text-[10px]", active ? "bg-white/20" : "bg-stone-100")}>
                  {loc === "all" ? rows.length : locationCount[loc] ?? 0}
                </span>
              </Link>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-stone-500">
          <p>{t("inventory.count", { count: total })}</p>
          <div className="flex items-center gap-1">
            <span>{t("common.filters")}:</span>
            {(
              [
                ["priority", t("inventory.sortPriority")],
                ["added", t("inventory.sortAdded")],
                ["name", t("inventory.sortName")],
              ] as const
            ).map(([value, label]) => (
              <Link
                key={value}
                href={filterHref({ sort: value })}
                className={cn(
                  "rounded-full px-2.5 py-1 font-medium",
                  sort === value ? "bg-forest-50 text-forest-800" : "text-stone-500 hover:bg-stone-100",
                )}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={<ShoppingBasket className="h-8 w-8" />}
          title={search || location !== "all" ? t("inventory.noMatches") : t("inventory.empty")}
          action={
            <Link href="/scan">
              <Button>
                <ScanLine className="h-4 w-4" /> {t("dashboard.scanFirst")}
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => {
            const priority = getPriority(item);
            return (
              <Link
                key={item.id}
                href={`/food/${item.id}`}
                className="group flex gap-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-soft transition-colors hover:border-forest-200"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-forest-50 text-forest-700">
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.imageUrl} alt="" className="h-full w-full object-contain" loading="lazy" />
                  ) : (
                    <ShoppingBasket className="h-5 w-5" aria-hidden="true" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{item.name}</p>
                      {item.brand ? <p className="truncate text-xs text-stone-500">{item.brand}</p> : null}
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-stone-300 transition-transform group-hover:translate-x-0.5 group-hover:text-forest-600" aria-hidden="true" />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Badge tone={priority.severity}>{t(priority.labelKey as Parameters<typeof t>[0])}</Badge>
                    <span className="text-xs text-stone-500">
                      {formatQuantity(item.quantity)} {t(`unit.${item.unit}` as Parameters<typeof t>[0])}
                    </span>
                    <span className="text-xs text-stone-400">·</span>
                    <span className="text-xs text-stone-500">{t(`storage.${item.storageLocation}`)}</span>
                  </div>
                  <p className="mt-1 text-xs text-stone-500">
                    {item.dateValue
                      ? `${t(`dateType.${item.dateType}` as Parameters<typeof t>[0])} · ${formatDate(item.dateValue, locale)}`
                      : t("priority.noDate")}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
