export type PriorityStatus =
  | "past_use_by"
  | "use_first"
  | "check_today"
  | "coming_up"
  | "available"
  | "no_date";

export type PriorityInput = {
  dateValue: string | null;
  dateType: "use_by" | "best_before" | "unknown";
  storageLocation?: string;
};

export type PriorityResult = {
  status: PriorityStatus;
  labelKey: string;
  severity: "danger" | "warning" | "info" | "neutral";
  days: number | null;
  sortScore: number;
  isSafetyDate: boolean;
};

export function daysUntilDate(value: string, now = new Date()): number {
  const target = new Date(`${value}T00:00:00Z`).getTime();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((target - today) / 86_400_000);
}

export function getPriority(input: PriorityInput, now = new Date()): PriorityResult {
  if (!input.dateValue) {
    return {
      status: "no_date",
      labelKey: "priority.noDate",
      severity: "neutral",
      days: null,
      sortScore: 10_000,
      isSafetyDate: false,
    };
  }
  const days = daysUntilDate(input.dateValue, now);
  const safety = input.dateType === "use_by";

  if (safety && days < 0) {
    return {
      status: "past_use_by",
      labelKey: "priority.pastUseBy",
      severity: "danger",
      days,
      sortScore: days,
      isSafetyDate: true,
    };
  }
  if (days <= 0) {
    return {
      status: "check_today",
      labelKey: "priority.checkToday",
      severity: safety ? "danger" : "warning",
      days,
      sortScore: days,
      isSafetyDate: safety,
    };
  }
  if (safety && days <= 3) {
    return {
      status: "use_first",
      labelKey: "priority.useFirst",
      severity: "warning",
      days,
      sortScore: days,
      isSafetyDate: true,
    };
  }
  if (days <= 7) {
    return {
      status: "coming_up",
      labelKey: "priority.comingUp",
      severity: "info",
      days,
      sortScore: days,
      isSafetyDate: safety,
    };
  }
  return {
    status: "available",
    labelKey: "priority.available",
    severity: "neutral",
    days,
    sortScore: days,
    isSafetyDate: safety,
  };
}

export function sortForUseFirst<T extends PriorityInput>(items: T[], now = new Date()): T[] {
  return [...items].sort((a, b) => getPriority(a, now).sortScore - getPriority(b, now).sortScore);
}

export function needsAttention(input: PriorityInput, now = new Date()): boolean {
  const p = getPriority(input, now);
  return ["past_use_by", "use_first", "check_today", "coming_up"].includes(p.status);
}
