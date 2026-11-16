import { en, type MessageKey, type Messages } from "./messages/en";
import { nb } from "./messages/nb";

export const dictionaries: Record<string, Messages> = { en, nb };
export const locales = [
  { code: "en", label: "English" },
  { code: "nb", label: "Norsk bokmål" },
] as const;

export type Locale = "en" | "nb";

export function getMessages(locale: string): Messages {
  return dictionaries[locale] ?? en;
}

export function translate(
  locale: string,
  key: MessageKey,
  vars?: Record<string, string | number>,
): string {
  const messages = getMessages(locale);
  let value = messages[key] ?? en[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      value = value.replaceAll(`{${k}}`, String(v));
    }
  }
  return value;
}

export { en, nb };
export type { MessageKey, Messages };
