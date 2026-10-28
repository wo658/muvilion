import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Page from "@/app/page";

describe("studio routes", () => {
  it("waits for the SQLite project before enabling editing", () => {
    const html = renderToStaticMarkup(createElement(Page));
    expect(html).toContain("프로젝트를 여는 중");
    expect(html).not.toContain("Watch recorded run");
  });
});
