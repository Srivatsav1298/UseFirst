"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Edit3,
  Loader2,
  MapPin,
  Package,
  Snowflake,
  Sun,
  Trash2,
} from "lucide-react";
import { useI18n } from "@/i18n/provider";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Card, Badge } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { getPriority } from "@/lib/inventory/priority";
import { formatDate } from "@/lib/date-recognition/parse";
import { formatMoney, formatQuantity } from "@/lib/utils";
import type { MessageKey } from "@/i18n";

type InventoryItem = {
  id: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  category: string | null;
  quantity: string;
  unit: string;
  packageSize: string | null;
  imageUrl: string | null;
  dateValue: string | null;
  dateType: "use_by" | "best_before" | "unknown";
  originalDateText: string | null;
  dateConfidence: "high" | "medium" | "low" | "none";
  storageLocation: "refrigerator" | "freezer" | "pantry" | "cupboard" | "other";
  notes: string | null;
  price: string | null;
  currency: string;
  version: number;
  addedByName: string;
  createdAt: string | Date;
};

type EventRow = {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  createdAt: string | Date;
  userName: string;
};

const reasons = ["expired", "forgot", "too_much", "spoiled", "other"] as const;

export function InventoryDetail({ item, events }: { item: InventoryItem; events: EventRow[] }) {
  const { t, locale } = useI18n();
  const { toast } = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<null | "consume" | "discard" | "delete" | "edit">(null);

  const priority = getPriority(item);
  const quantity = Number(item.quantity);
  const unitPrice = item.price ? Number(item.price) : null;

  async function act(action: "consume" | "discard" | "freeze" | "unfreeze", payload: Record<string, unknown> = {}) {
    setBusy(true);
    try {
      const response = await fetch(`/api/inventory/${item.id}/actions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast(data.error || t("errors.generic"), "error");
        return false;
      }
      if (data.removed) {
        toast(action === "discard" ? t("inventory.markedDiscarded") : t("inventory.markedConsumed"));
        router.push("/food");
        router.refresh();
      } else {
        toast(
          action === "discard"
            ? t("inventory.markedDiscarded")
            : action === "consume"
              ? t("inventory.markedConsumed")
              : t("inventory.moved"),
        );
        router.refresh();
      }
      setModal(null);
      return true;
    } catch {
      toast(t("errors.offline"), "error");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      const response = await fetch(`/api/inventory/${item.id}?version=${item.version}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast(data.error || t("errors.generic"), "error");
        return;
      }
      toast(t("inventory.deleted"));
      router.push("/food");
      router.refresh();
    } catch {
      toast(t("errors.offline"), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <Link href="/food" className="inline-flex items-center gap-1 text-sm font-medium text-forest-700 hover:underline">
        <ArrowLeft className="h-4 w-4" /> {t("nav.food")}
      </Link>

      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-forest-50 text-forest-700">
            {item.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.imageUrl} alt="" className="h-full w-full object-contain" />
            ) : (
              <Package className="h-8 w-8" aria-hidden="true" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">{item.name}</h1>
                {item.brand ? <p className="text-sm text-stone-500">{item.brand}</p> : null}
              </div>
              <Badge tone={priority.severity}>{t(priority.labelKey as Parameters<typeof t>[0])}</Badge>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-stone-600">
              <span className="inline-flex items-center gap-1.5">
                <Package className="h-4 w-4 text-stone-400" aria-hidden="true" />
                {formatQuantity(item.quantity)} {t(`unit.${item.unit}` as Parameters<typeof t>[0])}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-stone-400" aria-hidden="true" />
                {t(`storage.${item.storageLocation}`)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4 text-stone-400" aria-hidden="true" />
                {item.dateValue
                  ? `${t(`dateType.${item.dateType}` as Parameters<typeof t>[0])} · ${formatDate(item.dateValue, locale)}`
                  : t("priority.noDate")}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button onClick={() => setModal("consume")} disabled={busy}>
            <Check className="h-4 w-4" /> {t("inventory.consume")}
          </Button>
          <Button variant="dangerSoft" onClick={() => setModal("discard")} disabled={busy}>
            <Trash2 className="h-4 w-4" /> {t("inventory.discard")}
          </Button>
          <Button
            variant="outline"
            onClick={() => act(item.storageLocation === "freezer" ? "unfreeze" : "freeze")}
            disabled={busy}
          >
            {item.storageLocation === "freezer" ? <Sun className="h-4 w-4" /> : <Snowflake className="h-4 w-4" />}
            {item.storageLocation === "freezer" ? t("inventory.unfreeze") : t("inventory.freeze")}
          </Button>
          <Button variant="ghost" onClick={() => setModal("edit")} disabled={busy}>
            <Edit3 className="h-4 w-4" /> {t("common.edit")}
          </Button>
          <Button variant="ghost" className="text-red-600 hover:bg-red-50" onClick={() => setModal("delete")} disabled={busy}>
            <Trash2 className="h-4 w-4" /> {t("common.delete")}
          </Button>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-base font-semibold">{t("inventory.details")}</h2>
          <dl className="space-y-2 text-sm">
            <Row label={t("common.category")} value={item.category || t("common.none")} />
            <Row label={t("inventory.barcode")} value={item.barcode || t("common.none")} mono={Boolean(item.barcode)} />
            <Row label={t("inventory.packageSize")} value={item.packageSize || t("common.none")} />
            <Row label={t("inventory.addedBy")} value={item.addedByName} />
            <Row label={t("common.added")} value={formatDate(new Date(item.createdAt).toISOString().slice(0, 10), locale)} />
            <Row
              label={t("inventory.dateConfidence")}
              value={item.dateValue ? item.dateConfidence : t("common.none")}
            />
            {item.originalDateText ? (
              <Row label={t("scan.originalText")} value={item.originalDateText} mono />
            ) : null}
            {item.price ? (
              <Row label={t("inventory.value")} value={formatMoney(unitPrice, item.currency) ?? item.price} />
            ) : null}
            {item.notes ? <Row label={t("common.notes")} value={item.notes} /> : null}
          </dl>
        </Card>

        <Card>
          <h2 className="mb-3 text-base font-semibold">{t("inventory.history")}</h2>
          {events.length === 0 ? (
            <p className="text-sm text-stone-500">{t("inventory.noHistory")}</p>
          ) : (
            <ol className="space-y-3">
              {events.map((event) => (
                <li key={event.id} className="flex gap-3 text-sm">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-forest-300" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="font-medium">
                      {eventLabel(event, t)}
                    </p>
                    <p className="text-xs text-stone-500">
                      {event.userName} · {formatDate(new Date(event.createdAt).toISOString().slice(0, 10), locale)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      <Modal
        open={modal === "consume"}
        onClose={() => setModal(null)}
        title={t("inventory.consume")}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModal(null)} disabled={busy}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => act("consume", { quantity })} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {t("common.confirm")}
            </Button>
          </>
        }
      >
        <p className="text-sm text-stone-600">
          {t("common.quantity")}: {formatQuantity(item.quantity)} {t(`unit.${item.unit}` as Parameters<typeof t>[0])}
        </p>
      </Modal>

      <DiscardModal
        open={modal === "discard"}
        onClose={() => setModal(null)}
        busy={busy}
        maxQuantity={quantity}
        unit={item.unit}
        unitPrice={unitPrice}
        currency={item.currency}
        onConfirm={(payload) => act("discard", payload)}
      />

      <Modal
        open={modal === "delete"}
        onClose={() => setModal(null)}
        title={t("inventory.deleteTitle")}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModal(null)} disabled={busy}>
              {t("common.cancel")}
            </Button>
            <Button variant="danger" onClick={remove} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {t("inventory.deleteConfirm")}
            </Button>
          </>
        }
      >
        <p className="text-sm text-stone-600">{t("inventory.deleteBody")}</p>
      </Modal>

      <EditModal open={modal === "edit"} onClose={() => setModal(null)} item={item} />
    </div>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-stone-100 pb-2 last:border-0">
      <dt className="shrink-0 text-stone-500">{label}</dt>
      <dd className={`text-right ${mono ? "font-mono text-xs" : ""}`}>{value}</dd>
    </div>
  );
}

function eventLabel(event: EventRow, t: (key: MessageKey) => string) {
  const payload = event.payload ?? {};
  const quantity = typeof payload.quantity === "number" ? formatQuantity(payload.quantity) : "";
  const unit = typeof payload.unit === "string" ? t(`unit.${payload.unit}` as Parameters<typeof t>[0]) : "";
  const name = typeof payload.name === "string" ? payload.name : "";
  switch (event.type) {
    case "added":
      return `${t("common.added")}: ${name || t("common.item")} ${quantity} ${unit}`.trim();
    case "consumed":
      return `${t("inventory.consume")}: ${quantity} ${unit}`.trim();
    case "discarded":
      return `${t("inventory.discard")}: ${quantity} ${unit}`.trim();
    case "frozen":
      return t("inventory.freeze");
    case "unfrozen":
      return t("inventory.unfreeze");
    case "quantity_changed":
      return `${t("common.quantity")}: ${formatQuantity(Number(payload.from ?? 0))} → ${formatQuantity(Number(payload.to ?? 0))}`;
    case "updated":
      return t("common.updated");
    default:
      return event.type;
  }
}

function DiscardModal({
  open,
  onClose,
  busy,
  maxQuantity,
  unit,
  unitPrice,
  currency,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  busy: boolean;
  maxQuantity: number;
  unit: string;
  unitPrice: number | null;
  currency: string;
  onConfirm: (payload: Record<string, unknown>) => Promise<boolean>;
}) {
  const { t } = useI18n();
  const [quantity, setQuantity] = useState(String(maxQuantity));
  const [reason, setReason] = useState<(typeof reasons)[number]>("expired");
  const [value, setValue] = useState(unitPrice !== null ? String(Math.round(unitPrice * maxQuantity * 100) / 100) : "");

  const estimated = useMemo(() => (value === "" ? null : Number(value)), [value]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("inventory.discardTitle")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="danger"
            disabled={busy}
            onClick={() =>
              onConfirm({
                quantity: Number(quantity) || maxQuantity,
                reason,
                estimatedValue: estimated,
              })
            }
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            {t("inventory.recordWaste")}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label={t("common.quantity")} htmlFor="discard-quantity">
          <div className="flex gap-2">
            <Input
              id="discard-quantity"
              type="number"
              min="0.01"
              max={maxQuantity}
              step="0.01"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-28"
            />
            <span className="flex items-center text-sm text-stone-500">{t(`unit.${unit}` as Parameters<typeof t>[0])}</span>
          </div>
        </Field>
        <Field label={t("inventory.discardReason")} htmlFor="discard-reason">
          <Select id="discard-reason" value={reason} onChange={(e) => setReason(e.target.value as typeof reason)}>
            {reasons.map((r) => (
              <option key={r} value={r}>
                {t(`inventory.reason.${r}` as Parameters<typeof t>[0])}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={`${t("inventory.value")} (${currency})`} htmlFor="discard-value" hint={t("inventory.priceHint")}>
          <Input
            id="discard-value"
            type="number"
            min="0"
            step="0.01"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </Field>
      </div>
    </Modal>
  );
}

function EditModal({ open, onClose, item }: { open: boolean; onClose: () => void; item: InventoryItem }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(item.name);
  const [brand, setBrand] = useState(item.brand ?? "");
  const [category, setCategory] = useState(item.category ?? "");
  const [quantity, setQuantity] = useState(item.quantity);
  const [unit, setUnit] = useState(item.unit);
  const [storage, setStorage] = useState(item.storageLocation);
  const [dateValue, setDateValue] = useState(item.dateValue ?? "");
  const [dateType, setDateType] = useState(item.dateType);
  const [notes, setNotes] = useState(item.notes ?? "");
  const [price, setPrice] = useState(item.price ?? "");
  const [currency, setCurrency] = useState(item.currency);
  const [version, setVersion] = useState(item.version);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setName(item.name);
    setBrand(item.brand ?? "");
    setCategory(item.category ?? "");
    setQuantity(item.quantity);
    setUnit(item.unit);
    setStorage(item.storageLocation);
    setDateValue(item.dateValue ?? "");
    setDateType(item.dateType);
    setNotes(item.notes ?? "");
    setPrice(item.price ?? "");
    setCurrency(item.currency);
    setVersion(item.version);
  }, [open, item]);

  async function save() {
    setError(null);
    if (!name.trim()) {
      setError(t("errors.required"));
      return;
    }
    if (dateValue && dateType === "unknown") {
      setError(t("scan.dateType"));
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/inventory/${item.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          version,
          name: name.trim(),
          brand: brand.trim() || null,
          category: category.trim() || null,
          quantity: Number(quantity) || 1,
          unit,
          storageLocation: storage,
          dateValue: dateValue || null,
          dateType: dateValue ? dateType : "unknown",
          dateConfidence: dateValue ? "high" : "none",
          originalDateText: dateValue ? item.originalDateText : null,
          notes: notes.trim() || null,
          price: price === "" ? null : Number(price),
          currency,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (data.code === "version_conflict" && data.details?.current?.version) {
          setVersion(data.details.current.version);
        }
        setError(data.error || t("errors.generic"));
        return;
      }
      toast(t("common.saved"));
      onClose();
      router.refresh();
    } catch {
      setError(t("errors.offline"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("inventory.editTitle")}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button onClick={save} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {t("common.save")}
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label={t("common.name")} htmlFor="edit-name">
            <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
        </div>
        <Field label={t("common.brand")} htmlFor="edit-brand">
          <Input id="edit-brand" value={brand} onChange={(e) => setBrand(e.target.value)} />
        </Field>
        <Field label={t("common.category")} htmlFor="edit-category">
          <Input id="edit-category" value={category} onChange={(e) => setCategory(e.target.value)} />
        </Field>
        <Field label={t("common.quantity")} htmlFor="edit-quantity">
          <div className="flex gap-2">
            <Input
              id="edit-quantity"
              type="number"
              min="0.01"
              step="0.01"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-24"
            />
            <Input aria-label={t("common.unit")} value={unit} onChange={(e) => setUnit(e.target.value)} className="w-20" />
          </div>
        </Field>
        <Field label={t("common.storage")} htmlFor="edit-storage">
          <Select id="edit-storage" value={storage} onChange={(e) => setStorage(e.target.value as typeof storage)}>
            {(["refrigerator", "freezer", "pantry", "cupboard", "other"] as const).map((loc) => (
              <option key={loc} value={loc}>
                {t(`storage.${loc}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("common.date")} htmlFor="edit-date">
          <Input id="edit-date" type="date" value={dateValue} onChange={(e) => setDateValue(e.target.value)} />
        </Field>
        <Field label={t("scan.dateType")} htmlFor="edit-date-type">
          <Select
            id="edit-date-type"
            value={dateType}
            onChange={(e) => setDateType(e.target.value as typeof dateType)}
            disabled={!dateValue}
          >
            <option value="use_by">{t("dateType.use_by")}</option>
            <option value="best_before">{t("dateType.best_before")}</option>
            <option value="unknown">{t("dateType.unknown")}</option>
          </Select>
        </Field>
        <Field label={t("common.price")} htmlFor="edit-price">
          <div className="flex gap-2">
            <Input
              id="edit-price"
              type="number"
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-28"
            />
            <Input
              aria-label={t("common.currency")}
              value={currency}
              maxLength={3}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              className="w-20 uppercase"
            />
          </div>
        </Field>
        <div className="sm:col-span-2">
          <Field label={t("common.notes")} htmlFor="edit-notes">
            <Textarea id="edit-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
          </Field>
        </div>
      </div>
      {error ? (
        <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </Modal>
  );
}
