import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import DetailsPage from "@/app/details/page";
import Page from "@/app/page";

describe("routes render", () => {
  it("/details renders the expert review console", () => {
    const html = renderToStaticMarkup(createElement(DetailsPage));
    expect(html).toContain("muvilion");
    expect(html).toContain("Watch recorded run");
    expect(html).toContain("Inspector");
  });
  it("/ renders the simple view with Muse's empty-state message", () => {
    const html = renderToStaticMarkup(createElement(Page));
    expect(html).toContain("Pick a space and I&#x27;ll plan the booth layout");
    expect(html).toContain("Details");
    expect(html).not.toMatch(/p\/m²|hotspot|Iteration/);
  });
});
