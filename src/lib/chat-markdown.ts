export type ChatMarkdownInline =
  | { type: "text"; text: string }
  | { type: "strong"; text: string }
  | { type: "em"; text: string }
  | { type: "code"; text: string }
  | { type: "link"; text: string; href: string }
  | { type: "citation"; index: number };

export type ChatMarkdownBlock =
  | { type: "paragraph"; children: ChatMarkdownInline[] }
  | { type: "heading"; level: 1 | 2 | 3 | 4 | 5 | 6; children: ChatMarkdownInline[] }
  | { type: "list"; ordered: boolean; items: ChatMarkdownInline[][] }
  | { type: "table"; headers: string[]; rows: string[][] };

export function parseChatMarkdown(markdown: string): ChatMarkdownBlock[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: ChatMarkdownBlock[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: ChatMarkdownInline[][] } | null = null;
  let table: { headers: string[]; rows: string[][] } | null = null;

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
  const flushTable = () => {
    if (table === null) return;
    blocks.push({ type: "table", headers: table.headers, rows: table.rows });
    table = null;
  };

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const rawLine = lines[lineIndex];
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      flushParagraph();
      flushList();
      flushTable();
      continue;
    }

    const nextLine = lines[lineIndex + 1]?.trimEnd();
    if (isTableHeader(line, nextLine)) {
      flushParagraph();
      flushList();
      flushTable();
      table = { headers: parseTableRow(line), rows: [] };
      lineIndex += 1;
      continue;
    }

    if (table && isTableRow(line)) {
      table.rows.push(parseTableRow(line));
      continue;
    }

    flushTable();

    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({
        type: "heading",
        level: heading[1].length as 1 | 2 | 3 | 4 | 5 | 6,
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
  flushTable();
  return blocks;
}

function parseInline(value: string): ChatMarkdownInline[] {
  const nodes: ChatMarkdownInline[] = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\)|\[\d+\]|\*[^*]+\*)/g;
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
  if (/^\[\d+\]$/.test(token)) {
    return { type: "citation", index: Number.parseInt(token.slice(1, -1), 10) };
  }
  if (token.startsWith("*") && token.endsWith("*")) {
    return { type: "em", text: token.slice(1, -1) };
  }
  return { type: "text", text: token };
}

function isSafeHref(href: string): boolean {
  return /^(https?:|mailto:)/i.test(href);
}

function isTableHeader(line: string, nextLine: string | undefined): boolean {
  return isTableRow(line) && typeof nextLine === "string" && /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(nextLine);
}

function isTableRow(line: string): boolean {
  return line.includes("|") && parseTableRow(line).length >= 2;
}

function parseTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}
