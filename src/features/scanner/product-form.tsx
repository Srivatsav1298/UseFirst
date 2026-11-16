"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Camera, Check, Loader2, ScanText, X } from "lucide-react";
import { useI18n } from "@/i18n/provider";
import { parseExpiryDate, formatDate, type DateCandidate } from "@/lib/date-recognition/parse";
import { compressImage, fileToDataUrl, recogniseText } from "@/lib/ocr/client";
import { validateBarcode } from "@/lib/scanner/barcode";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type ProductDraft = {
  productId?: string;
  name?: string;
  brand?: string | null;
  barcode?: string | null;
  category?: string | null;
  quantity?: number;
  unit?: string;
  packageSize?: string | null;
  imageUrl?: string | null;
  storageLocation?: "refrigerator" | "freezer" | "pantry" | "cupboard" | "other";
  price?: number | null;
  currency?: string;
  sourceNote?: string;
  notes?: string;
  scanKey?: string;
};

const UNITS = ["item", "pack", "g", "kg", "ml", "dl", "l", "piece", "pcs", "tbsp", "tsp", "bunch", "can", "bottle", "box"] as const;

export function ProductForm({
  initial,
  defaultCurrency = "USD",
  onSaved,
  onCancel,
  submitLabel,
}: {
  initial: ProductDraft;
  defaultCurrency?: string;
  onSaved: (item: unknown) => void;
  onCancel?: () => void;
  submitLabel?: string;
}) {
  const { t, locale } = useI18n();
  const [name, setName] = useState(initial.name ?? "");
  const [brand, setBrand] = useState(initial.brand ?? "");
  const [category, setCategory] = useState(initial.category ?? "");
  const [quantity, setQuantity] = useState(String(initial.quantity ?? 1));
  const [unit, setUnit] = useState(initial.unit ?? "item");
  const [storageLocation, setStorageLocation] = useState(initial.storageLocation ?? "pantry");
  const [notes, setNotes] = useState(initial.notes ?? "");
  const [price, setPrice] = useState(initial.price !== null && initial.price !== undefined ? String(initial.price) : "");
  const [currency, setCurrency] = useState(initial.currency ?? defaultCurrency);

  const [dateValue, setDateValue] = useState("");
  const [dateType, setDateType] = useState<"use_by" | "best_before" | "unknown">("best_before");
  const [originalDateText, setOriginalDateText] = useState("");
  const [dateConfirmed, setDateConfirmed] = useState(false);
  const [candidate, setCandidate] = useState<DateCandidate | null>(null);
  const [ocrText, setOcrText] = useState("");
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const [ocrImage, setOcrImage] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState(false);

  const barcodeValidation = useMemo(
    () => (initial.barcode ? validateBarcode(initial.barcode) : null),
    [initial.barcode],
  );

  const dateIsLow = candidate?.confidence === "low";

  async function runOcr(file: File) {
    setOcrBusy(true);
    setOcrError(null);
    setCandidate(null);
    try {
      const preview = await fileToDataUrl(file);
      setOcrImage(preview);
      const compressed = await compressImage(file);
      const result = await recogniseText(compressed, { language: "eng" });
      setOcrText(result.text.trim());
      const parsed = parseExpiryDate(result.text, {
        locale,
        ocrConfidence: result.confidence,
      });
      setCandidate(parsed);
      if (parsed && parsed.confidence !== "low") {
        setDateValue(parsed.date);
        setDateType(parsed.dateType === "unknown" ? "best_before" : parsed.dateType);
        setOriginalDateText(parsed.originalText);
        setDateConfirmed(false);
      }
      if (!parsed) {
        setDateValue("");
        setOriginalDateText("");
        setDateConfirmed(false);
      }
    } catch {
      setOcrError(t("scan.ocrFailed"));
    } finally {
      setOcrBusy(false);
    }
  }

  function manualDate(value: string) {
    setDateValue(value);
    setDateConfirmed(Boolean(value));
    if (value) setOriginalDateText("");
  }

  async function save(allowDuplicate = false) {
    setError(null);
    if (!name.trim()) {
      setError(t("errors.required"));
      return;
    }
    if (dateValue && dateType === "unknown") {
      setError(t("scan.dateType"));
      return;
    }
    if (dateValue && !dateConfirmed) {
      setError(t("scan.dateConfirm"));
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/inventory${allowDuplicate ? "?allowDuplicate=true" : ""}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          productId: initial.productId,
          name: name.trim(),
          brand: brand.trim() || null,
          barcode: initial.barcode || undefined,
          category: category.trim() || null,
          quantity: Number(quantity) || 1,
          unit,
          packageSize: initial.packageSize || null,
          imageUrl: initial.imageUrl || undefined,
          storageLocation,
          notes: notes.trim() || null,
          price: price === "" ? null : Number(price),
          currency,
          dateValue: dateValue || null,
          dateType: dateValue ? dateType : "unknown",
          originalDateText: originalDateText || null,
          dateConfidence: dateValue ? "high" : "none",
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (data.code === "duplicate_inventory") {
          setDuplicateWarning(true);
          return;
        }
        if (data.code === "validation_error") setError(t("errors.generic"));
        else setError(data.error || t("errors.generic"));
        return;
      }
      onSaved(data.item);
    } catch {
      setError(t("errors.offline"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {initial.sourceNote ? (
        <p className="rounded-xl bg-sage-50 px-3 py-2 text-xs text-sage-800">{initial.sourceNote}</p>
      ) : null}

      {initial.imageUrl ? (
        <div className="flex items-center gap-3 rounded-xl border border-stone-100 bg-stone-50 p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={initial.imageUrl} alt="" className="h-14 w-14 rounded-lg object-contain" />
          <div className="min-w-0 text-xs text-stone-500">
            <p className="truncate font-medium text-stone-700">{brand || name}</p>
            {initial.packageSize ? <p>{initial.packageSize}</p> : null}
          </div>
        </div>
      ) : null}

      {initial.barcode ? (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-mono text-stone-600">{initial.barcode}</span>
          {barcodeValidation ? (
            <Badge tone={barcodeValidation.valid ? "success" : "warning"}>
              {barcodeValidation.valid ? barcodeValidation.format : t("common.unknown")}
            </Badge>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label={`${t("common.name")} *`} htmlFor="product-name">
            <Input
              id="product-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              required
              autoFocus={!initial.name}
            />
          </Field>
        </div>
        <Field label={t("common.brand")} htmlFor="product-brand">
          <Input id="product-brand" value={brand} onChange={(e) => setBrand(e.target.value)} maxLength={120} />
        </Field>
        <Field label={t("common.category")} htmlFor="product-category">
          <Input id="product-category" value={category} onChange={(e) => setCategory(e.target.value)} maxLength={80} />
        </Field>
        <Field label={t("common.quantity")} htmlFor="product-quantity">
          <div className="flex gap-2">
            <Input
              id="product-quantity"
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-24"
            />
            <Select value={unit} onChange={(e) => setUnit(e.target.value)} aria-label={t("common.unit")}>
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {t(`unit.${u}` as Parameters<typeof t>[0])}
                </option>
              ))}
            </Select>
          </div>
        </Field>
        <Field label={t("common.storage")} htmlFor="product-storage">
          <Select
            id="product-storage"
            value={storageLocation}
            onChange={(e) => setStorageLocation(e.target.value as typeof storageLocation)}
          >
            {(["refrigerator", "freezer", "pantry", "cupboard", "other"] as const).map((location) => (
              <option key={location} value={location}>
                {t(`storage.${location}`)}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <section className="rounded-2xl border border-stone-200 p-4" aria-labelledby="date-section">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h3 id="date-section" className="text-sm font-semibold">
              {t("scan.dateLabel")}
            </h3>
            <p className="mt-0.5 text-xs text-stone-500">{t("scan.dateTypeHint")}</p>
          </div>
          <label className="tap-target inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-medium text-forest-700 hover:bg-stone-50">
            {ocrBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanText className="h-4 w-4" />}
            {ocrBusy ? t("scan.ocrRunning") : t("scan.ocr")}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              disabled={ocrBusy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void runOcr(file);
                e.target.value = "";
              }}
            />
          </label>
        </div>

        {ocrBusy ? (
          <p className="rounded-xl bg-sage-50 px-3 py-2 text-xs text-sage-800" role="status">
            {t("scan.ocrRunning")}
          </p>
        ) : null}

        {ocrError ? (
          <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900" role="alert">
            {ocrError}
          </p>
        ) : null}

        {ocrImage ? (
          <div className="mb-3 flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ocrImage} alt="" className="h-16 w-16 rounded-lg border border-stone-200 object-cover" />
            <Button variant="ghost" size="sm" onClick={() => { setOcrImage(null); setOcrText(""); setCandidate(null); }}>
              <X className="h-4 w-4" /> {t("scan.removePhoto")}
            </Button>
          </div>
        ) : null}

        {candidate ? (
          <div
            className={cn(
              "mb-3 rounded-xl border p-3 text-xs",
              candidate.confidence === "high" && "border-forest-200 bg-forest-50",
              candidate.confidence === "medium" && "border-amber-200 bg-amber-50",
              candidate.confidence === "low" && "border-red-200 bg-red-50",
            )}
          >
            <p className="flex flex-wrap items-center gap-2 font-medium">
              {t("scan.dateFound")}: {formatDate(candidate.date, locale)}
              <Badge tone={candidate.confidence === "high" ? "success" : candidate.confidence === "medium" ? "warning" : "danger"}>
                {candidate.confidence}
              </Badge>
            </p>
            <p className="mt-1 text-stone-600">
              {t("scan.originalText")}: <span className="font-mono">{candidate.originalText}</span>
              {candidate.labelText ? ` · “${candidate.labelText}”` : ""}
            </p>
            <p className="mt-1 text-stone-500">{candidate.reason}</p>
            {candidate.confidence === "low" ? (
              <p className="mt-2 font-medium text-red-800">{t("scan.dateLowConfidence")}</p>
            ) : (
              <button
                type="button"
                className="mt-2 font-semibold text-forest-700 underline"
                onClick={() => {
                  setDateValue(candidate.date);
                  setDateType(candidate.dateType === "unknown" ? "best_before" : candidate.dateType);
                  setOriginalDateText(candidate.originalText);
                  setDateConfirmed(false);
                }}
              >
                {t("scan.dateConfirm")}
              </button>
            )}
          </div>
        ) : ocrText && !ocrBusy ? (
          <p className="mb-3 rounded-xl bg-stone-50 px-3 py-2 text-xs text-stone-600">
            {t("scan.dateNone")} — {t("scan.dateNoneHint")}
          </p>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("common.date")} htmlFor="product-date">
            <Input
              id="product-date"
              type="date"
              value={dateValue}
              onChange={(e) => manualDate(e.target.value)}
            />
          </Field>
          <Field label={t("scan.dateType")} htmlFor="product-date-type">
            <Select
              id="product-date-type"
              value={dateType}
              onChange={(e) => setDateType(e.target.value as typeof dateType)}
              disabled={!dateValue}
            >
              <option value="use_by">{t("dateType.use_by")}</option>
              <option value="best_before">{t("dateType.best_before")}</option>
              <option value="unknown">{t("dateType.unknown")}</option>
            </Select>
          </Field>
        </div>

        {dateValue && !dateConfirmed ? (
          <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-amber-300"
              checked={dateConfirmed}
              onChange={(e) => setDateConfirmed(e.target.checked)}
            />
            <span>{t("scan.dateConfirm")}</span>
          </label>
        ) : null}
        {dateValue && dateConfirmed ? (
          <p className="mt-3 flex items-center gap-1.5 text-xs font-medium text-forest-700">
            <Check className="h-4 w-4" /> {t("common.confirm")}
          </p>
        ) : null}
        {dateIsLow ? <p className="mt-2 text-xs font-medium text-red-700">{t("errors.lowConfidenceDate")}</p> : null}

        {originalDateText ? (
          <p className="mt-2 text-xs text-stone-400">
            {t("scan.originalText")}: <span className="font-mono">{originalDateText}</span>
          </p>
        ) : null}
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("common.price")} htmlFor="product-price" hint={t("inventory.priceHint")}>
          <div className="flex gap-2">
            <Input
              id="product-price"
              type="number"
              inputMode="decimal"
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
        <Field label={t("common.notes")} htmlFor="product-notes">
          <Textarea id="product-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
        </Field>
      </div>

      {ocrText ? (
        <details className="rounded-xl border border-stone-200 p-3 text-xs text-stone-600">
          <summary className="cursor-pointer font-medium">{t("scan.ocrResult")}</summary>
          <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap font-mono text-[11px]">{ocrText}</pre>
        </details>
      ) : null}

      {duplicateWarning ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="alert">
          <p className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4" /> {t("scan.duplicateInventory")}
          </p>
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="amber" onClick={() => void save(true)} disabled={busy}>
              {t("common.add")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDuplicateWarning(false)}>
              {t("common.cancel")}
            </Button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2">
        {onCancel ? (
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            {t("common.cancel")}
          </Button>
        ) : null}
        <Button onClick={() => void save(false)} disabled={busy || !name.trim()} size="lg">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
          {submitLabel ?? t("scan.saveProduct")}
        </Button>
      </div>
    </div>
  );
}
