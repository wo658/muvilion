import en from "./en.json";
import ko from "./ko.json";
export type Locale = "en" | "ko";
export type MessageKey = keyof typeof en;
const catalogs: Record<Locale, Record<MessageKey, string>> = { en, ko };
export function translate(locale: Locale, key: MessageKey, values: Record<string, string | number> = {}): string {
  return catalogs[locale][key].replace(/\{(\w+)\}/g, (match, name: string) => String(values[name] ?? match));
}

/** Translate known application errors while preserving external diagnostics verbatim. */
export function localizeMessage(locale: Locale, message: string): string {
  return Object.hasOwn(en, message) ? translate(locale, message as MessageKey) : message;
}
