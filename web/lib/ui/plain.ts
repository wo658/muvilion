/**
 * Plain-language helpers for the simple view: booth names, number formatting and the one headline
 * ("Time in crowds per visitor: 18 s → 6.5 s (−64%)"). No jargon, American English.
 */
import type { BoothSpec } from "@/lib/engine/contract";

const MINUS = "−";

/** "Food Truck 3 (sponsor food court)" → "Food Truck 3". */
export function shortLabel(label: string): string {
  return label.replace(/\s*\([^)]*\)\s*$/, "").trim() || label;
}

/** Display names for booth ids (falls back to the id). */
export function boothNames(ids: string[], specs: BoothSpec[] | undefined): string[] {
  const byId = new Map((specs ?? []).map((s) => [s.id, shortLabel(s.label)]));
  return ids.map((id) => byId.get(id) ?? id);
}

/** "a", "a and b", "a, b and c". */
export function joinAnd(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/**
 * Human list of booth names, grouping numbered ones: ["Food Truck 3", "Food Truck 1"] →
 * "Food Trucks 1 and 3"; ["Booth 10"] → "Booth 10".
 */
export function nameList(names: string[]): string {
  const groups = new Map<string, number[]>();
  const order: string[] = [];
  for (const n of [...new Set(names)]) {
    const m = /^(.*\D)\s*(\d+)$/.exec(n);
    if (!m) {
      // "Ticket Kiosk" → "the Ticket Kiosk" so it reads in a sentence
      const named = /^[A-Z]/.test(n) ? `the ${n}` : n;
      order.push(`\0${named}`);
      continue;
    }
    const prefix = m[1].trim();
    if (!groups.has(prefix)) {
      groups.set(prefix, []);
      order.push(prefix);
    }
    groups.get(prefix)!.push(Number(m[2]));
  }
  const parts = order.map((key) => {
    if (key.startsWith("\0")) return key.slice(1);
    const nums = groups.get(key)!.sort((a, b) => a - b);
    return nums.length === 1 ? `${key} ${nums[0]}` : `${key}s ${joinAnd(nums.map(String))}`;
  });
  return joinAnd(parts);
}

/** Seconds as a friendly figure: one decimal under 10 s ("6.5 s", "6 s"), whole seconds above ("18 s"). */
export function formatSeconds(s: number): string {
  if (!Number.isFinite(s)) return "—";
  const v = Math.abs(s) < 10 ? Math.round(s * 10) / 10 : Math.round(s);
  return `${String(v).replace("-", MINUS)} s`;
}

/** Relative change from `a` to `b` as a whole percent with a real minus sign ("−64%", "+12%", "±0%"). */
export function formatChange(a: number, b: number): string | null {
  if (!Number.isFinite(a) || !Number.isFinite(b) || a === 0) return null;
  const pct = Math.round(((b - a) / Math.abs(a)) * 100);
  if (pct === 0) return "±0%";
  return pct < 0 ? `${MINUS}${Math.abs(pct)}%` : `+${pct}%`;
}

export type Headline = {
  label: string;
  before: string;
  after?: string;
  change?: string;
  /** Lower is better, so a drop is good. */
  tone: "good" | "warn" | "neutral";
  /** "18 s → 6.5 s (−64%)" or "18 s". */
  text: string;
};

export const HEADLINE_LABEL = "Time in crowds per visitor";
export const CROWDED_EXPLAINER = "crowded = shoulder-to-shoulder (≥ 2 people per m²)";

export function headline(before: number, after?: number): Headline {
  const b = formatSeconds(before);
  if (after === undefined) return { label: HEADLINE_LABEL, before: b, tone: "neutral", text: b };
  const a = formatSeconds(after);
  const change = formatChange(before, after) ?? undefined;
  const pct = before === 0 ? 0 : (after - before) / before;
  const tone = Math.round(pct * 100) < 0 ? "good" : Math.round(pct * 100) > 0 ? "warn" : "neutral";
  return { label: HEADLINE_LABEL, before: b, after: a, change, tone, text: `${b} → ${a}${change ? ` (${change})` : ""}` };
}

/** "Riverside Park Plaza (60m x 40m, outdoor)" → "Riverside Park Plaza". */
export function venueShortName(name: string): string {
  return shortLabel(name);
}
