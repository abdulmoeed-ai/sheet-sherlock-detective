import { describe, expect, it } from "bun:test";
import { parseChatMarkdown } from "../src/lib/chat-markdown";

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
});
