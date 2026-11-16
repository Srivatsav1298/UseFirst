export type DateType = "use_by" | "best_before" | "unknown";
export type DateConfidence = "high" | "medium" | "low" | "none";

export type DateCandidate = {
  date: string;
  dateType: DateType;
  confidence: DateConfidence;
  score: number;
  originalText: string;
  labelText: string | null;
  ambiguous: boolean;
  reason: string;
};

export type ParseOptions = {
  locale?: string;
  ocrConfidence?: number;
  now?: Date;
};

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, januar: 1,
  feb: 2, february: 2, februar: 2,
  mar: 3, march: 3, mars: 3,
  apr: 4, april: 4,
  may: 5, mai: 5,
  jun: 6, june: 6, juni: 6,
  jul: 7, july: 7, juli: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10, oktober: 10,
  nov: 11, november: 11,
  dec: 12, december: 12, desember: 12,
};

const USE_BY_LABELS = [
  "use by", "use-by", "use before", "consume by", "consume before",
  "expiration date", "expiration", "expiry date", "expiry", "exp date",
  "siste forbruksdag", "siste forbruksdato", "bruk før", "brukes før",
  "verbrauchen bis", "zu verbrauchen bis", "à consommer jusqu",
  "consumir antes de", "enjoy by",
];

const BEST_BEFORE_LABELS = [
  "best before end", "best before", "best-before", "best by", "bbe", "bb",
  "best før", "best-før", "holdbar til", "holdbarhetsdato",
  "mindestens haltbar bis", "best before date",
  "mejor antes de", "mejor antes", "à consommer de préférence avant",
];

function normalise(text: string): string {
  return text
    .replace(/[|]/g, "I")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function findLabel(text: string): { type: DateType; label: string; index: number } | null {
  const lower = text.toLowerCase();
  const matches: { type: DateType; label: string; index: number }[] = [];
  for (const label of USE_BY_LABELS) {
    const idx = lower.indexOf(label);
    if (idx >= 0) matches.push({ type: "use_by", label, index: idx });
  }
  for (const label of BEST_BEFORE_LABELS) {
    const idx = lower.indexOf(label);
    if (idx >= 0) matches.push({ type: "best_before", label, index: idx });
  }
  if (!matches.length) return null;
  matches.sort((a, b) => a.index - b.index || b.label.length - a.label.length);
  return matches[0];
}

function iso(year: number, month: number, day: number): string | null {
  if (year < 2000 || year > 2100) return null;
  if (month < 1 || month > 12) return null;
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
    return null;
  }
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function expandYear(raw: string): number {
  const n = Number(raw);
  if (raw.length === 4) return n;
  return n >= 70 ? 1900 + n : 2000 + n;
}

type Parsed = { date: string; ambiguous: boolean; fullYear: boolean; reason: string };

function parseNumericDate(raw: string, locale: string): Parsed | null {
  const cleaned = raw.replace(/[.,]/g, (m) => (m === "." ? "." : "/"));
  const parts = cleaned.split(/[\/\-.]/).map((p) => p.trim()).filter(Boolean);
  if (parts.length !== 3) return null;
  if (parts.some((p) => !/^\d{1,4}$/.test(p))) return null;
  const [a, b, c] = parts;
  if (a.length === 4) {
    const date = iso(Number(a), Number(b), Number(c));
    return date ? { date, ambiguous: false, fullYear: true, reason: "ISO year-first date" } : null;
  }
  const year = expandYear(c);
  const fullYear = c.length === 4;
  const dayFirst = Number(a) > 12;
  const monthFirst = Number(b) > 12;
  const usLocale = /^en-US/i.test(locale);
  let day: number;
  let month: number;
  let ambiguous = false;
  if (dayFirst && !monthFirst) {
    day = Number(a);
    month = Number(b);
  } else if (monthFirst && !dayFirst) {
    month = Number(a);
    day = Number(b);
  } else if (!dayFirst && !monthFirst) {
    ambiguous = true;
    if (usLocale) {
      month = Number(a);
      day = Number(b);
    } else {
      day = Number(a);
      month = Number(b);
    }
  } else {
    return null;
  }
  const date = iso(year, month, day);
  return date ? { date, ambiguous, fullYear, reason: ambiguous ? "Ambiguous day/month order" : "Numeric date" } : null;
}

function parseTextDate(raw: string): Parsed | null {
  const cleaned = raw.replace(/,/g, " ").replace(/\s+/g, " ").trim();
  let m = cleaned.match(/^(\d{1,2})\.?\s+([A-Za-zæøåÆØÅ]{3,9})\.?\s+(\d{2,4})$/);
  if (m) {
    const month = MONTHS[m[2].toLowerCase()];
    const date = month ? iso(expandYear(m[3]), month, Number(m[1])) : null;
    return date ? { date, ambiguous: false, fullYear: m[3].length === 4, reason: "Text month date" } : null;
  }
  m = cleaned.match(/^([A-Za-zæøåÆØÅ]{3,9})\.?\s+(\d{1,2}),?\s+(\d{2,4})$/);
  if (m) {
    const month = MONTHS[m[1].toLowerCase()];
    const date = month ? iso(expandYear(m[3]), month, Number(m[2])) : null;
    return date ? { date, ambiguous: false, fullYear: m[3].length === 4, reason: "Text month date" } : null;
  }
  m = cleaned.match(/^(\d{1,2})[\/\-.](\d{4})$/);
  if (m) {
    const day = Number(m[1]);
    const year = Number(m[2]);
    const last = new Date(Date.UTC(year, day, 0));
    if (year >= 2000 && year <= 2100 && day >= 1 && day <= 12) {
      return {
        date: `${year}-${String(day).padStart(2, "0")}-${String(last.getUTCDate()).padStart(2, "0")}`,
        ambiguous: true,
        fullYear: true,
        reason: "Month/year only; last day of month assumed",
      };
    }
  }
  return null;
}

const DATE_PATTERNS: RegExp[] = [
  /(?<![\d/.\-])\d{4}-\d{1,2}-\d{1,2}(?![\d/.\-])/g,
  /(?<![\d/.\-])\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}(?![\d/.\-])/g,
  /\b\d{1,2}\.?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|januar|februar|mars|mai|juni|juli|august|september|oktober|november|desember|january|february|march|april|june|july|october|december)\.?\s+\d{2,4}\b/gi,
  /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)\.?\s+\d{1,2},?\s+\d{2,4}\b/gi,
  /(?<![\d/.\-])\d{1,2}[\/.\-]\d{4}(?![\d/.\-])/g,
];

export function extractDateCandidates(text: string, options: ParseOptions = {}): DateCandidate[] {
  const locale = options.locale || "en";
  const now = options.now || new Date();
  const normalised = normalise(text);
  const label = findLabel(normalised);
  const seen = new Set<string>();
  const candidates: DateCandidate[] = [];

  for (const pattern of DATE_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(normalised))) {
      const raw = match[0];
      const key = raw.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const parsed = /\d{4}-\d/.test(raw) ? parseNumericDate(raw, locale) : parseTextDate(raw) || parseNumericDate(raw, locale);
      if (!parsed) continue;

      const distanceFromLabel = label ? Math.abs(match.index - label.index) : Infinity;
      const labelNearby = label && distanceFromLabel < 48;
      let score = 0.5;
      const reasons: string[] = [parsed.reason];
      if (labelNearby) {
        score += 0.25;
        reasons.push(`near "${label.label}"`);
      } else if (label) {
        score -= 0.1;
        reasons.push("label far from date");
      }
      if (parsed.fullYear) score += 0.12;
      if (!parsed.ambiguous) score += 0.08;
      else score -= 0.08;
      if (/month\/year only/i.test(parsed.reason)) score -= 0.2;
      if (options.ocrConfidence !== undefined) {
        if (options.ocrConfidence < 60) {
          score -= 0.2;
          reasons.push("low OCR confidence");
        } else if (options.ocrConfidence > 85) {
          score += 0.05;
        }
      }
      const date = new Date(`${parsed.date}T00:00:00Z`);
      if (date.getUTCFullYear() < now.getUTCFullYear() - 8) {
        score -= 0.25;
        reasons.push("date is far in the past");
      }
      score = Math.max(0, Math.min(1, score));
      const confidence: DateConfidence = score >= 0.8 ? "high" : score >= 0.5 ? "medium" : "low";
      candidates.push({
        date: parsed.date,
        dateType: labelNearby ? label.type : "unknown",
        confidence,
        score: Number(score.toFixed(2)),
        originalText: raw,
        labelText: labelNearby ? label.label : null,
        ambiguous: parsed.ambiguous,
        reason: reasons.join("; "),
      });
    }
  }

  return candidates.sort((a, b) => b.score - a.score || a.date.localeCompare(b.date));
}

export function parseExpiryDate(text: string, options: ParseOptions = {}): DateCandidate | null {
  const candidates = extractDateCandidates(text, options);
  return candidates[0] ?? null;
}

export function isValidManualDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function formatDate(value: string, locale: string): string {
  const d = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }).format(d);
}

export function daysUntil(value: string, now = new Date()): number {
  const target = new Date(`${value}T00:00:00Z`).getTime();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((target - today) / 86_400_000);
}
