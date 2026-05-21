import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { PageShell } from "@/components/PageShell";
import { cycleStore, useCycle } from "@/lib/cycle-store";
import {
  CloudUpload,
  FileText,
  Trash2,
  Check,
  Loader2,
  AlertTriangle,
  Minus,
  CheckCircle2,
} from "lucide-react";

export const Route = createFileRoute("/ingestion")({
  head: () => ({
    meta: [
      { title: "Ingestion — Sheet Sherlock" },
      { name: "description", content: "Upload PSX filings and ingest from 8 live data sources with OCR confidence scoring." },
    ],
  }),
  component: Ingestion,
});

const SOURCES: { name: string; status: "live" | "stale" | "down"; updated: string }[] = [
  { name: "PSX", status: "live", updated: "Updated 1h ago" },
  { name: "ADB", status: "live", updated: "Updated 6h ago" },
  { name: "Bloomberg", status: "live", updated: "Updated 30m ago" },
  { name: "SBP", status: "stale", updated: "Updated 3d ago — check schedule" },
  { name: "PBS", status: "live", updated: "Updated 1d ago" },
  { name: "WSJ", status: "live", updated: "Updated 4h ago" },
  { name: "APCMA", status: "live", updated: "Updated 2h ago" },
  { name: "NEPRA", status: "down", updated: "Unreachable — credential may have expired" },
];

type FeedRow = {
  name: string;
  state: "pending" | "running" | "done" | "skipped";
  cells?: number;
  duration?: string;
};

function Ingestion() {
  const navigate = useNavigate();
  const cycle = useCycle();
  const [file, setFile] = useState<File | null>(null);
  const [threshold, setThreshold] = useState(85);
  const [running, setRunning] = useState(false);
  const [feed, setFeed] = useState<FeedRow[]>([]);
  const [feedDone, setFeedDone] = useState(false);
  const [ocrResolved, setOcrResolved] = useState<Record<number, boolean>>({});

  const ocrIssues = [
    { field: "Revenue FY2025", value: "PKR 54.8B", conf: 87, page: 42, tone: "auto" as const },
    { field: "Total Assets", value: "PKR 112.4B", conf: 76, page: 71, tone: "confirm" as const },
    { field: "Net Profit", value: "PKR 8.2B", conf: 82, page: 58, tone: "confirm" as const },
    { field: "EBITDA", value: "PKR 12.9B", conf: 68, page: 64, tone: "edit" as const },
  ];
  const needsAction = ocrIssues.filter((o) => o.tone !== "auto");
  const allResolved =
    feedDone && needsAction.every((_, i) => ocrResolved[i + 1]); // auto row is index 0

  const startIngestion = () => {
    setRunning(true);
    const initial: FeedRow[] = SOURCES.map((s) => ({
      name: s.name,
      state: s.status === "down" ? "skipped" : "pending",
    }));
    setFeed(initial);

    let i = 0;
    const ordered = initial.map((r, idx) => ({ r, idx })).filter((x) => x.r.state !== "skipped");

    const tick = () => {
      if (i >= ordered.length) {
        setFeedDone(true);
        return;
      }
      const { idx } = ordered[i];
      setFeed((cur) => cur.map((r, j) => (j === idx ? { ...r, state: "running" } : r)));
      setTimeout(() => {
        setFeed((cur) =>
          cur.map((r, j) =>
            j === idx
              ? {
                  ...r,
                  state: "done",
                  cells: 100 + Math.floor(Math.random() * 400),
                  duration: `${(1 + Math.random() * 4).toFixed(1)}s`,
                }
              : r,
          ),
        );
        i++;
        setTimeout(tick, 250);
      }, 700);
    };
    tick();
  };

  const liveCount = SOURCES.filter((s) => s.status === "live").length;
  const staleCount = SOURCES.filter((s) => s.status === "stale").length;
  const downCount = SOURCES.filter((s) => s.status === "down").length;

  return (
    <PageShell
      title={`Ingestion — ${cycle.period} · ${cycle.company}`}
      subtitle="Upload source PDFs and trigger ingestion across 8 live data registries"
    >
      <div className="pb-24">
        {/* Upload zone */}
        <div className="mb-5 rounded-xl border bg-white p-6" style={{ borderColor: "var(--color-border-default)" }}>
          <div className="mb-4 text-[13px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
            Upload PSX Annual Report / Filing
          </div>

          {!file ? (
            <label
              className="block cursor-pointer rounded-[10px] px-6 py-9 text-center transition-colors"
              style={{
                border: "2px dashed var(--color-brand)",
                background: "transparent",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--color-tag-bg)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              <CloudUpload className="mx-auto h-7 w-7" style={{ color: "var(--color-text-muted)" }} />
              <div className="mt-3 text-[14px]">
                <span className="font-bold" style={{ color: "var(--color-brand)" }}>
                  Click to upload
                </span>{" "}
                <span style={{ color: "var(--color-text-secondary)" }}>or drag and drop</span>
              </div>
              <div className="mt-1 text-[12px]" style={{ color: "var(--color-text-muted)" }}>
                PDF, XLSX (max. 50MB)
              </div>
              <input
                type="file"
                className="hidden"
                accept=".pdf,.xlsx"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
          ) : (
            <div
              className="flex items-center gap-3 rounded-lg border px-4 py-3"
              style={{ borderColor: "var(--color-border-default)" }}
            >
              <FileText
                className="h-8 w-8 rounded-md p-1.5"
                style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)" }}
              />
              <div className="flex-1">
                <div className="text-[14px] font-medium" style={{ color: "var(--color-text-primary)" }}>
                  {file.name}
                </div>
                <div className="text-[12px]" style={{ color: "var(--color-text-muted)" }}>
                  {(file.size / (1024 * 1024)).toFixed(1)} MB · ready for OCR
                </div>
              </div>
              <button
                onClick={() => setFile(null)}
                className="rounded-md p-1.5 hover:bg-[var(--color-tag-bg)]"
              >
                <Trash2 className="h-4 w-4" style={{ color: "var(--color-text-muted)" }} />
              </button>
            </div>
          )}

          {file && (
            <div className="mt-4 flex items-center gap-3">
              <label className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>
                OCR confidence threshold:
              </label>
              <input
                type="range"
                min={70}
                max={99}
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="flex-1 max-w-[260px]"
                style={{ accentColor: "var(--color-brand)" }}
              />
              <span className="text-[13px] font-semibold tnum" style={{ color: "var(--color-brand)" }}>
                {threshold}%
              </span>
              <span className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>
                Fields below this score route to manual review
              </span>
            </div>
          )}
        </div>

        {/* Source registry OR live feed */}
        {!running ? (
          <SourceRegistry
            sources={SOURCES}
            liveCount={liveCount}
            staleCount={staleCount}
            downCount={downCount}
          />
        ) : (
          <LiveFeed
            feed={feed}
            feedDone={feedDone}
            ocrIssues={ocrIssues}
            ocrResolved={ocrResolved}
            setOcrResolved={setOcrResolved}
          />
        )}
      </div>

      {/* Sticky footer */}
      <StickyFooter
        running={running}
        file={file}
        feed={feed}
        feedDone={feedDone}
        allResolved={allResolved}
        liveCount={liveCount}
        staleCount={staleCount}
        downCount={downCount}
        onStart={startIngestion}
        onReviewDiffs={() => {
          cycleStore.setStatus("diff-review");
          navigate({ to: "/diff-review" });
        }}
      />
    </PageShell>
  );
}

function SourceRegistry({
  sources,
  liveCount,
  staleCount,
  downCount,
}: {
  sources: typeof SOURCES;
  liveCount: number;
  staleCount: number;
  downCount: number;
}) {
  return (
    <div className="rounded-xl border bg-white p-6" style={{ borderColor: "var(--color-border-default)" }}>
      <div className="mb-4 flex items-center justify-between">
        <div className="text-[13px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
          Live Data Sources
        </div>
        <span
          className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
          style={{ background: "var(--color-success-bg)", color: "var(--color-success-fg)" }}
        >
          8 sources
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {sources.map((s) => {
          const dot = s.status === "live" ? "#22C55E" : s.status === "stale" ? "#F59E0B" : "#EF4444";
          return (
            <div
              key={s.name}
              className="flex items-center gap-3 rounded-lg border bg-white px-3.5 py-3"
              style={{ borderColor: "var(--color-border-default)" }}
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: dot, boxShadow: `0 0 0 3px ${dot}22` }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium" style={{ color: "var(--color-text-primary)" }}>
                  {s.name}
                </div>
                <div className="text-[11px] truncate" style={{ color: "var(--color-text-muted)" }}>
                  {s.updated}
                </div>
              </div>
              {s.status === "live" ? (
                <Check className="h-3.5 w-3.5" style={{ color: dot }} />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5" style={{ color: dot }} />
              )}
            </div>
          );
        })}
      </div>

      {(staleCount > 0 || downCount > 0) && (
        <div
          className="mt-4 flex items-start gap-2 rounded-md px-3.5 py-2.5 text-[12px]"
          style={{
            background: "var(--color-warning-bg)",
            borderLeft: "4px solid var(--color-warning)",
            color: "var(--color-warning-fg)",
          }}
        >
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            {downCount} source unreachable and {staleCount} stale. Ingestion will proceed with{" "}
            {liveCount} available sources. Admin can update credentials in Settings.
          </span>
        </div>
      )}
    </div>
  );
}

function LiveFeed({
  feed,
  feedDone,
  ocrIssues,
  ocrResolved,
  setOcrResolved,
}: {
  feed: FeedRow[];
  feedDone: boolean;
  ocrIssues: { field: string; value: string; conf: number; page: number; tone: "auto" | "confirm" | "edit" }[];
  ocrResolved: Record<number, boolean>;
  setOcrResolved: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
}) {
  return (
    <div className="rounded-xl border bg-white p-6" style={{ borderColor: "var(--color-border-default)" }}>
      <div className="mb-3 text-[13px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
        Ingestion in progress
      </div>
      <div className="divide-y" style={{ borderColor: "var(--color-border-default)" }}>
        {feed.map((row) => (
          <div key={row.name} className="flex items-center gap-3 py-2.5" style={{ borderBottomColor: "#F3F4F6" }}>
            {row.state === "running" && (
              <Loader2 className="h-4 w-4 animate-spin" style={{ color: "var(--color-brand)" }} />
            )}
            {row.state === "done" && <Check className="h-4 w-4" style={{ color: "var(--color-success)" }} />}
            {row.state === "skipped" && <Minus className="h-4 w-4" style={{ color: "var(--color-text-muted)" }} />}
            {row.state === "pending" && <span className="h-4 w-4 rounded-full border" style={{ borderColor: "var(--color-border-strong)" }} />}
            <span className="text-[13px] font-medium" style={{ color: "var(--color-text-primary)" }}>
              {row.name}
            </span>
            <span className="text-[12px]" style={{ color: "var(--color-text-muted)" }}>
              {row.state === "running" && "Extracting data..."}
              {row.state === "done" && `${row.cells} cells extracted`}
              {row.state === "skipped" && "Source unavailable — skipped"}
              {row.state === "pending" && "Queued"}
            </span>
            <span className="ml-auto text-[11px]" style={{ color: "var(--color-text-muted)" }}>
              {row.state === "done" ? `done · ${row.duration}` : ""}
            </span>
          </div>
        ))}
      </div>

      {feedDone && (
        <div className="mt-6">
          <div className="mb-3 text-[13px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
            OCR Quality Review
          </div>
          <table className="w-full text-[13px]">
            <thead>
              <tr style={{ background: "var(--color-table-header)", color: "var(--color-text-muted)" }} className="text-left text-[11px] uppercase">
                <th className="px-3 py-2">Field</th>
                <th className="px-3 py-2">Extracted value</th>
                <th className="px-3 py-2">Confidence</th>
                <th className="px-3 py-2">Source page</th>
                <th className="px-3 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {ocrIssues.map((o, idx) => {
                const resolved = idx === 0 || ocrResolved[idx];
                const confBg = o.conf >= 85 ? "#E8F5E9" : o.conf >= 70 ? "#FFF8E1" : "#FFEBEE";
                const confFg = o.conf >= 85 ? "#2E7D32" : o.conf >= 70 ? "#B45309" : "#C62828";
                return (
                  <tr key={o.field} className="border-b" style={{ borderColor: "var(--color-border-default)", opacity: resolved ? 0.6 : 1 }}>
                    <td className="px-3 py-2.5">{o.field}</td>
                    <td className="px-3 py-2.5 font-semibold tnum">{o.value}</td>
                    <td className="px-3 py-2.5">
                      <span
                        className="rounded-md px-1.5 py-0.5 text-[11px] font-semibold"
                        style={{ background: confBg, color: confFg }}
                      >
                        {o.conf}%
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-[12px]" style={{ color: "var(--color-brand)" }}>
                      Page {o.page}
                    </td>
                    <td className="px-3 py-2.5">
                      {idx === 0 ? (
                        <span className="text-[11px]" style={{ color: "var(--color-success-fg)" }}>
                          ✓ auto-passed
                        </span>
                      ) : resolved ? (
                        <span className="text-[11px]" style={{ color: "var(--color-success-fg)" }}>
                          ✓ resolved
                        </span>
                      ) : (
                        <button
                          onClick={() => setOcrResolved((r) => ({ ...r, [idx]: true }))}
                          className="h-7 rounded-md px-2.5 text-[11px] font-semibold"
                          style={{
                            background: o.tone === "confirm" ? "var(--color-tag-bg)" : "var(--color-brand)",
                            color: o.tone === "confirm" ? "var(--color-accent-sparkle)" : "#fff",
                          }}
                        >
                          {o.tone === "confirm" ? "Confirm" : "Edit"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StickyFooter({
  running,
  file,
  feed,
  feedDone,
  allResolved,
  liveCount,
  staleCount,
  downCount,
  onStart,
  onReviewDiffs,
}: {
  running: boolean;
  file: File | null;
  feed: FeedRow[];
  feedDone: boolean;
  allResolved: boolean;
  liveCount: number;
  staleCount: number;
  downCount: number;
  onStart: () => void;
  onReviewDiffs: () => void;
}) {
  const doneCount = feed.filter((r) => r.state === "done").length;
  const totalCount = feed.filter((r) => r.state !== "skipped").length;
  const pct = totalCount > 0 ? (doneCount / totalCount) * 100 : 0;

  return (
    <div
      className="fixed bottom-0 left-[240px] right-0 z-20 flex h-16 items-center justify-between border-t bg-white px-8"
      style={{ borderColor: "var(--color-border-default)" }}
    >
      {!running ? (
        <>
          <div className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>
            {file ? "PDF uploaded · " : "No PDF uploaded · "}
            8 sources ready ({liveCount} live, {staleCount} stale, {downCount} error)
          </div>
          <button
            onClick={onStart}
            disabled={!file}
            className="h-10 rounded-lg px-5 text-[13px] font-semibold text-white transition-opacity disabled:opacity-50"
            style={{ background: "var(--color-brand)" }}
          >
            Start ingestion →
          </button>
        </>
      ) : (
        <>
          <div className="flex flex-1 items-center gap-4 pr-6">
            <div className="flex-1 max-w-md">
              <div
                className="h-1 w-full overflow-hidden rounded-full"
                style={{ background: "var(--color-border-default)" }}
              >
                <div className="h-full transition-all" style={{ width: `${pct}%`, background: "var(--color-brand)" }} />
              </div>
            </div>
            <div className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>
              {feedDone
                ? `Ingestion complete · ${allResolved ? "all clear" : "3 items need manual review"}`
                : `Ingesting… ${doneCount} of ${totalCount}`}
            </div>
          </div>
          <button
            onClick={onReviewDiffs}
            disabled={!allResolved}
            className="h-10 rounded-lg px-5 text-[13px] font-semibold text-white transition-opacity disabled:opacity-50"
            style={{ background: "var(--color-brand)" }}
          >
            Review diffs →
          </button>
        </>
      )}
    </div>
  );
}
