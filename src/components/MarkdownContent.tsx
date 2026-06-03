import type { ReactNode } from "react";
import { parseChatMarkdown, type ChatMarkdownInline } from "@/lib/chat-markdown";

export function MarkdownContent({
  markdown,
  renderCitation,
}: {
  markdown: string;
  renderCitation?: (index: number) => ReactNode;
}) {
  const blocks = parseChatMarkdown(markdown);
  return (
    <div
      className="min-w-0 space-y-2 break-words text-[13px] leading-relaxed"
      style={{ color: "var(--color-text-primary)" }}
    >
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          const HeadingTag = block.level === 1 ? "h3" : block.level === 2 ? "h4" : "h5";
          return (
            <HeadingTag
              key={index}
              className="break-words font-semibold"
              style={{ color: "var(--color-text-primary)" }}
            >
              {renderInline(block.children, renderCitation)}
            </HeadingTag>
          );
        }
        if (block.type === "list") {
          const ListTag = block.ordered ? "ol" : "ul";
          return (
            <ListTag
              key={index}
              className={`min-w-0 space-y-1 break-words pl-4 ${block.ordered ? "list-decimal" : "list-disc"}`}
            >
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex} className="break-words">
                  {renderInline(item, renderCitation)}
                </li>
              ))}
            </ListTag>
          );
        }
        if (block.type === "table") {
          return (
            <div key={index} className="min-w-0 overflow-x-auto rounded-lg border" style={{ borderColor: "var(--color-border-default)" }}>
              <table className="w-full min-w-[520px] border-collapse text-left text-[12px]">
                <thead>
                  <tr className="bg-[var(--color-table-header)]">
                    {block.headers.map((header) => (
                      <th key={header} className="border-b px-3 py-2 font-semibold text-[var(--color-text-primary)]" style={{ borderColor: "var(--color-border-default)" }}>
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, rowIndex) => (
                    <tr key={rowIndex} className="odd:bg-white even:bg-[#FAFBFF]">
                      {row.map((cell, cellIndex) => (
                        <td key={`${rowIndex}-${cellIndex}`} className="border-b px-3 py-2 align-top text-[var(--color-text-secondary)] last:border-r-0" style={{ borderColor: "var(--color-border-default)" }}>
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        return (
          <p key={index} className="whitespace-pre-wrap break-words">
            {renderInline(block.children, renderCitation)}
          </p>
        );
      })}
    </div>
  );
}

function renderInline(nodes: ChatMarkdownInline[], renderCitation?: (index: number) => React.ReactNode) {
  return nodes.map((node, index) => {
    if (node.type === "strong") return <strong key={index}>{node.text}</strong>;
    if (node.type === "em") return <em key={index}>{node.text}</em>;
    if (node.type === "code") {
      return (
        <code key={index} className="rounded bg-[var(--color-tag-bg)] px-1 py-0.5 text-[12px]">
          {node.text}
        </code>
      );
    }
    if (node.type === "link") {
      return (
        <a
          key={index}
          href={node.href}
          target="_blank"
          rel="noreferrer"
          className="font-medium underline"
        >
          {node.text}
        </a>
      );
    }
    if (node.type === "citation") {
      return renderCitation ? (
        <span key={index}>{renderCitation(node.index)}</span>
      ) : (
        <span key={index}>[{node.index}]</span>
      );
    }
    return <span key={index}>{node.text}</span>;
  });
}
