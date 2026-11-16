import { describe, expect, it } from "vitest";
import { getPriority, needsAttention, sortForUseFirst } from "@/lib/inventory/priority";

const now = new Date("2026-06-15T12:00:00Z");

describe("getPriority", () => {
  it("marks undated items as no_date and sorts them last", () => {
    const result = getPriority({ dateValue: null, dateType: "unknown" }, now);
    expect(result.status).toBe("no_date");
    expect(result.sortScore).toBe(10_000);
    expect(result.isSafetyDate).toBe(false);
  });

  it("flags a past use-by as a safety danger", () => {
    const result = getPriority({ dateValue: "2026-06-14", dateType: "use_by" }, now);
    expect(result.status).toBe("past_use_by");
    expect(result.severity).toBe("danger");
    expect(result.isSafetyDate).toBe(true);
    expect(result.days).toBe(-1);
  });

  it("does not call a past best-before unsafe", () => {
    const result = getPriority({ dateValue: "2026-06-14", dateType: "best_before" }, now);
    expect(result.status).toBe("check_today");
    expect(result.severity).toBe("warning");
    expect(result.isSafetyDate).toBe(false);
  });

  it("uses first within three days for use-by dates", () => {
    expect(getPriority({ dateValue: "2026-06-18", dateType: "use_by" }, now).status).toBe("use_first");
    expect(getPriority({ dateValue: "2026-06-19", dateType: "use_by" }, now).status).toBe("coming_up");
  });

  it("shows best-before within a week as coming up", () => {
    const result = getPriority({ dateValue: "2026-06-22", dateType: "best_before" }, now);
    expect(result.status).toBe("coming_up");
    expect(result.severity).toBe("info");
  });

  it("marks later dates as available", () => {
    const result = getPriority({ dateValue: "2026-07-15", dateType: "use_by" }, now);
    expect(result.status).toBe("available");
    expect(result.days).toBe(30);
  });

  it("treats today as check today", () => {
    const result = getPriority({ dateValue: "2026-06-15", dateType: "use_by" }, now);
    expect(result.status).toBe("check_today");
    expect(result.days).toBe(0);
    expect(result.severity).toBe("danger");
  });
});

describe("sortForUseFirst", () => {
  it("orders by urgency and keeps undated last", () => {
    const items = [
      { id: "later", dateValue: "2026-07-01", dateType: "use_by" as const },
      { id: "none", dateValue: null, dateType: "unknown" as const },
      { id: "past", dateValue: "2026-06-01", dateType: "use_by" as const },
      { id: "soon", dateValue: "2026-06-17", dateType: "use_by" as const },
    ];
    expect(sortForUseFirst(items, now).map((item) => item.id)).toEqual(["past", "soon", "later", "none"]);
  });
});

describe("needsAttention", () => {
  it("includes expiring and unsafe items only", () => {
    expect(needsAttention({ dateValue: "2026-06-14", dateType: "use_by" }, now)).toBe(true);
    expect(needsAttention({ dateValue: "2026-06-20", dateType: "best_before" }, now)).toBe(true);
    expect(needsAttention({ dateValue: "2026-08-01", dateType: "best_before" }, now)).toBe(false);
    expect(needsAttention({ dateValue: null, dateType: "unknown" }, now)).toBe(false);
  });
});
