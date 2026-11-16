import { describe, expect, it } from "vitest";
import { inventoryCreateSchema } from "@/lib/validation/schemas";

const base = {
  name: "Milk",
  quantity: 1,
  unit: "carton",
  storageLocation: "refrigerator" as const,
  currency: "NOK",
};

describe("inventoryCreateSchema date safety", () => {
  it("accepts a confirmed use-by date", () => {
    const result = inventoryCreateSchema.safeParse({
      ...base,
      dateValue: "2026-06-20",
      dateType: "use_by",
      dateConfidence: "high",
      originalDateText: "20.06.2026",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a low-confidence OCR date", () => {
    const result = inventoryCreateSchema.safeParse({
      ...base,
      dateValue: "2026-06-20",
      dateType: "use_by",
      dateConfidence: "low",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => /Low-confidence/i.test(issue.message))).toBe(true);
    }
  });

  it("rejects a date without a confidence confirmation", () => {
    const result = inventoryCreateSchema.safeParse({
      ...base,
      dateValue: "2026-06-20",
      dateType: "use_by",
      dateConfidence: "none",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a date without a use-by or best-before type", () => {
    const result = inventoryCreateSchema.safeParse({
      ...base,
      dateValue: "2026-06-20",
      dateType: "unknown",
      dateConfidence: "high",
    });
    expect(result.success).toBe(false);
  });

  it("allows undated items", () => {
    const result = inventoryCreateSchema.safeParse({ ...base, dateValue: null, dateType: "unknown" });
    expect(result.success).toBe(true);
  });

  it("rejects impossible calendar dates", () => {
    const result = inventoryCreateSchema.safeParse({
      ...base,
      dateValue: "2026-02-30",
      dateType: "use_by",
      dateConfidence: "high",
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-HTTPS image URLs", () => {
    const result = inventoryCreateSchema.safeParse({ ...base, imageUrl: "http://example.com/a.jpg" });
    expect(result.success).toBe(false);
  });
});
