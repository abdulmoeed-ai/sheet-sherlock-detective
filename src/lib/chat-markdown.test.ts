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
});
