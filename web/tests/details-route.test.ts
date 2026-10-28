import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import DetailsPage from "@/app/details/page";
import Page from "@/app/page";

describe("studio routes", () => {
  it("redirects old review-console bookmarks to the studio", () => {
    expect(() => DetailsPage()).toThrow("NEXT_REDIRECT");
  });
  it("starts with a conversation and keeps drawing input in sources", () => {
    const html = renderToStaticMarkup(createElement(Page));
    expect(html).toContain("어떤 공간을 만들고 싶으세요?");
    expect(html).toContain("자료 추가");
    expect(html).toContain('accept=".pdf,.png,.jpg,.jpeg,.dxf"');
    expect(html).toContain('aria-label="설정"');
    expect(html).not.toContain("From a floor plan");
    expect(html).not.toContain("Watch recorded run");
  });
});
