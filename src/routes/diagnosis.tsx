import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Download,
  History,
  Loader2,
  MessageSquare,
  PanelRightClose,
  PanelRightOpen,
  Save,
  Stethoscope,
  X,
} from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { queryKeys } from "@/lib/api/query-keys";
import { listComments } from "@/lib/api/projects";
import type { ReviewCommentResponse } from "@/lib/api/types";
import { useWorkspace } from "@/hooks/use-projects";
import {
  useCreateComment,
  useCreateExcelExport,
  useDownloadExcelExport,
  useReviewCell,
} from "@/hooks/use-project-actions";
import { useSelectedProjectId } from "@/lib/project-store";
import { cycleStore, useCycle } from "@/lib/cycle-store";
import { toast } from "sonner";

export const Route = createFileRoute("/diagnosis")({
  head: () => ({
    meta: [
      { title: "Diagnosis - Sheet Sherlock" },
      { name: "description", content: "Workbook-style cell diagnosis for Millat extraction review." },
    ],
  }),
  component: Diagnosis,
});

type CellPayload = {
  v?: unknown;
  f?: string;
  diagnosis?: DiagnosisMeta;
};

type SheetPayload = {
  id?: string;
  name: string;
  rowCount?: number;
  columnCount?: number;
  cellData?: Record<string, Record<string, CellPayload>>;
};

type WorkbookPayload = {
  workbookName?: string;
  templateName?: string;
  templatePath?: string;
  sheetOrder?: string[];
  sheets?: Record<string, SheetPayload>;
  summary?: Record<string, number>;
};

type DiagnosisMeta = {
  sheetName?: string;
  address?: string;
  value?: string;
  formula?: boolean;
  editable?: boolean;
  fieldId?: string;
  label?: string;
  period?: string;
  noteReference?: string | null;
  sourceDocumentId?: string | null;
  documentFilename?: string | null;
  pdfPageIndex?: number | null;
  printedPageNumber?: number | null;
  sourceText?: string | null;
  confidence?: number | null;
  status?: string;
  ruleIds?: string[];
  warnings?: string[];
  history?: Array<Record<string, unknown>>;
  commentsSummary?: { total?: number; open?: number; comments?: ReviewCommentResponse[] };
  diagnosisCandidates?: Array<Record<string, unknown>>;
  templateCell?: string;
};

type Selection = { sheetId: string; row: number; col: number };

const MAX_VISIBLE_ROWS = 90;
const MAX_VISIBLE_COLS = 14;

function Diagnosis() {
  const navigate = useNavigate();
  const cycle = useCycle();
  const projectId = useSelectedProjectId();
  const workspace = useWorkspace(projectId);
  const reviewCell = useReviewCell(projectId ?? "__no_project__");
  const createComment = useCreateComment(projectId ?? "__no_project__");
  const createExport = useCreateExcelExport(projectId ?? "__no_project__");
  const downloadExport = useDownloadExcelExport(projectId ?? "__no_project__");
  const comments = useQuery({
    queryKey: projectId ? queryKeys.comments(projectId) : ["projects", "none", "comments"],
    queryFn: () => listComments(projectId as string),
    enabled: !!projectId,
  });

  const workbook = workbookPayload(workspace.data?.diagnosisWorkbook ?? workspace.data?.exportPreview);
  const sheetIds = workbook?.sheetOrder?.filter((id) => workbook.sheets?.[id]) ?? [];
  const [activeSheetId, setActiveSheetId] = useState<string | null>(null);
  const resolvedActiveSheetId = activeSheetId && sheetIds.includes(activeSheetId) ? activeSheetId : sheetIds[0];
  const activeSheet = resolvedActiveSheetId ? workbook?.sheets?.[resolvedActiveSheetId] : undefined;
  const [selection, setSelection] = useState<Selection | null>(null);
  const resolvedSelection = resolveSelection(selection, resolvedActiveSheetId, activeSheet);
  const selectedCell = activeSheet ? getCell(activeSheet, resolvedSelection.row, resolvedSelection.col) : undefined;
  const selectedMeta = selectedCell?.diagnosis;
  const selectedAddress = `${activeSheet?.name ?? "Sheet"}!${columnName(resolvedSelection.col)}${resolvedSelection.row + 1}`;
  const [panelOpen, setPanelOpen] = useState(true);
  const [panelTab, setPanelTab] = useState<"diagnosis" | "comments">("diagnosis");
  const [draftValue, setDraftValue] = useState("");
  const [commentText, setCommentText] = useState("");

  const sheetComments = useMemo(
    () => filterComments(comments.data ?? [], selectedMeta, activeSheet?.name, selectedAddress),
    [comments.data, selectedMeta, activeSheet?.name, selectedAddress],
  );
  const dirty = draftValue.trim() !== "" || commentText.trim() !== "";
  const visibleShape = useMemo(() => sheetShape(activeSheet), [activeSheet]);

  const saveDraft = async () => {
    if (!projectId) return;
    try {
      if (draftValue.trim() && selectedMeta?.fieldId) {
        await reviewCell.mutateAsync({
          fieldId: selectedMeta.fieldId,
          input: { action: "edit", value: draftValue.trim(), note: "Saved from Diagnosis draft." },
        });
      }
      if (commentText.trim()) {
        await createComment.mutateAsync({
          body: commentText.trim(),
          fieldId: selectedMeta?.fieldId ?? null,
          templateCell: selectedMeta?.templateCell ?? selectedAddress,
          sheetName: activeSheet?.name ?? null,
        });
        setCommentText("");
      }
      setDraftValue("");
      await workspace.refetch();
      await comments.refetch();
      toast.success("Draft saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save draft");
    }
  };

  const exportWorkbook = async () => {
    if (!projectId) return;
    try {
      const created = await createExport.mutateAsync();
      const blob = await downloadExport.mutateAsync(created.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${cycle.company.replace(/\s+/g, "_")}_${cycle.period}_Millat_Diagnosis.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Excel export created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed");
    }
  };

  const markReady = () => {
    cycleStore.setStatus("review");
    toast.success("Diagnosis marked ready for review");
    navigate({ to: "/review" });
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#F7F8FA" }}>
      <Sidebar />
      <div
        className="grid h-screen min-w-0 flex-1"
        style={{
          gridTemplateRows: "48px 46px 1fr",
          gridTemplateColumns: panelOpen ? "1fr 380px" : "1fr 0px",
        }}
      >
        <div className="col-span-2 flex items-center gap-3 overflow-x-auto border-b bg-white px-4">
          <button
            onClick={() => navigate({ to: "/ingestion" })}
            className="flex h-7 w-7 items-center justify-center rounded hover:bg-[#F7F8FA]"
            title="Back to ingestion"
          >
            <ArrowLeft className="h-4 w-4 text-[#818EA0]" />
          </button>
          <div className="text-[12px] font-semibold" style={{ color: "#292D34" }}>
            {workspace.data?.project.companyName ?? cycle.company} / {workspace.data?.project.fiscalYear ?? cycle.period} / Diagnosis
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setPanelOpen((open) => !open)}
              className="flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-[11px] font-semibold"
              style={{ borderColor: "#E3E6EA", color: "#4F546B" }}
            >
              {panelOpen ? <PanelRightClose className="h-3.5 w-3.5" /> : <PanelRightOpen className="h-3.5 w-3.5" />}
              {panelOpen ? "Hide panel" : "Show panel"}
            </button>
            <button
              onClick={exportWorkbook}
              disabled={!projectId || createExport.isPending || downloadExport.isPending}
              className="flex h-7 items-center gap-1.5 rounded-md border px-3 text-[12px] font-semibold disabled:opacity-50"
              style={{ borderColor: "#E3E6EA", color: "#4F546B", background: "#fff" }}
            >
              {createExport.isPending || downloadExport.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              Export to Excel
            </button>
            <button
              onClick={saveDraft}
              disabled={!projectId || !dirty || reviewCell.isPending || createComment.isPending}
              className="flex h-7 items-center gap-1.5 rounded-md border px-3 text-[12px] font-semibold disabled:opacity-50"
              style={{ borderColor: "#E3E6EA", color: "#4F546B", background: "#fff" }}
            >
              {reviewCell.isPending || createComment.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save draft
            </button>
            <button
              onClick={markReady}
              className="h-7 rounded-md px-3.5 text-[12px] font-semibold text-white"
              style={{ background: "#7B68EE" }}
            >
              Mark ready
            </button>
          </div>
        </div>

        <div
          className="col-span-2 flex items-end gap-1 overflow-x-auto border-b px-4 pt-2"
          style={{
            background: "#F8FAFC",
            borderColor: "#D8DEE8",
            boxShadow: "0 1px 0 rgba(15, 23, 42, 0.06)",
            scrollbarWidth: "thin",
          }}
        >
          {sheetIds.map((sheetId) => {
            const sheet = workbook?.sheets?.[sheetId];
            const active = sheetId === resolvedActiveSheetId;
            return (
              <button
                key={sheetId}
                onClick={() => {
                  setActiveSheetId(sheetId);
                  setSelection({ sheetId, row: 0, col: 0 });
                  setDraftValue("");
                }}
                className="flex h-9 items-center whitespace-nowrap rounded-t-md border px-3 text-[12px] transition-colors"
                style={{
                  background: active ? "#FFFFFF" : "#EEF2F7",
                  borderColor: active ? "#C9D3E3" : "#E0E6EF",
                  borderBottomColor: active ? "#FFFFFF" : "#D8DEE8",
                  color: active ? "#111827" : "#516176",
                  fontWeight: active ? 700 : 600,
                  boxShadow: active ? "0 -1px 0 #7B68EE inset" : "none",
                }}
              >
                {sheet?.name ?? sheetId}
              </button>
            );
          })}
        </div>

        <main className="min-h-0 overflow-auto" style={{ gridRow: 3, gridColumn: 1 }}>
          {!projectId ? (
            <EmptyState title="No project selected" detail="Select a project from the workspace first." />
          ) : workspace.isLoading ? (
            <EmptyState title="Loading workbook" detail="Fetching the latest Millat diagnosis workbook." loading />
          ) : workspace.isError ? (
            <EmptyState title="Unable to load diagnosis" detail={workspace.error instanceof Error ? workspace.error.message : "Workspace request failed."} />
          ) : !activeSheet ? (
            <EmptyState title="No workbook data" detail="Run extraction after acknowledging the Data Mapping Rules." />
          ) : (
            <WorkbookGrid
              sheet={activeSheet}
              rows={visibleShape.rows}
              cols={visibleShape.cols}
              selected={resolvedSelection}
              draftValue={draftValue}
              onDraftValue={setDraftValue}
              onSelect={(row, col) => {
                setSelection({ sheetId: resolvedActiveSheetId as string, row, col });
                setDraftValue("");
              }}
              onOpenPanel={() => setPanelOpen(true)}
            />
          )}
        </main>

        {panelOpen && (
          <aside className="flex min-h-0 flex-col overflow-hidden border-l bg-white" style={{ gridRow: 3, gridColumn: 2, borderColor: "#E3E6EA" }}>
            <div className="flex h-12 items-center justify-between border-b px-4" style={{ borderColor: "#E3E6EA" }}>
              <div className="flex rounded-md p-0.5" style={{ background: "#F7F8FA" }}>
                {(["diagnosis", "comments"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setPanelTab(tab)}
                    className="h-7 rounded-md px-3 text-[12px] font-semibold capitalize"
                    style={{ background: panelTab === tab ? "#7B68EE" : "transparent", color: panelTab === tab ? "#fff" : "#818EA0" }}
                  >
                    {tab}
                  </button>
                ))}
              </div>
              <button onClick={() => setPanelOpen(false)} className="rounded p-1 hover:bg-[#F7F8FA]">
                <X className="h-4 w-4 text-[#818EA0]" />
              </button>
            </div>
            {panelTab === "diagnosis" ? (
              <DiagnosisPanel address={selectedAddress} meta={selectedMeta} cell={selectedCell} />
            ) : (
              <CommentsPanel
                comments={sheetComments}
                text={commentText}
                onText={setCommentText}
                target={selectedMeta?.fieldId ? selectedMeta.label ?? selectedAddress : selectedAddress}
              />
            )}
          </aside>
        )}
      </div>
    </div>
  );
}

function WorkbookGrid({
  sheet,
  rows,
  cols,
  selected,
  draftValue,
  onDraftValue,
  onSelect,
  onOpenPanel,
}: {
  sheet: SheetPayload;
  rows: number;
  cols: number;
  selected: { row: number; col: number };
  draftValue: string;
  onDraftValue: (value: string) => void;
  onSelect: (row: number, col: number) => void;
  onOpenPanel: () => void;
}) {
  return (
    <div className="p-4">
      <table className="border-collapse bg-white text-[12px]" style={{ boxShadow: "0 1px 2px rgba(15,23,42,0.08)" }}>
        <thead>
          <tr>
            <th className="sticky left-0 top-0 z-20 h-7 w-10 border bg-[#F7F8FA]" style={{ borderColor: "#E3E6EA" }} />
            {Array.from({ length: cols }, (_, col) => (
              <th key={col} className="sticky top-0 z-10 h-7 min-w-[108px] border bg-[#F7F8FA] px-2 font-semibold" style={{ borderColor: "#E3E6EA", color: "#818EA0" }}>
                {columnName(col)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, row) => (
            <tr key={row}>
              <th className="sticky left-0 z-10 h-8 border bg-[#F7F8FA] px-2 text-right font-medium" style={{ borderColor: "#E3E6EA", color: "#818EA0" }}>
                {row + 1}
              </th>
              {Array.from({ length: cols }, (_, col) => {
                const cell = getCell(sheet, row, col);
                const active = selected.row === row && selected.col === col;
                const hasDiagnosis = !!cell?.diagnosis;
                const formula = !!cell?.f;
                const editable = hasDiagnosis && cell?.diagnosis?.editable !== false && !formula;
                const value = active && draftValue ? draftValue : displayValue(cell);
                return (
                  <td
                    key={col}
                    onClick={() => onSelect(row, col)}
                    onDoubleClick={() => {
                      onSelect(row, col);
                      onOpenPanel();
                    }}
                    className="relative h-8 max-w-[220px] truncate border px-2"
                    style={{
                      borderColor: "#E3E6EA",
                      outline: active ? "2px solid #7B68EE" : undefined,
                      outlineOffset: -1,
                      background: active ? "#F5F3FF" : hasDiagnosis ? "#F8FBFF" : "#fff",
                      color: formula ? "#292D34" : hasDiagnosis ? "#1D4ED8" : "#4F546B",
                      textAlign: typeof cell?.v === "number" ? "right" : "left",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {formula && <span className="absolute left-1 top-1 text-[8px] text-[#A0A8B8]">f</span>}
                    {hasDiagnosis && <span className="absolute right-0 top-0 h-0 w-0 border-l-[7px] border-t-[7px] border-l-transparent border-t-[#7B68EE]" />}
                    {active && editable ? (
                      <input
                        value={value}
                        onChange={(event) => onDraftValue(event.target.value)}
                        className="absolute inset-0 bg-white px-2 text-right outline-none"
                        style={{ border: "1px solid #7B68EE", color: "#292D34" }}
                      />
                    ) : (
                      value
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DiagnosisPanel({ address, meta, cell }: { address: string; meta?: DiagnosisMeta; cell?: CellPayload }) {
  if (!cell) {
    return <PanelEmpty icon={Stethoscope} title={address} detail="Select a populated workbook cell." />;
  }
  if (!meta) {
    return (
      <div className="flex-1 overflow-y-auto p-4">
        <h2 className="text-[13px] font-bold" style={{ color: "#292D34" }}>{address}</h2>
        <KV label="Value" value={displayValue(cell) || "-"} />
        <KV label="Formula" value={cell.f ? `=${cell.f}` : "No"} />
      </div>
    );
  }
  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="mb-4">
        <div className="text-[12px] font-bold" style={{ color: "#292D34" }}>{address}</div>
        <div className="mt-1 text-[13px]" style={{ color: "#4F546B" }}>{meta.label ?? "Mapped cell"}</div>
      </div>
      <section className="space-y-2 rounded-lg border p-3" style={{ borderColor: "#E3E6EA" }}>
        <KV label="Extracted value" value={meta.value ?? displayValue(cell) ?? "-"} />
        <KV label="Status" value={meta.status ?? "-"} />
        <KV label="Confidence" value={meta.confidence === null || meta.confidence === undefined ? "-" : `${meta.confidence}%`} />
        <KV label="Note" value={meta.noteReference ?? "-"} />
        <KV label="Source" value={meta.documentFilename ?? "-"} />
        <KV label="Page" value={meta.printedPageNumber ? String(meta.printedPageNumber) : "-"} />
      </section>
      <section className="mt-3 rounded-lg border p-3" style={{ borderColor: "#E3E6EA" }}>
        <div className="mb-2 text-[11px] font-semibold uppercase" style={{ color: "#818EA0" }}>Rules</div>
        <div className="flex flex-wrap gap-1.5">
          {(meta.ruleIds ?? []).length ? meta.ruleIds?.map((rule) => (
            <span key={rule} className="rounded bg-[#EDE9FE] px-2 py-1 text-[11px] font-semibold" style={{ color: "#7B68EE" }}>{rule}</span>
          )) : <span className="text-[12px]" style={{ color: "#818EA0" }}>No rule IDs recorded</span>}
        </div>
        {!!meta.warnings?.length && (
          <div className="mt-3 space-y-1">
            {meta.warnings.map((warning) => (
              <div key={warning} className="rounded bg-[#FFF7ED] px-2 py-1 text-[12px]" style={{ color: "#B45309" }}>{warning}</div>
            ))}
          </div>
        )}
      </section>
      <section className="mt-3 rounded-lg border p-3" style={{ borderColor: "#E3E6EA" }}>
        <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase" style={{ color: "#818EA0" }}>
          <History className="h-3.5 w-3.5" /> History
        </div>
        {(meta.history ?? []).slice(0, 6).map((entry, index) => (
          <div key={index} className="border-t py-2 text-[12px]" style={{ borderColor: "#F3F4F6", color: "#4F546B" }}>
            <span className="font-semibold">{stringValue(entry.action, "source")}</span>{" "}
            <span>{stringValue(entry.value ?? entry.newValue, "")}</span>
          </div>
        ))}
      </section>
      {!!meta.diagnosisCandidates?.length && (
        <section className="mt-3 rounded-lg border p-3" style={{ borderColor: "#FECACA", background: "#FFF5F5" }}>
          <div className="mb-2 text-[11px] font-semibold uppercase" style={{ color: "#EF4444" }}>Diagnosis candidates</div>
          {meta.diagnosisCandidates.map((candidate, index) => (
            <div key={index} className="text-[12px]" style={{ color: "#4F546B" }}>
              {stringValue(candidate.reason, "Review candidate")}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

function CommentsPanel({
  comments,
  text,
  onText,
  target,
}: {
  comments: ReviewCommentResponse[];
  text: string;
  onText: (value: string) => void;
  target: string;
}) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="border-b p-4" style={{ borderColor: "#E3E6EA" }}>
        <div className="mb-2 text-[12px] font-bold" style={{ color: "#292D34" }}>{target}</div>
        <textarea
          value={text}
          onChange={(event) => onText(event.target.value)}
          rows={4}
          className="w-full resize-none rounded-lg border p-2 text-[13px] outline-none"
          style={{ borderColor: "#E3E6EA", color: "#292D34" }}
          placeholder="Add a review comment"
        />
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {comments.length === 0 ? (
          <PanelEmpty icon={MessageSquare} title="No comments" detail="Saved comments for this cell will appear here." />
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="mb-2 rounded-lg border p-3" style={{ borderColor: "#E3E6EA" }}>
              <div className="mb-1 text-[11px] font-semibold" style={{ color: "#818EA0" }}>
                {comment.actor} / {comment.status}
              </div>
              <div className="text-[13px]" style={{ color: "#292D34" }}>{comment.body}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function EmptyState({ title, detail, loading = false }: { title: string; detail: string; loading?: boolean }) {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="max-w-md rounded-lg border bg-white p-6 text-center" style={{ borderColor: "#E3E6EA" }}>
        {loading ? <Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin text-[#7B68EE]" /> : <Stethoscope className="mx-auto mb-3 h-5 w-5 text-[#7B68EE]" />}
        <div className="text-[14px] font-bold" style={{ color: "#292D34" }}>{title}</div>
        <div className="mt-1 text-[13px]" style={{ color: "#818EA0" }}>{detail}</div>
      </div>
    </div>
  );
}

function PanelEmpty({ icon: Icon, title, detail }: { icon: typeof Stethoscope; title: string; detail: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center p-6 text-center">
      <Icon className="mb-3 h-5 w-5 text-[#7B68EE]" />
      <div className="text-[13px] font-bold" style={{ color: "#292D34" }}>{title}</div>
      <div className="mt-1 text-[12px]" style={{ color: "#818EA0" }}>{detail}</div>
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 text-[12px]">
      <span style={{ color: "#818EA0" }}>{label}</span>
      <span className="max-w-[210px] text-right font-semibold" style={{ color: "#292D34" }}>{value}</span>
    </div>
  );
}

function workbookPayload(value: unknown): WorkbookPayload | null {
  if (!isRecord(value)) return null;
  const workbook = isRecord(value.workbookData) ? value.workbookData : value;
  if (!isRecord(workbook.sheets)) return null;
  return workbook as WorkbookPayload;
}

function resolveSelection(selection: Selection | null, sheetId: string | undefined, sheet?: SheetPayload) {
  if (!sheetId || !sheet) return { row: 0, col: 0 };
  if (selection?.sheetId === sheetId) return selection;
  const shape = sheetShape(sheet);
  for (let row = 0; row < shape.rows; row++) {
    for (let col = 0; col < shape.cols; col++) {
      if (getCell(sheet, row, col)?.diagnosis) return { row, col };
    }
  }
  return { row: 0, col: 0 };
}

function sheetShape(sheet?: SheetPayload) {
  if (!sheet) return { rows: 0, cols: 0 };
  let maxRow = Math.min(sheet.rowCount ?? MAX_VISIBLE_ROWS, MAX_VISIBLE_ROWS);
  let maxCol = Math.min(sheet.columnCount ?? MAX_VISIBLE_COLS, MAX_VISIBLE_COLS);
  for (const [rowKey, row] of Object.entries(sheet.cellData ?? {})) {
    maxRow = Math.min(Math.max(maxRow, Number(rowKey) + 1), MAX_VISIBLE_ROWS);
    for (const colKey of Object.keys(row)) {
      maxCol = Math.min(Math.max(maxCol, Number(colKey) + 1), MAX_VISIBLE_COLS);
    }
  }
  return { rows: Math.max(maxRow, 20), cols: Math.max(maxCol, 8) };
}

function getCell(sheet: SheetPayload, row: number, col: number): CellPayload | undefined {
  return sheet.cellData?.[String(row)]?.[String(col)];
}

function displayValue(cell?: CellPayload) {
  if (!cell) return "";
  const value = cell.v;
  if (value === null || value === undefined) return cell.f ? `=${cell.f}` : "";
  if (typeof value === "number") return value.toLocaleString();
  return String(value);
}

function filterComments(comments: ReviewCommentResponse[], meta?: DiagnosisMeta, sheetName?: string, selectedAddress?: string) {
  const templateCell = meta?.templateCell ?? selectedAddress;
  return comments.filter((comment) => {
    if (meta?.fieldId && comment.fieldId === meta.fieldId) return true;
    if (templateCell && comment.templateCell === templateCell) return true;
    return !comment.fieldId && !!sheetName && comment.sheetName === sheetName;
  });
}

function columnName(index: number) {
  let name = "";
  let current = index + 1;
  while (current > 0) {
    const mod = (current - 1) % 26;
    name = String.fromCharCode(65 + mod) + name;
    current = Math.floor((current - mod) / 26);
  }
  return name;
}

function stringValue(value: unknown, fallback: string) {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
