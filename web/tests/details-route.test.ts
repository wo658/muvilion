import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import DetailsPage from "@/app/details/page";
import Page from "@/app/page";

describe("studio routes", () => {
  it("redirects old review-console bookmarks to the studio", () => {
    expect(() => DetailsPage()).toThrow("NEXT_REDIRECT");
  });
  it("starts with real drawing input and preserves the chat experience", () => {
    const html = renderToStaticMarkup(createElement(Page));
    expect(html).toContain("Upload a floor plan");
    expect(html).toContain("Analyze with Muse");
    expect(html).toContain("Real-world scale");
    expect(html).not.toContain("Watch recorded run");
  });
});
