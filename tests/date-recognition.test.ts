import { describe, expect, it } from "vitest";
import { extractDateCandidates, parseExpiryDate } from "@/lib/date-recognition/parse";

const now = new Date("2026-06-15T12:00:00Z");

describe("parseExpiryDate", () => {
  it("parses ISO dates with an explicit use-by label", () => {
    const result = parseExpiryDate("USE BY 2026-06-20", { locale: "en-GB", now });
    expect(result?.date).toBe("2026-06-20");
    expect(result?.dateType).toBe("use_by");
    expect(result?.confidence).toBe("high");
    expect(result?.originalText).toBe("2026-06-20");
  });

  it("distinguishes best-before labels", () => {
    const result = parseExpiryDate("Best before 20.06.2026", { locale: "nb", now });
    expect(result?.date).toBe("2026-06-20");
    expect(result?.dateType).toBe("best_before");
    expect(result?.ambiguous).toBe(false);
  });

  it("uses day-first order outside en-US when ambiguous", () => {
    const result = parseExpiryDate("05/06/2026", { locale: "nb", now });
    expect(result?.date).toBe("2026-06-05");
    expect(result?.ambiguous).toBe(true);
    expect(result?.confidence).not.toBe("high");
  });

  it("uses month-first order for en-US when ambiguous", () => {
    const result = parseExpiryDate("05/06/2026", { locale: "en-US", now });
    expect(result?.date).toBe("2026-05-06");
    expect(result?.ambiguous).toBe(true);
  });

  it("parses Norwegian month names", () => {
    const result = parseExpiryDate("Siste forbruksdag 20. juni 2026", { locale: "nb", now });
    expect(result?.date).toBe("2026-06-20");
    expect(result?.dateType).toBe("use_by");
  });

  it("parses month/year labels as last day of month, with lower confidence", () => {
    const result = parseExpiryDate("Best before 06/2026", { locale: "en-GB", now });
    expect(result?.date).toBe("2026-06-30");
    expect(result?.ambiguous).toBe(true);
    expect(result?.confidence).not.toBe("high");
  });

  it("does not emit a substring month/year candidate for a full date", () => {
    const candidates = extractDateCandidates("Best before 12/05/2026", { locale: "en-GB", now });
    expect(candidates.map((c) => c.originalText)).toEqual(["12/05/2026"]);
  });

  it("rejects impossible dates", () => {
    expect(parseExpiryDate("2026-02-30", { locale: "en-GB", now })).toBeNull();
    expect(parseExpiryDate("31/31/2026", { locale: "en-GB", now })).toBeNull();
  });

  it("returns null when no date is present", () => {
    expect(parseExpiryDate("Chicken breast 400 g", { now })).toBeNull();
  });

  it("preserves the original text", () => {
    const result = parseExpiryDate("use by 20 JUN 2026", { locale: "en-GB", now });
    expect(result?.originalText).toBe("20 JUN 2026");
  });

  it("lowers confidence for low OCR confidence", () => {
    const high = parseExpiryDate("use by 20/06/2026", { locale: "en-GB", now, ocrConfidence: 95 });
    const low = parseExpiryDate("use by 20/06/2026", { locale: "en-GB", now, ocrConfidence: 40 });
    expect(low?.score).toBeLessThan(high?.score ?? 0);
    expect(low?.confidence).not.toBe("high");
  });
});
