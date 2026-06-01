export type ChatMarkdownInline =
  | { type: "text"; text: string }
  | { type: "strong"; text: string }
  | { type: "em"; text: string }
  | { type: "code"; text: string }
  | { type: "link"; text: string; href: string };

export type ChatMarkdownBlock =
  | { type: "paragraph"; children: ChatMarkdownInline[] }
  | { type: "heading"; level: 1 | 2 | 3; children: ChatMarkdownInline[] }
  | { type: "list"; ordered: boolean; items: ChatMarkdownInline[][] };

export function parseChatMarkdown(markdown: string): ChatMarkdownBlock[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: ChatMarkdownBlock[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: ChatMarkdownInline[][] } | null = null;

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    blocks.push({ type: "paragraph", children: parseInline(paragraph.join("\n")) });
    paragraph = [];
  };
  const flushList = () => {
    if (list === null) return;
    blocks.push({ type: "list", ordered: list.ordered, items: list.items });
    list = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({
        type: "heading",
        level: heading[1].length as 1 | 2 | 3,
        children: parseInline(heading[2]),
      });
      continue;
    }

    const unordered = /^\s*[-*]\s+(.+)$/.exec(line);
    const ordered = /^\s*\d+[.)]\s+(.+)$/.exec(line);
    if (unordered || ordered) {
      flushParagraph();
      const orderedList = Boolean(ordered);
      if (list && list.ordered !== orderedList) {
        flushList();
      }
      list = list ?? { ordered: orderedList, items: [] };
      list.items.push(parseInline((unordered ?? ordered)![1]));
      continue;
    }

    flushList();
    paragraph.push(line);
  }

  flushParagraph();
  flushList();
  return blocks;
}

function parseInline(value: string): ChatMarkdownInline[] {
  const nodes: ChatMarkdownInline[] = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\)|\*[^*]+\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(value)) !== null) {
    if (match.index > lastIndex) {
      nodes.push({ type: "text", text: value.slice(lastIndex, match.index) });
    }
    nodes.push(parseInlineToken(match[0]));
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < value.length) {
    nodes.push({ type: "text", text: value.slice(lastIndex) });
  }

  return nodes.length ? nodes : [{ type: "text", text: "" }];
}

function parseInlineToken(token: string): ChatMarkdownInline {
  if (token.startsWith("**") && token.endsWith("**")) {
    return { type: "strong", text: token.slice(2, -2) };
  }
  if (token.startsWith("`") && token.endsWith("`")) {
    return { type: "code", text: token.slice(1, -1) };
  }
  if (token.startsWith("[") && token.includes("](") && token.endsWith(")")) {
    const closeLabel = token.indexOf("](");
    const href = token.slice(closeLabel + 2, -1).trim();
    return {
      type: "link",
      text: token.slice(1, closeLabel),
      href: isSafeHref(href) ? href : "#",
    };
  }
  if (token.startsWith("*") && token.endsWith("*")) {
    return { type: "em", text: token.slice(1, -1) };
  }
  return { type: "text", text: token };
}

function isSafeHref(href: string): boolean {
  return /^(https?:|mailto:)/i.test(href);
}
