import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { hexToRgb, TOKENS, type TokenName } from "@/lib/ui/tokens";

const root = join(__dirname, "..");

function luminance(hex: string) {
  const [r, g, b] = hexToRgb(hex).map(c => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: TokenName, b: TokenName) {
  const [hi, lo] = [luminance(TOKENS[a]), luminance(TOKENS[b])].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe("color tokens", () => {
  const surfaces: TokenName[] = ["bg", "surface", "sunken"];
  const textPairs = [
    ...surfaces.flatMap(s => (["ink", "inkSoft", "muted", "accent", "ok", "bad"] as TokenName[]).map(t => [t, s])),
    // `selected` only sits under neutral text (current nav item, pressed toggle).
    ["ink", "selected"], ["muted", "selected"],
  ] as [TokenName, TokenName][];

  it.each(textPairs)(
    "%s text on %s meets WCAG AA (4.5:1)",
    (text, surface) => expect(contrast(text, surface)).toBeGreaterThanOrEqual(4.5),
  );

  it.each([["accentInk", "accent"], ["accentInk", "accentHover"], ["surface", "ink"], ["bad", "badSoft"], ["ink", "accentSoft"]] as [TokenName, TokenName][])(
    "%s on %s meets WCAG AA (4.5:1)",
    (text, fill) => expect(contrast(text, fill)).toBeGreaterThanOrEqual(4.5),
  );

  it.each(surfaces.map(s => ["faint", s] as [TokenName, TokenName]))(
    "%s icons on %s meet the 3:1 non-text minimum",
    (icon, surface) => expect(contrast(icon, surface)).toBeGreaterThanOrEqual(3),
  );

  it("neutral surfaces step from page to panel to well", () => {
    expect(luminance(TOKENS.surface)).toBeGreaterThan(luminance(TOKENS.bg));
    expect(luminance(TOKENS.bg)).toBeGreaterThan(luminance(TOKENS.sunken));
    expect(luminance(TOKENS.sunken)).toBeGreaterThan(luminance(TOKENS.selected));
    expect(luminance(TOKENS.hairline)).toBeGreaterThan(luminance(TOKENS.hairlineStrong));
    expect(luminance(TOKENS.hairlineStrong)).toBeGreaterThan(luminance(TOKENS.edge));
  });
});

// Scene materials and the mascot are domain artwork, not UI chrome (see design.md).
const ARTWORK = ["components/muvi/", "components/studio/exhibition-object.tsx"];
const ALLOWED: Record<string, string[]> = {
  // Search keywords describe asset finishes; these strings are never UI paint values.
  "lib/assets/catalog.ts": ['"white"'],
  // exhibition-mode lighting and materials
  "components/studio/scene-view.tsx": ["#e6f1ff", "#c6b69b", "#b9b5af", "#d2bfa7", "#263b58", "#000000"],
  // flattens transparent uploads onto paper before extraction
  "lib/sources/files.ts": ['"white"'],
};
const LITERAL = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch)\(|["'](?:white|black)["']/g;

function sources(dir: string): string[] {
  return readdirSync(join(root, dir), { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return /\.(tsx?|css)$/.test(entry.name) ? [path] : [];
  });
}

describe("UI code uses color tokens only", () => {
  const files = ["app", "components", "lib"].flatMap(sources)
    .map(file => relative(root, join(root, file)))
    .filter(file => file !== "lib/ui/tokens.ts" && !file.startsWith("lib/engine/openapi") && !ARTWORK.some(prefix => file.startsWith(prefix)));

  it.each(files)("%s has no literal colors", file => {
    const allowed = ALLOWED[file] ?? [];
    const found = (readFileSync(join(root, file), "utf8").match(LITERAL) ?? []).filter(match => !allowed.includes(match));
    expect(found).toEqual([]);
  });
});
