import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatQuantity(value: string | number): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return String(value);
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

export function formatMoney(value: number | string | null | undefined, currency: string): string | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return null;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

export function relativeDate(value: string, locale: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const diffDays = Math.round((d.getTime() - Date.now()) / 86_400_000);
  if (Math.abs(diffDays) <= 1) {
    return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(diffDays, "day");
  }
  return new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(d);
}
