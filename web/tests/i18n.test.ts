import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import en from "@/lib/i18n/en.json";
import ko from "@/lib/i18n/ko.json";
import { translate, type MessageKey } from "@/lib/i18n/messages";

describe("application language packs", () => {
  it("has complete translations with matching interpolation arguments", () => {
    expect(Object.keys(ko).sort()).toEqual(Object.keys(en).sort());
    for (const key of Object.keys(en) as MessageKey[]) {
      expect(ko[key].trim(), key).not.toBe("");
      expect(ko[key].match(/\{\w+\}/g)?.sort() ?? [], key).toEqual(en[key].match(/\{\w+\}/g)?.sort() ?? []);
    }
  });
  it("keeps interpolated user content literal", () => {
    const name = "<stage> {count}";
    expect(translate("ko", "Remove {name}", { name })).toBe(`${name} 제거`);
    expect(translate("en", "Remove {name}", { name })).toBe(`Remove ${name}`);
  });
  it("keeps UI copy in the language packs instead of hard-coding Korean", () => {
    // Language names are shown in their own language on purpose.
    const allowed = new Set(["한국어"]);
    const sources = ["components", "app"].flatMap(dir => readdirSync(dir, { recursive: true, encoding: "utf8" }).map(file => join(dir, file)))
      .filter(file => /\.tsx?$/.test(file) && !file.startsWith(join("components", "ui")));
    const offenders = sources.flatMap(file => [...readFileSync(file, "utf8").matchAll(/[가-힣][^"'`<>{}]*/g)]
      .map(match => match[0].trim()).filter(text => !allowed.has(text)).map(text => `${file}: ${text}`));
    expect(offenders).toEqual([]);
  });
});
