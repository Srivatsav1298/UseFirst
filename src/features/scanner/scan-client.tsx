"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Camera,
  Check,
  ChevronRight,
  ImagePlus,
  Loader2,
  Package,
  Plus,
  ScanLine,
  Trash2,
  X,
} from "lucide-react";
import { useI18n } from "@/i18n/provider";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/card";
import { BarcodeScanner } from "./barcode-scanner";
import { ProductForm, type ProductDraft } from "./product-form";
import { parseScanPayload } from "@/lib/scanner/barcode";
import { parseExpiryDate, formatDate, type DateCandidate } from "@/lib/date-recognition/parse";
import { compressImage, recogniseText } from "@/lib/ocr/client";
import { assignDatesToBarcodes, detectBarcodesInImage } from "@/lib/scanner/image";
import { cn } from "@/lib/utils";

type Tab = "single" | "continuous" | "group" | "manual";

type LookupResponse = {
  found: boolean;
  unavailable?: boolean;
  product?: {
    id: string;
    name: string;
    brand: string | null;
    category: string | null;
    imageUrl: string | null;
    packageSize: string | null;
    sourceAttribution: string | null;
  };
  error?: string;
};

type GroupCandidate = ProductDraft & {
  key: string;
  dateValue: string;
  dateType: "use_by" | "best_before" | "unknown";
  originalDateText: string;
  dateCandidate?: DateCandidate | null;
  confirmed: boolean;
};

async function lookupProduct(barcode: string): Promise<LookupResponse> {
  try {
    const response = await fetch(`/api/products/lookup?barcode=${encodeURIComponent(barcode)}`);
    return (await response.json()) as LookupResponse;
  } catch {
    return { found: false, unavailable: true };
  }
}

export function ScanClient() {
  const { t } = useI18n();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as Tab) || "single";
  const [tab, setTab] = useState<Tab>(["single", "continuous", "group", "manual"].includes(initialTab) ? initialTab : "single");
  const [currency, setCurrency] = useState("USD");

  useEffect(() => {
    fetch("/api/preferences")
      .then((r) => r.json())
      .then((data) => {
        if (data.preferences?.currency) setCurrency(data.preferences.currency);
      })
      .catch(() => undefined);
  }, []);

  const tabs: { id: Tab; label: string; icon: typeof ScanLine }[] = [
    { id: "single", label: t("scan.tab.single"), icon: ScanLine },
    { id: "continuous", label: t("scan.tab.continuous"), icon: Package },
    { id: "group", label: t("scan.tab.group"), icon: ImagePlus },
    { id: "manual", label: t("scan.tab.manual"), icon: Plus },
  ];

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{t("scan.title")}</h1>
        <p className="mt-1 text-sm text-stone-500">{t("scan.subtitle")}</p>
      </header>

      <div className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto rounded-xl border border-stone-200 bg-white p-1" role="tablist" aria-label={t("scan.title")}>
        {tabs.map((item) => (
          <button
            key={item.id}
            role="tab"
            aria-selected={tab === item.id}
            aria-controls={`panel-${item.id}`}
            id={`tab-${item.id}`}
            onClick={() => setTab(item.id)}
            className={cn(
              "flex min-h-[40px] flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-sm font-medium transition-colors",
              tab === item.id ? "bg-forest-600 text-white" : "text-stone-600 hover:bg-stone-50",
            )}
          >
            <item.icon className="h-4 w-4" aria-hidden="true" />
            {item.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "single" ? <SingleScan currency={currency} onSaved={() => router.refresh()} /> : null}
        {tab === "continuous" ? <ContinuousScan currency={currency} onSaved={() => router.refresh()} /> : null}
        {tab === "group" ? (
          <GroupScan currency={currency} onSaved={() => router.refresh()} onSingle={() => setTab("single")} />
        ) : null}
        {tab === "manual" ? (
          <Card>
            <h2 className="text-lg font-semibold">{t("scan.manualTitle")}</h2>
            <p className="mb-5 mt-1 text-sm text-stone-500">{t("scan.manualHint")}</p>
            <ProductForm
              initial={{}}
              defaultCurrency={currency}
              onSaved={() => {
                toast(t("common.saved"));
                router.push("/food");
                router.refresh();
              }}
            />
          </Card>
        ) : null}
      </div>
    </div>
  );
}

function SingleScan({ currency, onSaved }: { currency: string; onSaved: () => void }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [phase, setPhase] = useState<"scan" | "lookup" | "form">("scan");
  const [draft, setDraft] = useState<ProductDraft | null>(null);
  const [paused, setPaused] = useState(false);
  const busyRef = useRef(false);

  const handleDetect = useCallback(
    async (raw: string) => {
      if (busyRef.current) return;
      const parsed = parseScanPayload(raw);
      if (parsed.kind === "invalid") {
        toast(parsed.reason || t("common.error"), "error");
        return;
      }
      busyRef.current = true;
      setPaused(true);
      setPhase("lookup");
      if (parsed.kind === "product") {
        const result = await lookupProduct(parsed.code);
        if (result.found && result.product) {
          setDraft({
            productId: result.product.id,
            name: result.product.name,
            brand: result.product.brand,
            category: result.product.category,
            barcode: parsed.code,
            imageUrl: result.product.imageUrl,
            packageSize: result.product.packageSize,
            currency,
            sourceNote: `${t("scan.found")} · ${t("inventory.source")}: Open Food Facts`,
          });
        } else {
          setDraft({
            barcode: parsed.code,
            currency,
            sourceNote: result.unavailable
              ? t("scan.notFoundHint")
              : `${t("scan.notFound")} ${t("scan.notFoundHint")}`,
          });
        }
      } else {
        setDraft({
          name: parsed.suggestedName,
          notes: parsed.text,
          currency,
          sourceNote: t("scan.qrText"),
        });
        toast(t("scan.qrText"), "info");
      }
      setPhase("form");
      busyRef.current = false;
    },
    [currency, t, toast],
  );

  function reset() {
    setDraft(null);
    setPhase("scan");
    setPaused(false);
    busyRef.current = false;
  }

  if (phase === "form" && draft) {
    return (
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("scan.found")}</h2>
          <Button variant="ghost" size="sm" onClick={reset}>
            <X className="h-4 w-4" /> {t("common.close")}
          </Button>
        </div>
        <ProductForm
          initial={draft}
          defaultCurrency={currency}
          onSaved={() => {
            toast(t("common.saved"));
            onSaved();
            reset();
          }}
          onCancel={reset}
        />
      </Card>
    );
  }

  return (
    <Card>
      <BarcodeScanner onDetect={handleDetect} paused={paused} />
      {phase === "lookup" ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-stone-600" role="status">
          <Loader2 className="h-4 w-4 animate-spin" /> {t("scan.lookup")}
        </p>
      ) : null}
      <div className="mt-4 flex items-start gap-2 rounded-xl bg-sage-50 p-3 text-xs text-sage-800">
        <ScanLine className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p>{t("scan.permissionBody")}</p>
      </div>
    </Card>
  );
}

function ContinuousScan({ currency, onSaved }: { currency: string; onSaved: () => void }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [batch, setBatch] = useState<ProductDraft[]>([]);
  const seenRef = useRef(new Set<string>());
  const pendingRef = useRef(new Set<string>());
  const [saving, setSaving] = useState(false);
  const [failures, setFailures] = useState<ProductDraft[]>([]);

  const handleDetect = useCallback(
    async (raw: string) => {
      const parsed = parseScanPayload(raw);
      if (parsed.kind === "invalid") {
        toast(parsed.reason || t("common.error"), "error");
        return;
      }
      const scanKey = parsed.kind === "product" ? parsed.code : parsed.raw;
      if (seenRef.current.has(scanKey) || pendingRef.current.has(scanKey)) {
        toast(t("scan.duplicate"), "info");
        return;
      }
      pendingRef.current.add(scanKey);
      let draft: ProductDraft;
      if (parsed.kind === "product") {
        const result = await lookupProduct(parsed.code);
        draft = result.found && result.product
          ? {
              productId: result.product.id,
              name: result.product.name,
              brand: result.product.brand,
              category: result.product.category,
              barcode: parsed.code,
              imageUrl: result.product.imageUrl,
              packageSize: result.product.packageSize,
              currency,
            }
          : { barcode: parsed.code, currency };
        toast(result.found ? `${result.product?.name}` : t("scan.notFound"), result.found ? "success" : "info");
      } else {
        draft = {
          name: parsed.suggestedName,
          notes: parsed.text,
          currency,
          sourceNote: t("scan.qrText"),
        };
        toast(t("scan.qrText"), "info");
      }
      pendingRef.current.delete(scanKey);
      seenRef.current.add(scanKey);
      setBatch((current) => [...current, { ...draft, scanKey }]);
    },
    [currency, t, toast],
  );

  async function saveBatch() {
    if (!batch.length) return;
    setSaving(true);
    setFailures([]);
    const failed: ProductDraft[] = [];
    let saved = 0;
    for (const draft of batch) {
      try {
        const response = await fetch("/api/inventory", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            productId: draft.productId,
            name: draft.name,
            brand: draft.brand || null,
            barcode: draft.barcode || undefined,
            category: draft.category || null,
            quantity: 1,
            unit: "item",
            imageUrl: draft.imageUrl || undefined,
            packageSize: draft.packageSize || null,
            storageLocation: "pantry",
            currency: draft.currency || currency,
            notes: draft.notes || null,
            dateValue: null,
            dateType: "unknown",
            dateConfidence: "none",
          }),
        });
        if (response.ok) saved += 1;
        else failed.push(draft);
      } catch {
        failed.push(draft);
      }
    }
    setSaving(false);
    if (saved > 0) toast(`${saved} ${t("common.items")} ${t("common.saved")}`);
    if (failed.length) {
      setFailures(failed);
      setBatch(failed);
      toast(`${failed.length} ${t("common.error")}`, "error");
    } else {
      setBatch([]);
      seenRef.current.clear();
      onSaved();
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <BarcodeScanner onDetect={handleDetect} continuous />
        <p className="mt-3 text-xs text-stone-500">{t("scan.dateNoneHint")}</p>
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">
            {t("scan.batch")} <span className="text-stone-400">({batch.length})</span>
          </h2>
          {batch.length ? (
            <Button variant="ghost" size="sm" onClick={() => { setBatch([]); seenRef.current.clear(); }}>
              {t("common.clear")}
            </Button>
          ) : null}
        </div>
        {batch.length === 0 ? (
          <p className="py-4 text-sm text-stone-500">{t("scan.batchEmpty")}</p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {batch.map((item, index) => (
              <li key={`${item.scanKey ?? item.barcode ?? "item"}-${index}`} className="flex items-center gap-3 py-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-forest-50 text-forest-700">
                  <Package className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.name || t("common.unknown")}</p>
                  <p className="truncate text-xs text-stone-500">{item.barcode || t("scan.qrCode")}</p>
                </div>
                <button
                  type="button"
                  aria-label={t("common.delete")}
                  className="tap-target flex items-center justify-center rounded-lg text-stone-400 hover:bg-stone-50 hover:text-red-600"
                  onClick={() => {
                    setBatch((current) => current.filter((_, i) => i !== index));
                    if (item.scanKey) seenRef.current.delete(item.scanKey);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {failures.length ? (
          <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900" role="alert">
            {t("common.error")} — {failures.map((f) => f.name).join(", ")}
          </p>
        ) : null}
        <Button className="mt-4 w-full" onClick={saveBatch} disabled={!batch.length || saving} size="lg">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {t("scan.confirmBatch", { count: batch.length })}
        </Button>
      </Card>
    </div>
  );
}

function GroupScan({
  currency,
  onSaved,
  onSingle,
}: {
  currency: string;
  onSaved: () => void;
  onSingle: () => void;
}) {
  const { t, locale } = useI18n();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<GroupCandidate[]>([]);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [singleBarcodeOnly, setSingleBarcodeOnly] = useState(false);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  async function analyse(file: File) {
    setBusy(true);
    setMessage(null);
    setCandidates([]);
    try {
      const compressed = await compressImage(file, 1800, 0.88);
      setPreview(URL.createObjectURL(compressed));
      const [{ barcodes, multipleSupported }, ocr] = await Promise.all([
        detectBarcodesInImage(compressed),
        recogniseText(compressed, { language: "eng" }).catch(() => ({ text: "", confidence: 0, lines: [] })),
      ]);
      setSingleBarcodeOnly(!multipleSupported);
      if (!barcodes.length) {
        setMessage(t("scan.groupNoBarcodes"));
        return;
      }
      const dateMap = assignDatesToBarcodes(
        barcodes,
        ocr.lines,
        (text) => Boolean(parseExpiryDate(text, { locale, ocrConfidence: ocr.confidence })),
      );
      const results = await Promise.all(
        barcodes.slice(0, 8).map(async (barcode) => {
          const parsed = parseScanPayload(barcode.rawValue);
          const code = parsed.kind === "product" ? parsed.code : "";
          const lookup = parsed.kind === "product" ? await lookupProduct(parsed.code) : null;
          const dateText = dateMap.get(barcode);
          const dateCandidate = dateText
            ? parseExpiryDate(dateText, { locale, ocrConfidence: ocr.confidence })
            : null;
          return {
            key: `${code}-${crypto.randomUUID()}`,
            productId: lookup?.product?.id,
            name: lookup?.product?.name ?? (parsed.kind === "text" ? parsed.suggestedName : ""),
            brand: lookup?.product?.brand ?? null,
            category: lookup?.product?.category ?? null,
            barcode: code || null,
            imageUrl: lookup?.product?.imageUrl ?? null,
            packageSize: lookup?.product?.packageSize ?? null,
            notes: parsed.kind === "text" ? parsed.text : undefined,
            sourceNote: parsed.kind === "text" ? t("scan.qrText") : undefined,
            quantity: 1,
            unit: "item",
            storageLocation: "pantry" as const,
            currency,
            dateValue: dateCandidate && dateCandidate.confidence !== "low" ? dateCandidate.date : "",
            dateType:
              dateCandidate && dateCandidate.dateType !== "unknown" ? dateCandidate.dateType : ("best_before" as const),
            originalDateText: dateCandidate?.originalText ?? "",
            dateCandidate,
            confirmed: false,
          } satisfies GroupCandidate;
        }),
      );
      setCandidates(results);
    } catch {
      setMessage(t("scan.groupNoBarcodes"));
    } finally {
      setBusy(false);
    }
  }

  async function saveAll() {
    setSaving(true);
    const remaining: GroupCandidate[] = [];
    let saved = 0;
    for (const candidate of candidates) {
      if (!(candidate.name ?? "").trim()) {
        remaining.push(candidate);
        continue;
      }
      if (candidate.dateValue && !candidate.confirmed) {
        remaining.push(candidate);
        continue;
      }
      const response = await fetch("/api/inventory", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          productId: candidate.productId,
          name: candidate.name,
          brand: candidate.brand || null,
          barcode: candidate.barcode || undefined,
          category: candidate.category || null,
          quantity: candidate.quantity ?? 1,
          unit: candidate.unit ?? "item",
          imageUrl: candidate.imageUrl || undefined,
          packageSize: candidate.packageSize || null,
          storageLocation: candidate.storageLocation ?? "pantry",
          currency: candidate.currency || currency,
          notes: candidate.notes || null,
          dateValue: candidate.dateValue || null,
          dateType: candidate.dateValue ? candidate.dateType : "unknown",
          originalDateText: candidate.originalDateText || null,
          dateConfidence: candidate.dateValue ? "high" : "none",
        }),
      }).catch(() => null);
      if (response?.ok) saved += 1;
      else remaining.push(candidate);
    }
    setSaving(false);
    if (saved) toast(`${saved} ${t("common.items")} ${t("common.saved")}`);
    if (remaining.length) {
      setCandidates(remaining);
      toast(`${remaining.length} ${t("common.error")}`, "error");
    } else {
      setCandidates([]);
      setPreview(null);
      onSaved();
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="text-base font-semibold">{t("scan.groupTitle")}</h2>
        <p className="mt-1 text-sm text-stone-500">{t("scan.groupHint")}</p>
        <label className="mt-4 flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-stone-200 bg-stone-50/60 p-6 text-center hover:border-forest-300">
          {busy ? <Loader2 className="h-7 w-7 animate-spin text-forest-600" /> : <Camera className="h-7 w-7 text-sage-600" />}
          <span className="text-sm font-medium text-forest-700">{busy ? t("scan.groupAnalyzing") : t("scan.groupCapture")}</span>
          <span className="text-xs text-stone-500">{t("scan.groupFallback")}</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void analyse(file);
              e.target.value = "";
            }}
          />
        </label>
        {preview ? (
          <div className="mt-3 flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="" className="h-20 w-20 rounded-lg border border-stone-200 object-cover" />
            <Button variant="ghost" size="sm" onClick={() => { setPreview(null); setCandidates([]); setMessage(null); }}>
              <X className="h-4 w-4" /> {t("common.clear")}
            </Button>
          </div>
        ) : null}
        {singleBarcodeOnly && candidates.length ? (
          <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900" role="status">
            {t("scan.groupSingleBarcode")}
          </p>
        ) : null}
        {message ? <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900" role="alert">{message}</p> : null}
      </Card>

      {candidates.length ? (
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold">{t("scan.groupReview")}</h2>
            <Badge tone="info">{candidates.length}</Badge>
          </div>
          <div className="space-y-4">
            {candidates.map((candidate, index) => (
              <div key={candidate.key} className="rounded-2xl border border-stone-200 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-medium text-stone-500">#{index + 1} · {candidate.barcode || t("scan.qrCode")}</p>
                  <button
                    type="button"
                    aria-label={t("common.delete")}
                    className="text-stone-400 hover:text-red-600"
                    onClick={() => setCandidates((current) => current.filter((c) => c.key !== candidate.key))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label={t("common.name")} htmlFor={`group-name-${index}`}>
                    <Input
                      id={`group-name-${index}`}
                      value={candidate.name}
                      onChange={(e) =>
                        setCandidates((current) =>
                          current.map((c) => (c.key === candidate.key ? { ...c, name: e.target.value } : c)),
                        )
                      }
                    />
                  </Field>
                  <Field label={t("common.quantity")} htmlFor={`group-qty-${index}`}>
                    <Input
                      id={`group-qty-${index}`}
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={String(candidate.quantity ?? 1)}
                      onChange={(e) =>
                        setCandidates((current) =>
                          current.map((c) =>
                            c.key === candidate.key ? { ...c, quantity: Number(e.target.value) || 1 } : c,
                          ),
                        )
                      }
                    />
                  </Field>
                  <Field label={t("common.date")} htmlFor={`group-date-${index}`}>
                    <Input
                      id={`group-date-${index}`}
                      type="date"
                      value={candidate.dateValue}
                      onChange={(e) =>
                        setCandidates((current) =>
                          current.map((c) =>
                            c.key === candidate.key
                              ? { ...c, dateValue: e.target.value, confirmed: Boolean(e.target.value) }
                              : c,
                          ),
                        )
                      }
                    />
                  </Field>
                  <Field label={t("scan.dateType")} htmlFor={`group-type-${index}`}>
                    <Select
                      id={`group-type-${index}`}
                      value={candidate.dateType}
                      disabled={!candidate.dateValue}
                      onChange={(e) =>
                        setCandidates((current) =>
                          current.map((c) =>
                            c.key === candidate.key
                              ? { ...c, dateType: e.target.value as GroupCandidate["dateType"] }
                              : c,
                          ),
                        )
                      }
                    >
                      <option value="use_by">{t("dateType.use_by")}</option>
                      <option value="best_before">{t("dateType.best_before")}</option>
                    </Select>
                  </Field>
                </div>
                {candidate.sourceNote ? (
                  <p className="mt-2 text-xs text-stone-500">{candidate.sourceNote}</p>
                ) : null}
                {candidate.dateCandidate ? (
                  <p className="mt-2 text-xs text-stone-500">
                    {t("scan.originalText")}: <span className="font-mono">{candidate.dateCandidate.originalText}</span> ·{" "}
                    {formatDate(candidate.dateCandidate.date, locale)} ({candidate.dateCandidate.confidence})
                  </p>
                ) : null}
                {candidate.dateValue && !candidate.confirmed ? (
                  <label className="mt-2 flex items-start gap-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4"
                      onChange={(e) =>
                        setCandidates((current) =>
                          current.map((c) => (c.key === candidate.key ? { ...c, confirmed: e.target.checked } : c)),
                        )
                      }
                    />
                    {t("scan.dateConfirm")}
                  </label>
                ) : null}
                {candidate.dateCandidate?.confidence === "low" ? (
                  <p className="mt-2 flex items-center gap-1 text-xs text-red-700">
                    <AlertTriangle className="h-3.5 w-3.5" /> {t("scan.dateLowConfidence")}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap justify-between gap-2">
            <Button variant="secondary" onClick={onSingle}>
              <ScanLine className="h-4 w-4" /> {t("scan.tab.single")}
            </Button>
            <Button onClick={saveAll} disabled={saving || !candidates.length}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />}
              {t("scan.confirmBatch", { count: candidates.length })}
            </Button>
          </div>
        </Card>
      ) : null}
    </div>
  );

}
