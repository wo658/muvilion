import type { Locale, MessageKey } from "@/lib/i18n/messages";

export async function boothRequest<T>(url: string, options: { method?: string; token?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  const response = await fetch(url, {
    method: options.method ?? "GET", signal: options.signal, cache: "no-store",
    headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}) },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Could not process the request. Please try again.");
  return data as T;
}
/** Catalog keys; translate at render time. */
export const applicationStatus = { pending: "Awaiting approval", approved: "Participation approved", rejected: "Rejected" } as const satisfies Record<string, MessageKey>;
export function won(value: number, locale: Locale = "ko") { return new Intl.NumberFormat(locale === "ko" ? "ko-KR" : "en-US", { style: "currency", currency: "KRW", maximumFractionDigits: 0 }).format(value); }
