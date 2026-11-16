"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, CheckCircle2, ListChecks, Loader2, Plus, ShoppingBasket, Trash2, Undo2 } from "lucide-react";
import { useI18n } from "@/i18n/provider";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { ProductForm } from "@/features/scanner/product-form";
import { formatQuantity, cn } from "@/lib/utils";

type ShoppingItem = {
  id: string;
  name: string;
  quantity: string;
  unit: string;
  category: string;
  checked: boolean;
  atHome: { name: string; quantity: number; unit: string }[];
};

const units = ["item", "pack", "g", "kg", "ml", "dl", "l", "piece", "pcs", "tbsp", "tsp", "bunch", "can", "bottle", "box"] as const;

export function ShoppingClient({ initialItems }: { initialItems: ShoppingItem[] }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("item");
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [inventoryItem, setInventoryItem] = useState<ShoppingItem | null>(null);

  const toBuy = useMemo(() => items.filter((item) => !item.checked), [items]);
  const checked = useMemo(() => items.filter((item) => item.checked), [items]);

  async function add(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setAdding(true);
    try {
      const response = await fetch("/api/shopping", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim(), quantity: Number(quantity) || 1, unit, category: "other" }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast(data.code === "duplicate_item" ? t("shopping.possibleDuplicate", { quantity: "", unit: "" }) : data.error || t("errors.generic"), "error");
        return;
      }
      setItems((current) => [
        ...current,
        {
          ...data.item,
          quantity: String(data.item.quantity),
          atHome: [],
        },
      ]);
      setName("");
      setQuantity("1");
      router.refresh();
    } catch {
      toast(t("errors.offline"), "error");
    } finally {
      setAdding(false);
    }
  }

  async function toggle(item: ShoppingItem) {
    setBusyId(item.id);
    setItems((current) => current.map((i) => (i.id === item.id ? { ...i, checked: !i.checked } : i)));
    try {
      const response = await fetch(`/api/shopping/${item.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ checked: !item.checked }),
      });
      if (!response.ok) {
        setItems((current) => current.map((i) => (i.id === item.id ? { ...i, checked: item.checked } : i)));
        toast(t("errors.generic"), "error");
      }
    } catch {
      setItems((current) => current.map((i) => (i.id === item.id ? { ...i, checked: item.checked } : i)));
      toast(t("errors.offline"), "error");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(item: ShoppingItem) {
    setBusyId(item.id);
    try {
      const response = await fetch(`/api/shopping/${item.id}`, { method: "DELETE" });
      if (!response.ok) {
        toast(t("errors.generic"), "error");
        return;
      }
      setItems((current) => current.filter((i) => i.id !== item.id));
      router.refresh();
    } catch {
      toast(t("errors.offline"), "error");
    } finally {
      setBusyId(null);
    }
  }

  async function clearChecked() {
    setClearing(true);
    try {
      const response = await fetch("/api/shopping/checked", { method: "DELETE" });
      if (!response.ok) {
        toast(t("errors.generic"), "error");
        return;
      }
      setItems((current) => current.filter((item) => !item.checked));
      router.refresh();
    } catch {
      toast(t("errors.offline"), "error");
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{t("shopping.title")}</h1>
        <p className="mt-1 text-sm text-stone-500">{t("shopping.subtitle")}</p>
      </header>

      <Card>
        <form onSubmit={add} className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("shopping.addPlaceholder")}
            aria-label={t("common.name")}
            maxLength={120}
            className="flex-1"
          />
          <div className="flex gap-2">
            <Input
              type="number"
              min="0.01"
              step="0.01"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              aria-label={t("shopping.quantity")}
              className="w-20"
            />
            <Select value={unit} onChange={(e) => setUnit(e.target.value)} aria-label={t("common.unit")} className="w-28">
              {units.map((u) => (
                <option key={u} value={u}>
                  {t(`unit.${u}`)}
                </option>
              ))}
            </Select>
            <Button type="submit" disabled={adding || !name.trim()}>
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {t("common.add")}
            </Button>
          </div>
        </form>
      </Card>

      <section aria-labelledby="to-buy">
        <div className="mb-2 flex items-center justify-between">
          <h2 id="to-buy" className="flex items-center gap-2 text-base font-semibold">
            <ListChecks className="h-4 w-4 text-forest-600" aria-hidden="true" />
            {t("shopping.toBuy")} <span className="text-stone-400">({toBuy.length})</span>
          </h2>
        </div>
        {toBuy.length === 0 ? (
          <Card className="py-6 text-center text-sm text-stone-500">{t("shopping.empty")}</Card>
        ) : (
          <Card className="p-0">
            <ul className="divide-y divide-stone-100">
              {toBuy.map((item) => (
                <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => toggle(item)}
                    disabled={busyId === item.id}
                    aria-label={t("shopping.purchased")}
                    className="tap-target flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-stone-300 text-transparent hover:border-forest-500 hover:text-forest-600"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-stone-500">
                      {formatQuantity(item.quantity)} {t(`unit.${item.unit}` as Parameters<typeof t>[0])}
                    </p>
                    {item.atHome.length ? (
                      <p className="mt-0.5 text-xs text-amber-700">
                        {t("shopping.possibleDuplicate", {
                          quantity: formatQuantity(item.atHome[0].quantity),
                          unit: t(`unit.${item.atHome[0].unit}` as Parameters<typeof t>[0]),
                        })}
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => setInventoryItem(item)}
                    className="tap-target flex items-center justify-center rounded-lg text-forest-700 hover:bg-forest-50"
                    aria-label={t("shopping.addToInventory")}
                  >
                    <ShoppingBasket className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(item)}
                    disabled={busyId === item.id}
                    className="tap-target flex items-center justify-center rounded-lg text-stone-400 hover:bg-red-50 hover:text-red-600"
                    aria-label={t("common.delete")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      {checked.length ? (
        <section aria-labelledby="in-basket">
          <div className="mb-2 flex items-center justify-between">
            <h2 id="in-basket" className="flex items-center gap-2 text-base font-semibold text-stone-600">
              <CheckCircle2 className="h-4 w-4 text-forest-600" aria-hidden="true" />
              {t("shopping.checked")} <span className="text-stone-400">({checked.length})</span>
            </h2>
            <Button variant="ghost" size="sm" onClick={clearChecked} disabled={clearing}>
              {clearing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {t("shopping.clearChecked")}
            </Button>
          </div>
          <Card className="p-0">
            <ul className="divide-y divide-stone-100">
              {checked.map((item) => (
                <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => toggle(item)}
                    disabled={busyId === item.id}
                    aria-label={t("common.undo")}
                    className="tap-target flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-forest-500 bg-forest-500 text-white"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-stone-500 line-through">{item.name}</p>
                    <p className="text-xs text-stone-400">
                      {formatQuantity(item.quantity)} {t(`unit.${item.unit}` as Parameters<typeof t>[0])}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggle(item)}
                    className={cn("tap-target flex items-center justify-center rounded-lg text-stone-400 hover:bg-stone-50")}
                    aria-label={t("common.undo")}
                  >
                    <Undo2 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(item)}
                    disabled={busyId === item.id}
                    className="tap-target flex items-center justify-center rounded-lg text-stone-400 hover:bg-red-50 hover:text-red-600"
                    aria-label={t("common.delete")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}

      <Modal
        open={Boolean(inventoryItem)}
        onClose={() => setInventoryItem(null)}
        title={t("shopping.addToInventory")}
        size="lg"
      >
        {inventoryItem ? (
          <ProductForm
            initial={{ name: inventoryItem.name, quantity: Number(inventoryItem.quantity), unit: inventoryItem.unit }}
            onSaved={async () => {
              await fetch(`/api/shopping/${inventoryItem.id}`, {
                method: "PATCH",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ checked: true }),
              }).catch(() => undefined);
              setItems((current) =>
                current.map((item) => (item.id === inventoryItem.id ? { ...item, checked: true } : item)),
              );
              toast(t("shopping.addedToInventory"));
              setInventoryItem(null);
              router.refresh();
            }}
            onCancel={() => setInventoryItem(null)}
          />
        ) : null}
      </Modal>
    </div>
  );
}
