import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import DetailsPage from "@/app/details/page";
import Page from "@/app/page";
import DemoPage from "@/app/demo/page";

describe("routes render", () => {
  it("/ renders the local project workspace", () => {
    const html = renderToStaticMarkup(createElement(Page));
    expect(html).toContain("내 프로젝트");
    expect(html).toContain('href="/demo"');
  });
  it("/details renders the expert review console", () => {
    const html = renderToStaticMarkup(createElement(DetailsPage));
    expect(html).toContain("Layout Engineer");
    expect(html).toContain("Watch recorded run");
    expect(html).toContain("Inspector");
  });
  it("/demo renders the simple view with Muse's empty-state message", () => {
    const html = renderToStaticMarkup(createElement(DemoPage));
    expect(html).toContain("Pick a space and I&#x27;ll plan the booth layout");
    expect(html).toContain("Details");
    expect(html).not.toMatch(/p\/m²|hotspot|Iteration/);
  });
});
