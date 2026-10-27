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
