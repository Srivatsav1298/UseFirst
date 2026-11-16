import { describe, expect, it } from "vitest";
import { normalizeBarcode, validateBarcode } from "@/lib/scanner/barcode";

describe("validateBarcode", () => {
  it("accepts valid EAN-13", () => {
    expect(validateBarcode("4006381333931")).toMatchObject({ valid: true, format: "EAN-13" });
  });

  it("accepts valid UPC-A", () => {
    expect(validateBarcode("036000291452")).toMatchObject({ valid: true, format: "UPC-A" });
  });

  it("accepts valid EAN-8", () => {
    expect(validateBarcode("96385074")).toMatchObject({ valid: true, format: "EAN-8" });
  });

  it("normalizes spaces and dashes", () => {
    expect(validateBarcode("4006381 333931").normalized).toBe("4006381333931");
    expect(normalizeBarcode("963-85074")).toBe("96385074");
  });

  it("rejects wrong check digits", () => {
    const result = validateBarcode("4006381333932");
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/check digit/i);
  });

  it("rejects non-digits and unsupported lengths", () => {
    expect(validateBarcode("ABC123").valid).toBe(false);
    expect(validateBarcode("123").valid).toBe(false);
    expect(validateBarcode("123456789012345").valid).toBe(false);
  });
});

describe("parseScanPayload", () => {
  it("accepts a plain product barcode", async () => {
    const { parseScanPayload } = await import("@/lib/scanner/barcode");
    expect(parseScanPayload("4006381333931")).toMatchObject({
      kind: "product",
      code: "4006381333931",
      format: "EAN-13",
    });
  });

  it("extracts a GTIN from a QR product URL", async () => {
    const { parseScanPayload } = await import("@/lib/scanner/barcode");
    expect(parseScanPayload("https://example.com/product?gtin=4006381333931")).toMatchObject({
      kind: "product",
      code: "4006381333931",
    });
  });

  it("extracts a GTIN from a URL path", async () => {
    const { parseScanPayload } = await import("@/lib/scanner/barcode");
    expect(parseScanPayload("https://example.com/products/036000291452")).toMatchObject({
      kind: "product",
      code: "036000291452",
      format: "UPC-A",
    });
  });

  it("extracts a GTIN from GS1 application identifier 01", async () => {
    const { parseScanPayload } = await import("@/lib/scanner/barcode");
    expect(parseScanPayload("(01)4006381333931(17)261231")).toMatchObject({
      kind: "product",
      code: "4006381333931",
    });
  });

  it("keeps non-product QR text usable", async () => {
    const { parseScanPayload } = await import("@/lib/scanner/barcode");
    const result = parseScanPayload("https://example.com/recipes/milk-pudding");
    expect(result).toMatchObject({
      kind: "text",
      suggestedName: "milk pudding",
    });
  });

  it("suggests a name from plain QR text", async () => {
    const { parseScanPayload } = await import("@/lib/scanner/barcode");
    expect(parseScanPayload("Basil plant")).toMatchObject({
      kind: "text",
      suggestedName: "Basil plant",
    });
  });

  it("rejects empty scans", async () => {
    const { parseScanPayload } = await import("@/lib/scanner/barcode");
    expect(parseScanPayload("   ")).toMatchObject({ kind: "invalid" });
  });
});
