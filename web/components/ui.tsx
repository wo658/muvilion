"use client";

/** Small shared UI primitives in the architectural-model style (tokens: lib/ui/tokens.ts). */
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { ACTORS, type ActorId } from "@/lib/ui/actors";

export function Card({
  title,
  children,
  right,
  className = "",
  bodyClassName = "",
}: {
  title?: ReactNode;
  children: ReactNode;
  right?: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={`min-w-0 rounded-[6px] border border-hairline bg-surface ${className}`}>
      {(title || right) && (
        <div className="flex min-h-10 flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-b border-hairline px-4 py-2">
          {title && <h2 className="eyebrow">{title}</h2>}
          {right}
        </div>
      )}
      <div className={`p-4 ${bodyClassName}`}>{children}</div>
    </section>
  );
}

/** A section inside a workspace pane: flat, divided by hairlines instead of boxed. */
export function PaneSection({
  title,
  right,
  children,
  className = "",
}: {
  title?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`border-b border-hairline px-4 py-3.5 last:border-b-0 ${className}`}>
      {(title || right) && (
        <div className="mb-2.5 flex min-h-5 flex-wrap items-center justify-between gap-x-3 gap-y-1">
          {title && <h2 className="eyebrow">{title}</h2>}
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

/** Underline tabs for the inspector; `count` renders a small pill next to the label. */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: { id: T; label: ReactNode; count?: number; dot?: boolean }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-4 overflow-x-auto border-b border-hairline px-4">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={`-mb-px inline-flex h-10 shrink-0 items-center gap-1.5 border-b-2 text-[12.5px] font-medium transition-colors ${
            value === t.id ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"
          }`}
        >
          {t.label}
          {t.count !== undefined && <span className="num rounded-full bg-sunken px-1.5 text-[10.5px] leading-[16px] text-muted">{t.count}</span>}
          {t.dot && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />}
        </button>
      ))}
    </div>
  );
}

/** One figure in the KPI strip: label, value, unit and an optional delta / note line. */
export function Kpi({ label, value, unit, foot, tone }: { label: string; value: ReactNode; unit?: string; foot?: ReactNode; tone?: "ok" | "bad" }) {
  return (
    <div className="min-w-0 py-2 pr-3 lg:px-4 lg:py-2.5">
      <div className="truncate text-[11px] font-medium text-muted">{label}</div>
      <div className="mt-0.5 flex items-baseline gap-1">
        <span className={`num text-[20px] font-medium leading-none ${tone === "bad" ? "text-bad" : tone === "ok" ? "text-ok" : "text-ink"}`}>{value}</span>
        {unit && <span className="text-[11px] text-muted">{unit}</span>}
      </div>
      <div className="mt-1 h-4 truncate text-[11px] text-faint">{foot}</div>
    </div>
  );
}

type Variant = "primary" | "secondary" | "ghost" | "danger";
const VARIANT: Record<Variant, string> = {
  primary: "bg-accent text-white hover:bg-accent-hover border border-accent",
  secondary: "bg-surface text-ink border border-hairline-strong hover:border-ink-soft",
  ghost: "text-muted hover:text-ink border border-transparent",
  danger: "text-bad border border-transparent hover:border-bad/40",
};

export function Button({ variant = "secondary", className = "", ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      {...rest}
      className={`inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-[5px] px-3 text-[12.5px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${VARIANT[variant]} ${className}`}
    />
  );
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
  size = "sm",
}: {
  options: { id: T; label: ReactNode; title?: string; disabled?: boolean }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  size?: "sm" | "md";
}) {
  return (
    <span role="group" aria-label={label} className="inline-flex max-w-full rounded-[5px] border border-hairline bg-sunken p-0.5">
      {options.map((o) => (
        <button
          key={String(o.id)}
          type="button"
          title={o.title}
          disabled={o.disabled}
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
          className={`whitespace-nowrap rounded-[3px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${size === "md" ? "px-2.5 py-1 text-[12.5px]" : "px-2 py-0.5 text-[11.5px]"} ${
            value === o.id ? "bg-surface text-ink shadow-[0_0_0_1px_var(--hairline)]" : "text-muted hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </span>
  );
}

export function Swatch({ children, label }: { children: ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {children}
      {label}
    </span>
  );
}

/** Small actor tag: Muse in the accent, every open-source engine and our code in neutral. */
export function ActorTag({ id, dim = false }: { id: ActorId; dim?: boolean }) {
  const a = ACTORS[id];
  const llm = a.llm;
  return (
    <span
      title={a.name}
      className={`inline-flex h-[18px] shrink-0 items-center rounded-[3px] px-1.5 text-[10px] font-semibold uppercase tracking-[0.06em] ${
        llm ? "bg-accent text-white" : id === "code" ? "border border-hairline-strong text-muted" : "border border-ink-soft/40 bg-sunken text-ink-soft"
      } ${dim ? "opacity-45" : ""}`}
    >
      {a.tag}
    </span>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "accent" | "ok" | "bad" }) {
  const t =
    tone === "accent"
      ? "border-accent/30 bg-accent-soft text-accent"
      : tone === "ok"
        ? "border-ok/30 text-ok"
        : tone === "bad"
          ? "border-bad/30 text-bad"
          : "border-hairline-strong text-muted";
  return <span className={`inline-flex h-5 items-center gap-1 rounded-full border px-2 text-[11px] font-medium ${t}`}>{children}</span>;
}
