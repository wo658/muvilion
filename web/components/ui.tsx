"use client";

/** Small shared UI primitives in the architectural-model style (tokens: lib/ui/tokens.ts). */
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Button as ShadcnButton } from "./ui/button";
import { ToggleGroup, ToggleGroupItem } from "./ui/toggle-group";

type Variant = "primary" | "secondary" | "ghost" | "danger";
export function Button({ variant = "secondary", className = "", ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const variants = { primary: "default", secondary: "outline", ghost: "ghost", danger: "destructive" } as const;
  return <ShadcnButton type="button" size="sm" variant={variants[variant]} className={className} {...rest} />;
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
  return <ToggleGroup aria-label={label} value={[String(value)]} onValueChange={values => { const option = options.find(o => String(o.id) === values[0]); if (option) onChange(option.id); }} size={size === "md" ? "default" : "sm"} variant="outline" spacing={0}>
    {options.map(o => <ToggleGroupItem key={String(o.id)} value={String(o.id)} title={o.title} disabled={o.disabled}>{o.label}</ToggleGroupItem>)}
  </ToggleGroup>;
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
