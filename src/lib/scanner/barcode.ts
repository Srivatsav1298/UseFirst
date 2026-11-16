export type BarcodeFormat = "EAN-8" | "UPC-A" | "EAN-13" | "GTIN-14" | "unknown";

export type BarcodeResult = {
  valid: boolean;
  format: BarcodeFormat;
  normalized: string;
  reason?: string;
};

export type ScanPayload =
  | { kind: "product"; code: string; format: BarcodeFormat; raw: string }
  | { kind: "text"; text: string; suggestedName: string; raw: string }
  | { kind: "invalid"; raw: string; reason: string };

const GTIN_PARAM_KEYS = [
  "gtin",
  "gtin13",
  "gtin14",
  "ean",
  "ean13",
  "upc",
  "barcode",
  "code",
  "sku",
  "product_code",
  "productcode",
];

function gtinCheckDigit(digits: string): number {
  let sum = 0;
  const reversed = digits.split("").reverse();
  for (let i = 0; i < reversed.length; i += 1) {
    const n = Number(reversed[i]);
    sum += i % 2 === 0 ? n * 3 : n;
  }
  return (10 - (sum % 10)) % 10;
}

export function validateBarcode(raw: string): BarcodeResult {
  const normalized = raw.replace(/[\s-]/g, "");
  if (!/^\d+$/.test(normalized)) {
    return { valid: false, format: "unknown", normalized, reason: "Barcode must contain digits only" };
  }
  const formats: Record<number, BarcodeFormat> = { 8: "EAN-8", 12: "UPC-A", 13: "EAN-13", 14: "GTIN-14" };
  const format = formats[normalized.length];
  if (!format) {
    return { valid: false, format: "unknown", normalized, reason: "Unsupported barcode length" };
  }
  const body = normalized.slice(0, -1);
  const check = Number(normalized.slice(-1));
  const expected = gtinCheckDigit(body);
  if (check !== expected) {
    return { valid: false, format, normalized, reason: "Check digit does not match" };
  }
  return { valid: true, format, normalized };
}

export function normalizeBarcode(raw: string): string {
  return raw.replace(/[\s-]/g, "");
}

function findProductCode(value: string): BarcodeResult | null {
  const direct = validateBarcode(value);
  if (direct.valid) return direct;
  const compact = value.replace(/[^\d]/g, "");
  if (compact !== value) {
    const compactResult = validateBarcode(compact);
    if (compactResult.valid) return compactResult;
  }
  return null;
}

function decodeUrlPart(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function suggestedNameFromText(text: string): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  try {
    const url = new URL(cleaned);
    const nameParam = url.searchParams.get("name") ?? url.searchParams.get("title");
    if (nameParam?.trim()) return nameParam.trim().slice(0, 120);
    const segments = url.pathname.split("/").filter(Boolean);
    for (let i = segments.length - 1; i >= 0; i -= 1) {
      const label = decodeUrlPart(segments[i])
        .replace(/\.(html?|php|aspx?)$/i, "")
        .replace(/[-_+]+/g, " ")
        .trim();
      if (label && !/^\d+$/.test(label)) return label.slice(0, 120);
    }
    return url.hostname.replace(/^www\./, "").slice(0, 120);
  } catch {
    return cleaned.slice(0, 120);
  }
}

export function parseScanPayload(raw: string): ScanPayload {
  const text = raw.trim();
  if (!text) return { kind: "invalid", raw, reason: "Empty scan result" };

  const direct = validateBarcode(text);
  if (direct.valid) {
    return { kind: "product", code: direct.normalized, format: direct.format, raw };
  }

  const gs1 = text.match(/\(01\)\s*(\d{14})/) ?? text.match(/(?:^|\D)01(\d{14})(?:\D|$)/);
  if (gs1) {
    const candidate = validateBarcode(gs1[1]);
    if (candidate.valid) {
      return { kind: "product", code: candidate.normalized, format: candidate.format, raw };
    }
  }

  try {
    const url = new URL(text);
    if (url.protocol === "http:" || url.protocol === "https:") {
      for (const key of GTIN_PARAM_KEYS) {
        const value = url.searchParams.get(key);
        if (!value) continue;
        const candidate = findProductCode(value);
        if (candidate) {
          return { kind: "product", code: candidate.normalized, format: candidate.format, raw };
        }
      }
      for (const segment of url.pathname.split("/")) {
        const candidate = findProductCode(decodeUrlPart(segment));
        if (candidate) {
          return { kind: "product", code: candidate.normalized, format: candidate.format, raw };
        }
      }
      for (const value of url.searchParams.values()) {
        const candidate = findProductCode(value);
        if (candidate) {
          return { kind: "product", code: candidate.normalized, format: candidate.format, raw };
        }
      }
    }
  } catch {
    // Not a URL; continue with plain text.
  }

  for (const match of text.matchAll(/(?:^|\D)(\d{8,14})(?:\D|$)/g)) {
    const candidate = validateBarcode(match[1]);
    if (candidate.valid) {
      return { kind: "product", code: candidate.normalized, format: candidate.format, raw };
    }
  }

  return {
    kind: "text",
    text: text.slice(0, 500),
    suggestedName: suggestedNameFromText(text),
    raw,
  };
}
