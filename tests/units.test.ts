import { describe, expect, it } from "vitest";
import { convertQuantity, unitsCompatible } from "@/lib/meals/units";

describe("unitsCompatible", () => {
  it("matches identical units", () => {
    expect(unitsCompatible("g", "g")).toBe(true);
    expect(unitsCompatible("item", "item")).toBe(true);
  });

  it("matches mass and volume families", () => {
    expect(unitsCompatible("g", "kg")).toBe(true);
    expect(unitsCompatible("ml", "l")).toBe(true);
    expect(unitsCompatible("dl", "ml")).toBe(true);
  });

  it("rejects cross-family and unknown conversions", () => {
    expect(unitsCompatible("g", "ml")).toBe(false);
    expect(unitsCompatible("item", "g")).toBe(false);
    expect(unitsCompatible("tbsp", "ml")).toBe(false);
  });
});

describe("convertQuantity", () => {
  it("converts mass", () => {
    expect(convertQuantity(1, "kg", "g")).toBe(1000);
    expect(convertQuantity(500, "g", "kg")).toBe(0.5);
  });

  it("converts volume", () => {
    expect(convertQuantity(1, "l", "ml")).toBe(1000);
    expect(convertQuantity(2, "dl", "ml")).toBe(200);
  });

  it("returns null for incompatible units", () => {
    expect(convertQuantity(1, "item", "g")).toBeNull();
  });
});
