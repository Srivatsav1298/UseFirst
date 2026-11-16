import { and, eq, gte, sql } from "drizzle-orm";
import { AlertTriangle, Leaf, Recycle, Sparkles, TrendingDown, Wallet } from "lucide-react";
import { db } from "@/lib/database";
import { foodWasteRecords, inventory, inventoryEvents, userPreferences } from "@/lib/database/schema";
import { requireMembership } from "@/lib/permissions";
import { getPriority, needsAttention } from "@/lib/inventory/priority";
import { translate } from "@/i18n";
import { getServerLocale } from "@/lib/locale";
import { formatDate } from "@/lib/date-recognition/parse";
import { formatMoney, formatQuantity } from "@/lib/utils";
import { Card, Badge } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  const membership = await requireMembership();
  const locale = await getServerLocale();
  const t = (key: Parameters<typeof translate>[1], vars?: Record<string, string | number>) =>
    translate(locale, key, vars);
  const database = await db();
  const since = new Date(Date.now() - 30 * 86_400_000);

  const [wasteRows, consumedRows, stockRows, prefRows] = await Promise.all([
    database
      .select()
      .from(foodWasteRecords)
      .where(and(eq(foodWasteRecords.householdId, membership.householdId), gte(foodWasteRecords.createdAt, since)))
      .orderBy(sql`${foodWasteRecords.createdAt} DESC`),
    database
      .select({ payload: inventoryEvents.payload })
      .from(inventoryEvents)
      .where(
        and(
          eq(inventoryEvents.householdId, membership.householdId),
          eq(inventoryEvents.type, "consumed"),
          gte(inventoryEvents.createdAt, since),
        ),
      ),
    database
      .select({
        id: inventory.id,
        name: inventory.name,
        dateValue: inventory.dateValue,
        dateType: inventory.dateType,
        storageLocation: inventory.storageLocation,
      })
      .from(inventory)
      .where(eq(inventory.householdId, membership.householdId)),
    database.select().from(userPreferences).where(eq(userPreferences.userId, membership.user.id)).limit(1),
  ]);

  const currency = prefRows[0]?.currency ?? "USD";
  const wasteValue = wasteRows.reduce((sum, row) => sum + (row.estimatedValue ? Number(row.estimatedValue) : 0), 0);
  const wasteQuantity = wasteRows.reduce((sum, row) => sum + Number(row.quantity), 0);
  const consumedValue = consumedRows.reduce((sum, row) => {
    const value = (row.payload as Record<string, unknown>)?.value;
    return sum + (typeof value === "number" ? value : 0);
  }, 0);
  const consumedQuantity = consumedRows.reduce((sum, row) => {
    const value = (row.payload as Record<string, unknown>)?.quantity;
    return sum + (typeof value === "number" ? value : 0);
  }, 0);

  const byReason = Object.entries(
    wasteRows.reduce<Record<string, { count: number; value: number }>>((acc, row) => {
      const entry = acc[row.reason] ?? { count: 0, value: 0 };
      entry.count += 1;
      entry.value += row.estimatedValue ? Number(row.estimatedValue) : 0;
      acc[row.reason] = entry;
      return acc;
    }, {}),
  ).sort((a, b) => b[1].count - a[1].count);

  const weekly = Array.from({ length: 5 }, (_, index) => {
    const end = new Date(Date.now() - index * 7 * 86_400_000);
    const start = new Date(end.getTime() - 7 * 86_400_000);
    const inRange = wasteRows.filter((row) => new Date(row.createdAt) >= start && new Date(row.createdAt) < end);
    return {
      weekStart: start.toISOString().slice(0, 10),
      count: inRange.length,
      value: inRange.reduce((sum, row) => sum + (row.estimatedValue ? Number(row.estimatedValue) : 0), 0),
    };
  }).reverse();

  const maxWeekly = Math.max(1, ...weekly.map((week) => week.count));
  const attention = stockRows
    .map((row) => ({ ...row, priority: getPriority(row) }))
    .filter((row) => needsAttention(row));

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{t("insights.title")}</h1>
        <p className="mt-1 text-sm text-stone-500">{t("insights.subtitle")}</p>
        <Badge tone="info" className="mt-2">
          <Sparkles className="h-3 w-3" /> {t("insights.last30")}
        </Badge>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={<Recycle className="h-4 w-4" />}
          label={t("insights.discarded")}
          value={`${formatQuantity(Math.round(wasteQuantity * 100) / 100)}`}
          hint={`${wasteRows.length} ${t("common.items")}`}
          tone="amber"
        />
        <StatCard
          icon={<Wallet className="h-4 w-4" />}
          label={t("insights.valueDiscarded")}
          value={formatMoney(Math.round(wasteValue * 100) / 100, currency) ?? "—"}
          hint={t("insights.estimated")}
          tone="red"
        />
        <StatCard
          icon={<Leaf className="h-4 w-4" />}
          label={t("insights.consumed")}
          value={`${formatQuantity(Math.round(consumedQuantity * 100) / 100)}`}
          hint={`${consumedRows.length} ${t("common.items")}`}
          tone="green"
        />
        <StatCard
          icon={<TrendingDown className="h-4 w-4" />}
          label={t("insights.valueConsumed")}
          value={formatMoney(Math.round(consumedValue * 100) / 100, currency) ?? "—"}
          hint={t("insights.estimated")}
          tone="green"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-base font-semibold">{t("insights.byReason")}</h2>
          {byReason.length === 0 ? (
            <p className="text-sm text-stone-500">{t("insights.noWaste")}</p>
          ) : (
            <ul className="space-y-3">
              {byReason.map(([reason, data]) => {
                const max = Math.max(...byReason.map(([, entry]) => entry.count));
                return (
                  <li key={reason}>
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="font-medium">{t(`inventory.reason.${reason}` as Parameters<typeof t>[0])}</span>
                      <span className="text-stone-500">
                        {data.count} · {formatMoney(data.value, currency) ?? "—"}
                      </span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-stone-100">
                      <div
                        className="h-full rounded-full bg-amber-400"
                        style={{ width: `${Math.max(6, Math.round((data.count / max) * 100))}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="mb-4 text-base font-semibold">{t("insights.recentWaste")}</h2>
          {weekly.every((week) => week.count === 0) ? (
            <p className="text-sm text-stone-500">{t("insights.noWaste")}</p>
          ) : (
            <div className="flex h-40 items-end gap-2">
              {weekly.map((week) => (
                <div key={week.weekStart} className="flex flex-1 flex-col items-center gap-1.5">
                  <div className="flex h-28 w-full items-end">
                    <div
                      className="w-full rounded-t-lg bg-forest-500/80"
                      style={{ height: `${Math.max(4, Math.round((week.count / maxWeekly) * 100))}%` }}
                      title={`${week.count}`}
                    />
                  </div>
                  <span className="text-[10px] text-stone-400">{week.weekStart.slice(5)}</span>
                </div>
              ))}
            </div>
          )}
          <p className="mt-2 text-xs text-stone-500">{t("insights.last30")}</p>
        </Card>
      </div>

      {wasteRows.length ? (
        <Card>
          <h2 className="mb-3 text-base font-semibold">{t("insights.recentWaste")}</h2>
          <ul className="divide-y divide-stone-100">
            {wasteRows.slice(0, 10).map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{row.productName}</p>
                  <p className="text-xs text-stone-500">
                    {t(`inventory.reason.${row.reason}` as Parameters<typeof t>[0])} ·{" "}
                    {formatDate(new Date(row.createdAt).toISOString().slice(0, 10), locale)}
                  </p>
                </div>
                <div className="text-right text-xs text-stone-500">
                  <p>
                    {formatQuantity(row.quantity)} {t(`unit.${row.unit}` as Parameters<typeof t>[0])}
                  </p>
                  <p>{formatMoney(row.estimatedValue, row.currency) ?? "—"}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {attention.length ? (
        <Card className="border-amber-200 bg-amber-50/60">
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            {t("notifications.attention", { count: attention.length })}
          </p>
          <p className="mt-1 text-sm text-amber-800">{attention.slice(0, 6).map((item) => item.name).join(", ")}</p>
        </Card>
      ) : null}

      <Card>
        <h2 className="mb-2 text-base font-semibold">{t("insights.howCalculated")}</h2>
        <p className="text-sm text-stone-600">{t("insights.calcBody")}</p>
      </Card>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  tone: "amber" | "red" | "green";
}) {
  const toneClass = {
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
    green: "bg-forest-50 text-forest-700",
  }[tone];
  return (
    <Card className="p-4">
      <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${toneClass}`} aria-hidden="true">
        {icon}
      </span>
      <p className="mt-2 text-xs font-medium uppercase tracking-wide text-stone-500">{label}</p>
      <p className="mt-0.5 text-xl font-bold">{value}</p>
      <p className="text-[11px] text-stone-400">{hint}</p>
    </Card>
  );
}
