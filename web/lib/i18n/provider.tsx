"use client";

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { translate, type Locale, type MessageKey } from "./messages";

const KEY = "muvilion.settings.language.v1";
let current: Locale = "ko";
let sessionOverride: Locale | undefined;
const listeners = new Set<() => void>();
function read(): Locale {
  if (sessionOverride) return sessionOverride;
  try { const stored = localStorage.getItem(KEY); if (stored === "en" || stored === "ko") return stored; } catch { /* Session preference still works when storage is blocked. */ }
  return current;
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = () => listener();
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(listener); window.removeEventListener("storage", onStorage); };
}
function setLocale(locale: Locale) {
  current = locale;
  try { localStorage.setItem(KEY, locale); sessionOverride = undefined; } catch { sessionOverride = locale; }
  listeners.forEach(listener => listener());
}
const LanguageContext = createContext({ locale: "ko" as Locale, setLocale, t: (key: MessageKey, values?: Record<string, string | number>) => translate("ko", key, values) });
export function LanguageProvider({ children }: { children: ReactNode }) {
  const locale = useSyncExternalStore(subscribe, read, () => "ko" as const);
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  const value = useMemo(() => ({ locale, setLocale, t: (key: MessageKey, values?: Record<string, string | number>) => translate(locale, key, values) }), [locale]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
export function useI18n() { return useContext(LanguageContext); }
