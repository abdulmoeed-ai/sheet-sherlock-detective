import { describe, expect, it } from "vitest";
import { parseChatMarkdown } from "./chat-markdown";

describe("chat markdown parser", () => {
  it("parses paragraphs, bold labels, and unordered lists into renderable blocks", () => {
    expect(parseChatMarkdown("**Company:** Millat\n\n- Revenue grew\n- EPS improved")).toEqual([
      {
        type: "paragraph",
        children: [
          { type: "strong", text: "Company:" },
          { type: "text", text: " Millat" },
        ],
      },
      {
        type: "list",
        ordered: false,
        items: [[{ type: "text", text: "Revenue grew" }], [{ type: "text", text: "EPS improved" }]],
      },
    ]);
  });

  it("sanitizes unsupported link protocols", () => {
    expect(parseChatMarkdown("[bad](ftp://example.com)")).toEqual([
      {
        type: "paragraph",
        children: [{ type: "link", text: "bad", href: "#" }],
      },
    ]);
  });

  it("parses markdown tables into table blocks", () => {
    expect(
      parseChatMarkdown(
        "| Scenario | FY2026 | FY2027 |\n| --- | ---: | ---: |\n| Base | 10 | 11 |",
      ),
    ).toEqual([
      {
        type: "table",
        headers: ["Scenario", "FY2026", "FY2027"],
        rows: [["Base", "10", "11"]],
      },
    ]);
  });

  it("parses compact markdown headings emitted by Ask AI streams", () => {
    expect(parseChatMarkdown("##### Sheet: BS5 - Current Liabilities")).toEqual([
      {
        type: "heading",
        level: 5,
        children: [{ type: "text", text: "Sheet: BS5 - Current Liabilities" }],
      },
    ]);
  });

  it("parses numeric citation markers as inline citation nodes", () => {
    expect(parseChatMarkdown("Baseline uses PAT [1] and ADB [3].")).toEqual([
      {
        type: "paragraph",
        children: [
          { type: "text", text: "Baseline uses PAT " },
          { type: "citation", index: 1 },
          { type: "text", text: " and ADB " },
          { type: "citation", index: 3 },
          { type: "text", text: "." },
        ],
      },
    ]);
  });
});
