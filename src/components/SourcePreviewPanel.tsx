import { ExternalLink, X } from "lucide-react";

export interface SourceRef {
  doc: string;
  page: number;
  field: string;
  value: string;
  conf: number;
  /** bounding box in % of page image: [x, y, w, h] */
  bbox?: [number, number, number, number];
}

export function SourceChip({
  source,
  onClick,
}: {
  source: SourceRef;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium hover:bg-[var(--color-tag-bg)]"
      style={{ borderColor: "var(--color-border-default)", color: "var(--color-brand)" }}
      title="Preview source page"
    >
      {source.doc} · p.{source.page}
    </button>
  );
}

function tierColor(conf: number) {
  if (conf >= 90) return { stroke: "#22C55E", bg: "rgba(34,197,94,0.12)", label: "#16A34A" };
  if (conf >= 70) return { stroke: "#F59E0B", bg: "rgba(245,158,11,0.14)", label: "#B45309" };
  return { stroke: "#EF4444", bg: "rgba(239,68,68,0.14)", label: "#C62828" };
}

/**
 * Renders a synthetic PDF-page preview with a coloured bounding box around
 * the field. No real PDFs are loaded — this is a fidelity mock that mimics
 * page paper, line-fill text and the highlight overlay.
 */
export function SourcePreview({
  source,
  compact = false,
  onClose,
}: {
  source: SourceRef;
  compact?: boolean;
  onClose?: () => void;
}) {
  const tc = tierColor(source.conf);
  const bbox = source.bbox ?? [22, 48, 56, 6];
  const height = compact ? 180 : 520;

  return (
    <div
      className="overflow-hidden rounded-lg border bg-white"
      style={{ borderColor: "var(--color-border-default)" }}
    >
      <div
        className="flex items-center justify-between border-b px-3 py-2"
        style={{ borderColor: "var(--color-border-default)", background: "var(--color-table-header)" }}
      >
        <div className="min-w-0">
          <div className="truncate text-[11px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
            {source.doc}
          </div>
          <div className="truncate text-[10px]" style={{ color: "var(--color-text-muted)" }}>
            Page {source.page} · {source.field} · {source.conf}% confidence
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <a
            href="#"
            className="rounded p-1 hover:bg-white"
            title="Open full page in new tab"
            onClick={(e) => e.preventDefault()}
          >
            <ExternalLink className="h-3.5 w-3.5" style={{ color: "var(--color-text-muted)" }} />
          </a>
          {onClose && (
            <button onClick={onClose} className="rounded p-1 hover:bg-white">
              <X className="h-3.5 w-3.5" style={{ color: "var(--color-text-muted)" }} />
            </button>
          )}
        </div>
      </div>

      <div className="relative" style={{ height, background: "#FAFAF7" }}>
        {/* synthetic page lines */}
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
        >
          {Array.from({ length: 28 }).map((_, i) => {
            const y = 6 + i * 3.2;
            const w = 60 + ((i * 7) % 30);
            return (
              <rect
                key={i}
                x={6}
                y={y}
                width={w}
                height={1.2}
                fill="#D8D5CC"
                opacity={0.55}
              />
            );
          })}
          {/* table-ish row right before bbox */}
          <rect x={6} y={bbox[1] - 4} width={88} height={0.6} fill="#A8A496" />
          <rect x={6} y={bbox[1] + bbox[3] + 2} width={88} height={0.6} fill="#A8A496" />

          {/* highlight bbox */}
          <rect
            x={bbox[0]}
            y={bbox[1]}
            width={bbox[2]}
            height={bbox[3]}
            fill={tc.bg}
            stroke={tc.stroke}
            strokeWidth={0.4}
          />
        </svg>

        {/* label callout */}
        <div
          className="absolute rounded px-1.5 py-0.5 text-[10px] font-semibold shadow-sm"
          style={{
            left: `${bbox[0]}%`,
            top: `calc(${bbox[1]}% - 18px)`,
            background: tc.stroke,
            color: "#fff",
          }}
        >
          {source.field} · {source.value} · {source.conf}%
        </div>
      </div>
    </div>
  );
}
