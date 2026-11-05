"use client";

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { translate, type Locale, type MessageKey } from "./messages";

// The app always starts in English. Korean can be chosen in Settings for the
// current page session only; it is never stored, so every launch is English.
let current: Locale = "en";
const listeners = new Set<() => void>();
function read(): Locale {
  return current;
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
function setLocale(locale: Locale) {
  current = locale;
  listeners.forEach(listener => listener());
}
const LanguageContext = createContext({ locale: "en" as Locale, setLocale, t: (key: MessageKey, values?: Record<string, string | number>) => translate("en", key, values) });
export function LanguageProvider({ children }: { children: ReactNode }) {
  const locale = useSyncExternalStore(subscribe, read, () => "en" as const);
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  const value = useMemo(() => ({ locale, setLocale, t: (key: MessageKey, values?: Record<string, string | number>) => translate(locale, key, values) }), [locale]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
export function useI18n() { return useContext(LanguageContext); }
