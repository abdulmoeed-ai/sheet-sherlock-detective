import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { MarkdownContent } from "./MarkdownContent";

function renderMarkdown(markdown: string, renderCitation?: (index: number) => React.ReactNode) {
  return renderToStaticMarkup(
    <MarkdownContent markdown={markdown} renderCitation={renderCitation} />,
  );
}

describe("MarkdownContent", () => {
  it("renders common markdown blocks and inline formatting", () => {
    const html = renderMarkdown(
      "### Company\n\n**Revenue** and *EPS* use `PKR`.\n\n- Revenue grew\n- EPS improved\n\n1. Base\n2. Bull",
    );

    expect(html).toContain("<h5");
    expect(html).toContain("Company");
    expect(html).toContain("<strong>Revenue</strong>");
    expect(html).toContain("<em>EPS</em>");
    expect(html).toContain("<code");
    expect(html).toContain("PKR");
    expect(html).toContain("<ul");
    expect(html).toContain("Revenue grew");
    expect(html).toContain("<ol");
    expect(html).toContain("Base");
  });

  it("renders GFM tables", () => {
    const html = renderMarkdown("| Scenario | FY2026 |\n| --- | ---: |\n| Base | 10 |");

    expect(html).toContain("<table");
    expect(html).toContain("<th");
    expect(html).toContain("Scenario");
    expect(html).toContain("Base");
  });

  it("renders backend LaTeX formulas instead of raw dollar-delimited markdown", () => {
    const html = renderMarkdown(
      String.raw`Calculation: $$\text{CAGR} = \left( \frac{95,020.57}{45,665.24} \right)^{\frac{1}{3}} - 1 \approx (2.0808)^{0.3333} - 1 \approx \mathbf{27.66%}$$`,
    );

    expect(html).toContain("katex");
    expect(html).toContain("CAGR");
    expect(html).toContain("27.66%");
    expect(html).not.toContain("$$");
    expect(html).not.toContain("katex-error");
  });

  it("renders escaped br markers inside table cells as line breaks", () => {
    const html = renderMarkdown(
      "| Scenario | Metric | FY26E |\n| --- | --- | ---: |\n| Base Case | Revenue (PKR M)<br>Net Income (PKR M)<br>EPS (PKR) | 60,000.00<br>8,000.00<br>40.10 |",
    );

    expect(html).toContain("Revenue (PKR M)<br/>Net Income (PKR M)<br/>EPS (PKR)");
    expect(html).toContain("60,000.00<br/>8,000.00<br/>40.10");
    expect(html).not.toContain("&lt;br&gt;");
  });

  it("renders thematic breaks as separators instead of literal dashes", () => {
    const html = renderMarkdown("Answer above.\n\n---\n\nSources below.");

    expect(html).toContain("<hr");
    expect(html).not.toContain("---");
  });

  it("sanitizes unsafe links and opens safe links in a new tab", () => {
    const html = renderMarkdown("[unsafe](javascript:alert(1)) [safe](https://example.com/report)");

    expect(html).not.toContain("javascript:alert");
    expect(html).toContain('href=""');
    expect(html).toContain('href="https://example.com/report"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noreferrer"');
  });

  it("preserves citation markers as text when no citation renderer is provided", () => {
    const html = renderMarkdown("Baseline uses PAT [1] and ADB [3].");

    expect(html).toContain("PAT [1] and ADB [3]");
  });

  it("delegates citation markers to the citation renderer", () => {
    const renderCitation = vi.fn((index: number) => <button type="button">cite {index}</button>);

    const html = renderMarkdown("Baseline uses PAT [1] and ADB [3].", renderCitation);

    expect(renderCitation).toHaveBeenCalledWith(1);
    expect(renderCitation).toHaveBeenCalledWith(3);
    expect(html).toContain("cite 1");
    expect(html).toContain("cite 3");
  });

  it("supports hiding inline citation markers", () => {
    const html = renderMarkdown("Baseline uses PAT [1].", () => null);

    expect(html).toContain("Baseline uses PAT .");
    expect(html).not.toContain("[1]");
  });
});
