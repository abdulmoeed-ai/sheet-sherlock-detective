import type { ReactNode } from "react";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import { visit } from "unist-util-visit";
import type { Root, RootContent, Text } from "mdast";
import type { Plugin } from "unified";

const CITATION_NODE_TYPE = "askAiCitation";

type AskAiCitationNode = {
  type: typeof CITATION_NODE_TYPE;
  index: number;
  data: {
    hName: "span";
    hProperties: {
      dataAskAiCitation: string;
    };
  };
  children: Text[];
};

type MarkdownContentProps = {
  markdown: string;
  renderCitation?: (index: number) => ReactNode;
  size?: "default" | "expanded";
};

export function MarkdownContent({
  markdown,
  renderCitation,
  size = "default",
}: MarkdownContentProps) {
  return (
    <div
      className={`min-w-0 space-y-2 break-words leading-relaxed ${
        size === "expanded" ? "text-[14px]" : "text-[13px]"
      }`}
      style={{ color: "var(--color-text-primary)" }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkAskAiCitations]}
        urlTransform={defaultUrlTransform}
        components={{
          p: ({ children }) => <p className="whitespace-pre-wrap break-words">{children}</p>,
          h1: ({ children }) => (
            <h3 className="break-words font-semibold" style={{ color: "var(--color-text-primary)" }}>
              {children}
            </h3>
          ),
          h2: ({ children }) => (
            <h4 className="break-words font-semibold" style={{ color: "var(--color-text-primary)" }}>
              {children}
            </h4>
          ),
          h3: ({ children }) => (
            <h5 className="break-words font-semibold" style={{ color: "var(--color-text-primary)" }}>
              {children}
            </h5>
          ),
          h4: ({ children }) => (
            <h5 className="break-words font-semibold" style={{ color: "var(--color-text-primary)" }}>
              {children}
            </h5>
          ),
          h5: ({ children }) => (
            <h5 className="break-words font-semibold" style={{ color: "var(--color-text-primary)" }}>
              {children}
            </h5>
          ),
          h6: ({ children }) => (
            <h5 className="break-words font-semibold" style={{ color: "var(--color-text-primary)" }}>
              {children}
            </h5>
          ),
          ul: ({ children }) => (
            <ul className="min-w-0 list-disc space-y-1 break-words pl-4">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="min-w-0 list-decimal space-y-1 break-words pl-4">{children}</ol>
          ),
          li: ({ children }) => <li className="break-words">{children}</li>,
          table: ({ children }) => (
            <div
              className="min-w-0 overflow-x-auto rounded-lg border"
              style={{ borderColor: "var(--color-border-default)" }}
            >
              <table className="w-full min-w-[520px] border-collapse text-left text-[12px]">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => <thead>{children}</thead>,
          tbody: ({ children }) => <tbody>{children}</tbody>,
          tr: ({ children }) => <tr className="odd:bg-white even:bg-[#FAFBFF]">{children}</tr>,
          th: ({ children }) => (
            <th
              className="border-b px-3 py-2 font-semibold text-[var(--color-text-primary)]"
              style={{ borderColor: "var(--color-border-default)" }}
            >
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td
              className="border-b px-3 py-2 align-top text-[var(--color-text-secondary)] last:border-r-0"
              style={{ borderColor: "var(--color-border-default)" }}
            >
              {children}
            </td>
          ),
          code: ({ children, className }) => {
            const isBlock = typeof className === "string" && className.startsWith("language-");
            if (isBlock) {
              return (
                <code className={`${className} block overflow-x-auto whitespace-pre rounded-md bg-[var(--color-tag-bg)] p-3 text-[12px]`}>
                  {children}
                </code>
              );
            }
            return (
              <code className="rounded bg-[var(--color-tag-bg)] px-1 py-0.5 text-[12px]">
                {children}
              </code>
            );
          },
          pre: ({ children }) => <pre className="min-w-0 overflow-x-auto">{children}</pre>,
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noreferrer" className="font-medium underline">
              {children}
            </a>
          ),
          span: ({ children, node }) => {
            const citationIndex = Number.parseInt(
              String(node?.properties?.dataAskAiCitation ?? ""),
              10,
            );
            if (Number.isFinite(citationIndex)) {
              return renderCitation ? <>{renderCitation(citationIndex)}</> : <>{children}</>;
            }
            return <span>{children}</span>;
          },
          hr: () => (
            <hr className="my-2 border-0 border-t" style={{ borderColor: "var(--color-border-default)" }} />
          ),
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}

const remarkAskAiCitations: Plugin<[], Root> = () => (tree) => {
  visit(tree, "text", (node, index, parent) => {
    if (!parent || typeof index !== "number") return;

    const textNode = node as Text;
    const parts = splitCitationText(textNode.value);
    if (!parts) return;

    parent.children.splice(index, 1, ...(parts as RootContent[]));
  });
};

function splitCitationText(value: string): Array<Text | AskAiCitationNode> | null {
  const pattern = /\[(\d+)\]/g;
  const parts: Array<Text | AskAiCitationNode> = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(value)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", value: value.slice(lastIndex, match.index) });
    }
    const citationText = match[0];
    const citationIndex = Number.parseInt(match[1], 10);
    parts.push({
      type: CITATION_NODE_TYPE,
      index: citationIndex,
      data: {
        hName: "span",
        hProperties: { dataAskAiCitation: String(citationIndex) },
      },
      children: [{ type: "text", value: citationText }],
    });
    lastIndex = match.index + match[0].length;
  }

  if (parts.length === 0) return null;
  if (lastIndex < value.length) {
    parts.push({ type: "text", value: value.slice(lastIndex) });
  }
  return parts;
}
