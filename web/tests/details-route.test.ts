import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import DetailsPage from "@/app/details/page";
import Page from "@/app/page";

describe("studio routes", () => {
  it("redirects old review-console bookmarks to the studio", () => {
    expect(() => DetailsPage()).toThrow("NEXT_REDIRECT");
  });
  it("waits for the SQLite project before enabling editing", () => {
    const html = renderToStaticMarkup(createElement(Page));
    expect(html).toContain("Opening local projects");
    expect(html).not.toContain("Watch recorded run");
  });
});
