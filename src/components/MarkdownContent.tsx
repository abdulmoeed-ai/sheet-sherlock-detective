import { parseChatMarkdown, type ChatMarkdownInline } from "@/lib/chat-markdown";

export function MarkdownContent({ markdown }: { markdown: string }) {
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
              {renderInline(block.children)}
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
                  {renderInline(item)}
                </li>
              ))}
            </ListTag>
          );
        }
        return (
          <p key={index} className="whitespace-pre-wrap break-words">
            {renderInline(block.children)}
          </p>
        );
      })}
    </div>
  );
}

function renderInline(nodes: ChatMarkdownInline[]) {
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
    return <span key={index}>{node.text}</span>;
  });
}
