import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Download,
  GripVertical,
  History,
  Loader2,
  MessageSquare,
  PanelRightClose,
  PanelRightOpen,
  Reply,
  RotateCcw,
  Save,
  Send,
  Stethoscope,
  X,
} from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import {
  DiagnosisSourceInlinePreview,
  DiagnosisSourcePreviewModal,
} from "@/components/DiagnosisSourcePreviewModal";
import { IconTooltip } from "@/components/IconTooltip";
import {
  WorkbookEditor,
  type WorkbookEditEvent,
  type WorkbookPayload as EditorWorkbookPayload,
} from "@/components/WorkbookEditor";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useCurrentUser } from "@/hooks/use-auth";
import { queryKeys } from "@/lib/api/query-keys";
import {
  createProjectVersion,
  listComments,
  readMappingRules,
  readWorkbookCellHistory,
} from "@/lib/api/projects";
import type { ReviewCommentResponse, WorkbookRevisionResponse } from "@/lib/api/types";
import {
  activeMentionQuery,
  buildCellCommentIndicators,
  cellSelectionFromComment,
  commentsForCell,
  commentsForSheet,
  filterMentionMembers,
  insertMention,
  mentionCandidates,
  normalizeCommentThreads,
  targetLabel,
  type CommentTarget,
  type MentionUser,
} from "@/lib/comments";
import {
  buildCommentTarget,
  buildConfirmedCellUpdate,
  buildFieldIdCellKeys,
  buildOptimisticCellUpdate,
  columnName,
  commentTargetFromComment,
  displayValue,
  firstSheetWithDiagnosis,
  formatCommentDate,
  getCell,
  isNumericDraft,
  optimisticCell,
  removeOptimisticCell,
  resolveSelection,
  sheetCells,
  sheetShape,
  stringValue,
  workbookPayload,
  type CellPayload,
  type DiagnosisMeta,
  type OptimisticCellUpdate,
  type Selection,
  type WorkbookPayload,
} from "@/lib/diagnosis-workbook";
import {
  buildExportWarningSummary,
  canRevertReviewHistoryEntry,
  formatLlmReview,
  formatTermStandardization,
  formatHistoryEntry,
  orderedHistoryEntries,
  ruleTooltipDetails,
  sheetNeedsAttention,
  type RuleTooltipMetadata,
  warningDetails,
  workbookRevisionHistoryEntry,
} from "@/lib/diagnosis-cell";
import {
  diagnosisExportUnsavedDraftWarning,
  diagnosisDraftSaveLabel,
  hasDiagnosisDraftChanges,
  workbookDraftSaveSnapshot,
} from "@/lib/diagnosis-draft";
import {
  clampDiagnosisRightPanelWidth,
  persistDiagnosisRightPanelWidth,
  readDiagnosisRightPanelWidth,
} from "@/lib/diagnosis-right-panel";
import { useWorkspace } from "@/hooks/use-projects";
import {
  useCreateComment,
  useCreateExcelExport,
  useDownloadExcelExport,
  useReopenComment,
  useRevertReviewCell,
  useRevertWorkbookCell,
  useResolveComment,
  useReviewCell,
} from "@/hooks/use-project-actions";
import { setSelectedProjectId } from "@/lib/project-store";
import { cycleStore, useCycle } from "@/lib/cycle-store";
import { sidebarStore } from "@/lib/sidebar-store";
import { toast } from "sonner";

export const Route = createFileRoute("/diagnosis/$projectId")({
  head: () => ({
    meta: [
      { title: "Diagnosis - finance" },
      {
        name: "description",
        content: "Workbook-style cell diagnosis for Millat extraction review.",
      },
    ],
  }),
  component: Diagnosis,
});

type PanelTab = "diagnosis" | "info" | "comments";

function Diagnosis() {
  const navigate = useNavigate();
  const cycle = useCycle();
  const { projectId } = Route.useParams();
  const currentUser = useCurrentUser();
  const workspace = useWorkspace(projectId);
  const reviewCell = useReviewCell(projectId, { invalidateOnSuccess: false });
  const revertCell = useRevertReviewCell(projectId);
  const revertWorkbookCell = useRevertWorkbookCell(projectId);
  const createComment = useCreateComment(projectId);
  const resolveComment = useResolveComment(projectId);
  const reopenComment = useReopenComment(projectId);
  const createExport = useCreateExcelExport(projectId);
  const downloadExport = useDownloadExcelExport(projectId);
  const comments = useQuery({
    queryKey: projectId ? queryKeys.comments(projectId) : ["projects", "none", "comments"],
    queryFn: () => listComments(projectId as string),
    enabled: !!projectId,
  });
  const mappingRules = useQuery({
    queryKey: projectId ? queryKeys.mappingRules(projectId) : ["projects", "none", "mapping-rules"],
    queryFn: () => readMappingRules(projectId as string),
    enabled: !!projectId,
  });

  useEffect(() => {
    setSelectedProjectId(projectId);
    sidebarStore.setCollapsed(true);
  }, [projectId]);

  const workbookSource = workspace.data?.diagnosisWorkbook ?? workspace.data?.exportPreview;
  const serverWorkbook = useMemo(() => workbookPayload(workbookSource), [workbookSource]);
  const draftWorkbookRef = useRef<EditorWorkbookPayload | null>(null);
  const [pendingWorkbookEditCount, setPendingWorkbookEditCount] = useState(0);
  const [savingProjectVersion, setSavingProjectVersion] = useState(false);
  const [savedDraftVersion, setSavedDraftVersion] = useState<{
    id: string;
    label: string | null;
  } | null>(null);
  const workbook = serverWorkbook;
  const sheetIds = workbook?.sheetOrder?.filter((id) => workbook.sheets?.[id]) ?? [];
  const [selection, setSelection] = useState<Selection | null>(null);
  const selectedSheetId =
    selection?.sheetId && sheetIds.includes(selection.sheetId) ? selection.sheetId : null;
  const resolvedActiveSheetId =
    selectedSheetId ??
    (selection ? null : firstSheetWithDiagnosis(workbook, sheetIds)) ??
    sheetIds[0];
  const activeSheet = resolvedActiveSheetId ? workbook?.sheets?.[resolvedActiveSheetId] : undefined;
  const resolvedSelection = resolveSelection(selection, resolvedActiveSheetId, activeSheet);
  const [panelOpen, setPanelOpen] = useState(true);
  const [panelTab, setPanelTab] = useState<PanelTab>("diagnosis");
  const [rightPanelWidth, setRightPanelWidth] = useState(readDiagnosisRightPanelWidth);
  const [layoutWidth, setLayoutWidth] = useState<number | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; width: number } | null>(null);
  const [draftValue, setDraftValue] = useState("");
  const [optimisticCells, setOptimisticCells] = useState<Record<string, OptimisticCellUpdate>>({});
  const layoutRef = useRef<HTMLDivElement | null>(null);
  const selectedCell = activeSheet
    ? optimisticCell(
        getCell(activeSheet, resolvedSelection.row, resolvedSelection.col),
        optimisticCells,
      )
    : undefined;
  const selectedMeta = selectedCell?.diagnosis;
  const exportWarnings = useMemo(() => {
    if (workbook?.exportWarnings) return workbook.exportWarnings;
    const diagnosedCells = sheetIds
      .flatMap((sheetId) => sheetCells(workbook?.sheets?.[sheetId]))
      .filter((cell) => cell.diagnosis);
    return buildExportWarningSummary(diagnosedCells);
  }, [workbook, sheetIds]);
  const selectedCellAddress = `${columnName(resolvedSelection.col)}${resolvedSelection.row + 1}`;
  const selectedAddress = `${activeSheet?.name ?? "Sheet"}!${selectedCellAddress}`;
  const workbookCellHistory = useQuery({
    queryKey:
      projectId && resolvedActiveSheetId
        ? queryKeys.workbookCellHistory(projectId, resolvedActiveSheetId, selectedCellAddress)
        : ["projects", "none", "workbook", "cells", "none", selectedCellAddress, "history"],
    queryFn: () =>
      readWorkbookCellHistory(
        projectId as string,
        resolvedActiveSheetId as string,
        selectedCellAddress,
      ),
    enabled: !!projectId && !!resolvedActiveSheetId && !!selectedCell && !selectedMeta?.fieldId,
  });
  const commentTarget = useMemo(
    () =>
      buildCommentTarget({
        meta: selectedMeta,
        sheetName: activeSheet?.name,
        selectedCellAddress,
      }),
    [activeSheet?.name, selectedCellAddress, selectedMeta],
  );

  const cellComments = useMemo(
    () => commentsForCell(comments.data ?? [], commentTarget),
    [comments.data, commentTarget],
  );
  const sheetComments = useMemo(
    () => commentsForSheet(comments.data ?? [], activeSheet?.name),
    [comments.data, activeSheet?.name],
  );
  const fieldIdCellKeys = useMemo(() => buildFieldIdCellKeys(workbook), [workbook]);
  const commentIndicators = useMemo(
    () => buildCellCommentIndicators(comments.data ?? [], { fieldIdCellKeys }),
    [comments.data, fieldIdCellKeys],
  );
  const commentMentionCandidates = useMemo(
    () => mentionCandidates(workspace.data?.project.teamMembers ?? [], currentUser.data),
    [currentUser.data, workspace.data?.project.teamMembers],
  );
  const dirty = hasDiagnosisDraftChanges({ draftValue, pendingWorkbookEditCount });
  const draftSaveLabel = diagnosisDraftSaveLabel({
    dirty,
    saving: savingProjectVersion,
    savedVersionLabel: savedDraftVersion?.label,
  });

  useEffect(() => {
    draftWorkbookRef.current = null;
    setPendingWorkbookEditCount(0);
    setSavedDraftVersion(null);
  }, [projectId]);
  useEffect(() => {
    const node = layoutRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      setLayoutWidth(entry.contentRect.width);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!dragStart) return;

    const handleMove = (event: PointerEvent) => {
      const nextWidth = clampDiagnosisRightPanelWidth(
        dragStart.width + dragStart.x - event.clientX,
        layoutWidth ?? undefined,
      );
      setRightPanelWidth(nextWidth);
      persistDiagnosisRightPanelWidth(nextWidth);
    };
    const handleUp = () => setDragStart(null);

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [dragStart, layoutWidth]);
  const visibleShape = useMemo(() => sheetShape(activeSheet), [activeSheet]);
  const rulesByCode = useMemo(() => {
    return Object.fromEntries(
      (mappingRules.data?.rules ?? [])
        .filter(
          (rule): rule is RuleTooltipMetadata & { code: string } => typeof rule.code === "string",
        )
        .map((rule) => [rule.code, rule]),
    );
  }, [mappingRules.data?.rules]);

  const revertToRevision = async (revisionId: string) => {
    if (!selectedMeta?.fieldId) return;
    try {
      await revertCell.mutateAsync({ fieldId: selectedMeta.fieldId, revisionId });
      setOptimisticCells((updates) =>
        removeOptimisticCell(updates, selectedMeta.fieldId as string),
      );
      await workspace.refetch();
      toast.success("Cell value reverted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to revert cell");
    }
  };

  const revertManualWorkbookRevision = async (revisionId: string) => {
    if (!projectId || !resolvedActiveSheetId) return;
    try {
      await revertWorkbookCell.mutateAsync({
        sheetId: resolvedActiveSheetId,
        cellAddress: selectedCellAddress,
        revisionId,
      });
      await workspace.refetch();
      await workbookCellHistory.refetch();
      toast.success("Manual workbook cell reverted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to revert manual workbook cell");
    }
  };

  const saveDraft = async () => {
    if (!projectId) return;
    const fieldId = selectedMeta?.fieldId;
    try {
      if (pendingWorkbookEditCount > 0 && workbook) {
        setSavingProjectVersion(true);
        const nextProject = await createProjectVersion(projectId, {
          workbook: workbookDraftSaveSnapshot(draftWorkbookRef.current, workbook) as Record<
            string,
            unknown
          >,
        });
        setDraftValue("");
        draftWorkbookRef.current = null;
        setPendingWorkbookEditCount(0);
        setSavedDraftVersion({ id: nextProject.id, label: nextProject.projectLabel ?? null });
        toast.success(`Draft saved as ${nextProject.projectLabel ?? "a new version"}`);
        return;
      }
      if (draftValue.trim() && fieldId) {
        const optimisticUpdate = buildOptimisticCellUpdate({
          fieldId,
          draftValue: draftValue.trim(),
          oldValue: selectedMeta?.value ?? displayValue(selectedCell) ?? "-",
          existingHistory: selectedMeta?.history,
          currentUser: currentUser.data,
        });
        setOptimisticCells((updates) => ({ ...updates, [fieldId]: optimisticUpdate }));
        const updatedCell = await reviewCell.mutateAsync({
          fieldId,
          input: { action: "edit", value: draftValue.trim(), note: "Saved from Diagnosis draft." },
        });
        setOptimisticCells((updates) => ({
          ...updates,
          [fieldId]: buildConfirmedCellUpdate(fieldId, updatedCell, optimisticUpdate),
        }));
      }
      setDraftValue("");
      await workspace.refetch();
      toast.success("Draft saved");
    } catch (error) {
      if (fieldId) {
        setOptimisticCells((updates) => removeOptimisticCell(updates, fieldId));
      }
      toast.error(error instanceof Error ? error.message : "Unable to save draft");
    } finally {
      setSavingProjectVersion(false);
    }
  };

  const sendComment = async (
    body: string,
    parentCommentId?: string | null,
    targetOverride?: CommentTarget,
  ) => {
    if (!projectId || !body.trim()) return;
    try {
      await createComment.mutateAsync({
        body: body.trim(),
        ...(targetOverride ?? commentTarget),
        parentCommentId: parentCommentId ?? null,
      });
      await comments.refetch();
      toast.success(parentCommentId ? "Reply posted" : "Comment posted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to post comment");
      throw error;
    }
  };

  const setCommentStatus = async (comment: ReviewCommentResponse) => {
    if (!projectId) return;
    try {
      if (comment.status === "resolved") {
        await reopenComment.mutateAsync(comment.id);
        toast.success("Comment reopened");
      } else {
        await resolveComment.mutateAsync(comment.id);
        toast.success("Comment resolved");
      }
      await comments.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update comment");
    }
  };

  const selectCommentTarget = (comment: ReviewCommentResponse) => {
    if (!comment.sheetName) return;
    const targetSheetId = sheetIds.find(
      (sheetId) => workbook?.sheets?.[sheetId]?.name === comment.sheetName,
    );
    if (!targetSheetId) return;
    const nextSelection = cellSelectionFromComment(comment, targetSheetId);
    if (nextSelection) {
      setSelection(nextSelection);
      setPanelOpen(true);
      setPanelTab("comments");
    }
  };

  const commitWorkbookEdit = async (event: WorkbookEditEvent) => {
    if (!projectId) return;
    const fieldId = event.fieldId ?? null;
    const optimisticUpdate =
      fieldId && isNumericDraft(event.newValue)
        ? buildOptimisticCellUpdate({
            fieldId,
            draftValue: event.newValue,
            oldValue: event.oldValue,
            existingHistory: event.oldCell?.diagnosis?.history,
            currentUser: currentUser.data,
          })
        : null;
    if (fieldId && optimisticUpdate) {
      setOptimisticCells((updates) => ({ ...updates, [fieldId]: optimisticUpdate }));
    }
    draftWorkbookRef.current = event.workbook;
    setPendingWorkbookEditCount((count) => count + 1);
    setSavedDraftVersion(null);
    toast.success(`${event.sheetName}!${event.address} added to draft`);
  };

  const exportWorkbook = async () => {
    if (!projectId) return;
    const unsavedDraftWarning = diagnosisExportUnsavedDraftWarning({ dirty });
    if (unsavedDraftWarning) {
      window.alert(unsavedDraftWarning);
      return;
    }
    const unresolved = Number(exportWarnings?.unresolvedIssues ?? 0);
    if (unresolved > 0) {
      const proceed = window.confirm(
        `This export has ${unresolved} unresolved parsing review issue(s): ${Number(exportWarnings.lowConfidence ?? 0)} low confidence, ${Number(exportWarnings.blocked ?? 0)} blocked, ${Number(exportWarnings.missing ?? 0)} missing, and ${Number(exportWarnings.actionableWarnings ?? 0)} warning(s). Continue export?`,
      );
      if (!proceed) return;
    }
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
  const resolvedRightPanelWidth = clampDiagnosisRightPanelWidth(
    rightPanelWidth,
    layoutWidth ?? undefined,
  );

  const workbookPane = (
    <main className="h-full min-h-0 overflow-hidden">
      {!projectId ? (
        <EmptyState
          title="No project selected"
          detail="Select a project from the workspace first."
        />
      ) : workspace.isLoading ? (
        <EmptyState
          title="Loading workbook"
          detail="Fetching the latest Millat diagnosis workbook."
          loading
        />
      ) : workspace.isError ? (
        <EmptyState
          title="Unable to load diagnosis"
          detail={
            workspace.error instanceof Error ? workspace.error.message : "Workspace request failed."
          }
        />
      ) : !workbook || !activeSheet ? (
        <EmptyState
          title="No workbook data"
          detail="Run extraction after acknowledging the Data Mapping Rules."
        />
      ) : (
        <WorkbookEditor
          workbook={workbook}
          activeSheetId={resolvedActiveSheetId}
          selected={resolvedSelection}
          commentIndicators={commentIndicators}
          draftValue={draftValue}
          onSelect={({ sheetId, row, col }) => {
            setSelection({ sheetId, row, col });
            setDraftValue("");
          }}
          onCommitEdit={commitWorkbookEdit}
          commitPending={reviewCell.isPending || createComment.isPending || savingProjectVersion}
        />
      )}
    </main>
  );

  const rightPanel = (
    <aside
      className="flex h-full min-h-0 flex-col overflow-hidden border-l bg-white"
      style={{ borderColor: "#E3E6EA" }}
    >
      <div
        className="flex h-12 items-center justify-between border-b px-4"
        style={{ borderColor: "#E3E6EA" }}
      >
        <div className="flex rounded-md p-0.5" style={{ background: "#F7F8FA" }}>
          {(["diagnosis", "info", "comments"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setPanelTab(tab)}
              className="h-7 rounded-md px-3 text-[12px] font-semibold capitalize"
              style={{
                background: panelTab === tab ? "#7B68EE" : "transparent",
                color: panelTab === tab ? "#fff" : "#818EA0",
              }}
            >
              {tab}
            </button>
          ))}
        </div>
        <IconTooltip label="Close panel">
          <button
            onClick={() => setPanelOpen(false)}
            className="rounded p-1 hover:bg-[#F7F8FA]"
            aria-label="Close panel"
          >
            <X className="h-4 w-4 text-[#818EA0]" />
          </button>
        </IconTooltip>
      </div>
      {panelTab === "diagnosis" ? (
        <DiagnosisPanel
          projectId={projectId}
          address={selectedAddress}
          meta={selectedMeta}
          cell={selectedCell}
          rulesByCode={rulesByCode}
        />
      ) : panelTab === "info" ? (
        <InfoPanel
          address={selectedAddress}
          meta={selectedMeta}
          cell={selectedCell}
          currentUser={currentUser.data}
          onRevert={revertToRevision}
          revertPending={revertCell.isPending}
          manualHistory={workbookCellHistory.data ?? []}
          manualHistoryPending={workbookCellHistory.isLoading}
          onManualRevert={revertManualWorkbookRevision}
          manualRevertPending={revertWorkbookCell.isPending}
        />
      ) : (
        <CommentsPanel
          cellComments={cellComments}
          sheetComments={sheetComments}
          teamMembers={commentMentionCandidates}
          target={commentTarget}
          targetName={targetLabel(commentTarget, selectedMeta?.label ?? selectedAddress)}
          pending={createComment.isPending || resolveComment.isPending || reopenComment.isPending}
          onSend={(body) => sendComment(body)}
          onReply={(comment, body) =>
            sendComment(body, comment.id, commentTargetFromComment(comment))
          }
          onToggleStatus={setCommentStatus}
          onSelectTarget={selectCommentTarget}
        />
      )}
    </aside>
  );

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#F7F8FA" }}>
      <Sidebar />
      <div
        className="grid h-screen min-w-0 flex-1"
        style={{
          gridTemplateRows: "48px 1fr",
        }}
      >
        <div className="flex items-center gap-3 overflow-x-auto border-b bg-white px-4">
          <IconTooltip label="Back to Excel Workbooks">
            <button
              onClick={() => navigate({ to: "/registry" })}
              className="flex h-7 w-7 items-center justify-center rounded hover:bg-[#F7F8FA]"
              aria-label="Back to Excel Workbooks"
            >
              <ArrowLeft className="h-4 w-4 text-[#818EA0]" />
            </button>
          </IconTooltip>
          <div className="text-[12px] font-semibold" style={{ color: "#292D34" }}>
            {workspace.data?.project.companyName ?? cycle.company} /{" "}
            {workspace.data?.project.fiscalYear ?? cycle.period} / Diagnosis
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setPanelOpen((open) => !open)}
              className="flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-[11px] font-semibold"
              style={{ borderColor: "#E3E6EA", color: "#4F546B" }}
            >
              {panelOpen ? (
                <PanelRightClose className="h-3.5 w-3.5" />
              ) : (
                <PanelRightOpen className="h-3.5 w-3.5" />
              )}
              {panelOpen ? "Hide panel" : "Show panel"}
            </button>
            <button
              onClick={exportWorkbook}
              disabled={!projectId || createExport.isPending || downloadExport.isPending}
              className="flex h-7 items-center gap-1.5 rounded-md border px-3 text-[12px] font-semibold disabled:opacity-50"
              style={{ borderColor: "#E3E6EA", color: "#4F546B", background: "#fff" }}
            >
              {createExport.isPending || downloadExport.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              Export to Excel
            </button>
            <span className="min-w-[96px] text-right text-[11px]" style={{ color: "#818EA0" }}>
              {draftSaveLabel}
            </span>
            <button
              onClick={saveDraft}
              disabled={
                !projectId ||
                !dirty ||
                reviewCell.isPending ||
                createComment.isPending ||
                savingProjectVersion
              }
              className="flex h-7 items-center gap-1.5 rounded-md border px-3 text-[12px] font-semibold disabled:opacity-50"
              style={{ borderColor: "#E3E6EA", color: "#4F546B", background: "#fff" }}
            >
              {reviewCell.isPending || createComment.isPending || savingProjectVersion ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
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
          ref={layoutRef}
          className="min-h-0 overflow-hidden"
          style={{
            display: "grid",
            gridTemplateColumns: panelOpen
              ? `minmax(0, 1fr) 10px ${resolvedRightPanelWidth}px`
              : "minmax(0, 1fr)",
          }}
        >
          {panelOpen ? (
            <>
              {workbookPane}
              <button
                type="button"
                aria-label="Resize Diagnosis and Comments panel"
                aria-orientation="vertical"
                aria-valuenow={Math.round(resolvedRightPanelWidth)}
                className="flex h-full cursor-col-resize items-center justify-center border-l border-r transition-colors hover:bg-[#F7F8FA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7B68EE]"
                style={{
                  borderColor: "#E3E6EA",
                  background: dragStart ? "#F7F8FA" : "#fff",
                  color: "#818EA0",
                  touchAction: "none",
                }}
                onPointerDown={(event) => {
                  event.preventDefault();
                  setDragStart({ x: event.clientX, width: resolvedRightPanelWidth });
                }}
              >
                <GripVertical className="h-4 w-4" />
              </button>
              <div className="min-w-0 overflow-hidden">{rightPanel}</div>
            </>
          ) : (
            workbookPane
          )}
        </div>
      </div>
    </div>
  );
}

function DiagnosisPanel({
  projectId,
  address,
  meta,
  cell,
  rulesByCode,
}: {
  projectId?: string | null;
  address: string;
  meta?: DiagnosisMeta;
  cell?: CellPayload;
  rulesByCode: Record<string, RuleTooltipMetadata | undefined>;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const llmReview = formatLlmReview(meta?.llmReview);
  const termStandardization = formatTermStandardization(meta?.termStandardization);
  const previewSource =
    projectId &&
    meta?.sourceDocumentId &&
    meta.pdfPageIndex !== null &&
    meta.pdfPageIndex !== undefined
      ? {
          projectId,
          documentId: meta.sourceDocumentId,
          documentFilename: meta.documentFilename ?? "Source document",
          pdfPageIndex: meta.pdfPageIndex,
          printedPageNumber: meta.printedPageNumber,
          label: meta.label,
          value: meta.value ?? displayValue(cell),
          confidence: meta.confidence,
          sourceText: meta.sourceText,
          boundingBox: meta.boundingBox,
        }
      : null;

  if (!cell) {
    return (
      <PanelEmpty icon={Stethoscope} title={address} detail="Select a populated workbook cell." />
    );
  }
  if (!meta) {
    return (
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mb-4">
          <h2 className="text-[13px] font-bold" style={{ color: "#292D34" }}>
            {address}
          </h2>
          <div className="mt-1 text-[13px] font-semibold" style={{ color: "#4F546B" }}>
            Manual workbook entry
          </div>
          <p className="mt-1 text-[12px] leading-relaxed" style={{ color: "#818EA0" }}>
            No source preview is available because this cell was entered manually.
          </p>
        </div>
        <PanelEmpty
          icon={Stethoscope}
          title="Manual cell"
          detail="Open Info to review the value, formula, and edit history."
        />
      </div>
    );
  }
  return (
    <div className="flex-1 overflow-y-auto p-4">
      {previewSource && (
        <DiagnosisSourceInlinePreview
          source={previewSource}
          onExpand={() => setPreviewOpen(true)}
        />
      )}
      {!previewSource && (
        <section className="rounded-lg border p-3" style={{ borderColor: "#E3E6EA" }}>
          <div className="text-[12px] font-semibold" style={{ color: "#292D34" }}>
            Source preview unavailable
          </div>
          <p className="mt-1 text-[12px] leading-relaxed" style={{ color: "#818EA0" }}>
            This mapped cell does not include a PDF page reference.
          </p>
        </section>
      )}
      <section className="mt-3 rounded-lg border p-3" style={{ borderColor: "#E3E6EA" }}>
        <div className="mb-2 text-[11px] font-semibold uppercase" style={{ color: "#818EA0" }}>
          Rules
        </div>
        <div className="mb-2 text-[11px]" style={{ color: "#818EA0" }}>
          Hover a rule to see why it was applied.
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(meta.ruleIds ?? []).length ? (
            <TooltipProvider delayDuration={150}>
              {meta.ruleIds?.map((rule) => (
                <RuleBadge key={rule} code={rule} details={ruleTooltipDetails(rule, rulesByCode)} />
              ))}
            </TooltipProvider>
          ) : (
            <span className="text-[12px]" style={{ color: "#818EA0" }}>
              No rule IDs recorded
            </span>
          )}
        </div>
        {!!meta.warnings?.length && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            <TooltipProvider delayDuration={150}>
              {meta.warnings.map((warning) => (
                <WarningChip key={warning} warning={warning} />
              ))}
            </TooltipProvider>
          </div>
        )}
        {!!meta.confidenceReasons?.length && (
          <div className="mt-3 space-y-1.5">
            <div className="text-[11px] font-semibold uppercase" style={{ color: "#818EA0" }}>
              Confidence reasons
            </div>
            {meta.confidenceReasons.map((reason, index) => (
              <div
                key={`${reason}-${index}`}
                className="rounded border px-2 py-1.5 text-[11px] leading-relaxed"
                style={{ borderColor: "#E5E7EB", background: "#F9FAFB", color: "#4F546B" }}
              >
                {reason}
              </div>
            ))}
          </div>
        )}
        {llmReview && (
          <div className="mt-3 space-y-2 border-t pt-3" style={{ borderColor: "#E5E7EB" }}>
            <div className="text-[11px] font-semibold uppercase" style={{ color: "#4F546B" }}>
              AI review
            </div>
            <KV label="Decision" value={llmReview.decision} />
            <KV label="Validation" value={llmReview.validationStatus} />
            <KV label="Recommended value" value={llmReview.recommendedValue} />
            <div className="text-[11px] leading-relaxed" style={{ color: "#1E3A8A" }}>
              {llmReview.reason}
            </div>
            {llmReview.riskFlags.length ? (
              <div className="flex flex-wrap gap-1">
                {llmReview.riskFlags.map((flag) => (
                  <span
                    key={flag}
                    className="rounded border px-1.5 py-0.5 text-[10px]"
                    style={{ borderColor: "#BFDBFE", color: "#1D4ED8" }}
                  >
                    {flag}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        )}
        {termStandardization && (
          <div className="mt-3 space-y-2 border-t pt-3" style={{ borderColor: "#E5E7EB" }}>
            <div className="text-[11px] font-semibold uppercase" style={{ color: "#4F546B" }}>
              Term standardization
            </div>
            <KV label="From" value={termStandardization.standardizedFromLabel} />
            <KV label="To" value={termStandardization.standardizedToLabel} />
            <KV label="Canonical term" value={termStandardization.canonicalFinancialTerm} />
            <KV label="Validation" value={termStandardization.validationStatus} />
            <KV label="Confidence" value={termStandardization.confidence} />
            <div className="text-[11px] leading-relaxed" style={{ color: "#1E3A8A" }}>
              {termStandardization.reason}
            </div>
            {termStandardization.riskFlags.length ? (
              <div className="flex flex-wrap gap-1">
                {termStandardization.riskFlags.map((flag) => (
                  <span
                    key={flag}
                    className="rounded border px-1.5 py-0.5 text-[10px]"
                    style={{ borderColor: "#BFDBFE", color: "#1D4ED8" }}
                  >
                    {flag}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        )}
      </section>
      {!!meta.diagnosisCandidates?.length && (
        <section
          className="mt-3 rounded-lg border p-3"
          style={{ borderColor: "#FECACA", background: "#FFF5F5" }}
        >
          <div className="mb-2 text-[11px] font-semibold uppercase" style={{ color: "#EF4444" }}>
            Diagnosis candidates
          </div>
          {meta.diagnosisCandidates.map((candidate, index) => (
            <div key={index} className="text-[12px]" style={{ color: "#4F546B" }}>
              {stringValue(candidate.reason, "Review candidate")}
            </div>
          ))}
        </section>
      )}
      <DiagnosisSourcePreviewModal
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        source={previewSource}
      />
    </div>
  );
}

function InfoPanel({
  address,
  meta,
  cell,
  currentUser,
  onRevert,
  revertPending,
  manualHistory,
  manualHistoryPending,
  onManualRevert,
  manualRevertPending,
}: {
  address: string;
  meta?: DiagnosisMeta;
  cell?: CellPayload;
  currentUser?: { id?: string | null; name?: string | null } | null;
  onRevert: (revisionId: string) => Promise<void>;
  revertPending: boolean;
  manualHistory: WorkbookRevisionResponse[];
  manualHistoryPending: boolean;
  onManualRevert: (revisionId: string) => Promise<void>;
  manualRevertPending: boolean;
}) {
  if (!cell) {
    return <PanelEmpty icon={History} title={address} detail="Select a populated workbook cell." />;
  }

  if (!meta) {
    return (
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mb-4">
          <h2 className="text-[13px] font-bold" style={{ color: "#292D34" }}>
            {address}
          </h2>
          <div className="mt-1 text-[13px] font-semibold" style={{ color: "#4F546B" }}>
            Manual workbook entry
          </div>
        </div>
        <section className="space-y-2 rounded-lg border p-3" style={{ borderColor: "#E3E6EA" }}>
          <KV label="Value" value={displayValue(cell) || "-"} />
          <KV label="Formula" value={cell.f ? `=${cell.f}` : "No"} />
        </section>
        <ManualHistorySection
          history={manualHistory}
          pending={manualHistoryPending}
          currentUser={currentUser}
          onRevert={onManualRevert}
          revertPending={manualRevertPending}
        />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="mb-4">
        <div className="text-[12px] font-bold" style={{ color: "#292D34" }}>
          {address}
        </div>
        <div className="mt-1 text-[13px]" style={{ color: "#4F546B" }}>
          {meta.label ?? "Mapped cell"}
        </div>
      </div>
      <section className="space-y-2 rounded-lg border p-3" style={{ borderColor: "#E3E6EA" }}>
        <KV label="Extracted value" value={meta.value ?? displayValue(cell) ?? "-"} />
        <KV label="Status" value={meta.status ?? "-"} />
        <KV
          label="Confidence"
          value={
            meta.confidence === null || meta.confidence === undefined ? "-" : `${meta.confidence}%`
          }
        />
        <KV label="Confidence level" value={meta.confidenceLevel ?? "-"} />
        <KV label="Match method" value={meta.matchMethod ?? "-"} />
        <KV label="Note" value={meta.noteReference ?? "-"} />
        <KV label="Source" value={meta.documentFilename ?? "-"} />
        <KV label="Page" value={meta.printedPageNumber ? String(meta.printedPageNumber) : "-"} />
      </section>
      <DiagnosisHistorySection
        history={meta.history ?? []}
        currentUser={currentUser}
        onRevert={onRevert}
        revertPending={revertPending}
      />
    </div>
  );
}

function ManualHistorySection({
  history,
  pending,
  currentUser,
  onRevert,
  revertPending,
}: {
  history: WorkbookRevisionResponse[];
  pending: boolean;
  currentUser?: { id?: string | null; name?: string | null } | null;
  onRevert: (revisionId: string) => Promise<void>;
  revertPending: boolean;
}) {
  return (
    <section className="mt-3 rounded-lg border p-3" style={{ borderColor: "#E3E6EA" }}>
      <HistoryHeader />
      {pending ? (
        <div className="flex items-center gap-2 text-[12px]" style={{ color: "#818EA0" }}>
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading history
        </div>
      ) : history.length === 0 ? (
        <div className="text-[12px]" style={{ color: "#818EA0" }}>
          No manual workbook history recorded for this cell.
        </div>
      ) : (
        <div className="max-h-64 overflow-y-auto pr-1">
          {orderedHistoryEntries(history.map(workbookRevisionHistoryEntry)).map((entry, index) => {
            const formatted = formatHistoryEntry(entry, { currentUser });
            const canRevert =
              typeof entry.id === "string" && String(entry.action ?? "").toLowerCase() !== "revert";
            return (
              <HistoryEntryRow
                key={String(entry.id ?? index)}
                title={formatted.title}
                meta={[formatted.meta, formatted.note].filter(Boolean).join(" · ")}
                canRevert={canRevert}
                revertPending={revertPending}
                onRevert={() => onRevert(String(entry.id))}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}

function DiagnosisHistorySection({
  history,
  currentUser,
  onRevert,
  revertPending,
}: {
  history: Array<Record<string, unknown>>;
  currentUser?: { id?: string | null; name?: string | null } | null;
  onRevert: (revisionId: string) => Promise<void>;
  revertPending: boolean;
}) {
  const entries = orderedHistoryEntries(history);
  return (
    <section className="mt-3 rounded-lg border p-3" style={{ borderColor: "#E3E6EA" }}>
      <HistoryHeader />
      {entries.length === 0 ? (
        <div className="text-[12px]" style={{ color: "#818EA0" }}>
          No history recorded for this cell.
        </div>
      ) : (
        <div className="max-h-64 overflow-y-auto pr-1">
          {entries.map((entry, index) => {
            const formatted = formatHistoryEntry(entry, { currentUser });
            return (
              <HistoryEntryRow
                key={String(entry.id ?? index)}
                title={formatted.title}
                meta={[formatted.meta, formatted.note].filter(Boolean).join(" · ")}
                canRevert={canRevertReviewHistoryEntry(entry)}
                revertPending={revertPending}
                onRevert={() => onRevert(String(entry.id))}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}

function HistoryHeader() {
  return (
    <div
      className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase"
      style={{ color: "#818EA0" }}
    >
      <History className="h-3.5 w-3.5" /> History
    </div>
  );
}

function HistoryEntryRow({
  title,
  meta,
  canRevert,
  revertPending,
  onRevert,
}: {
  title: string;
  meta: string;
  canRevert: boolean;
  revertPending: boolean;
  onRevert: () => void;
}) {
  return (
    <div className="border-t py-2 text-[12px]" style={{ borderColor: "#F3F4F6", color: "#4F546B" }}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="break-words font-semibold" style={{ color: "#292D34" }}>
            {title}
          </div>
          {meta && (
            <div className="mt-0.5 text-[11px]" style={{ color: "#818EA0" }}>
              {meta}
            </div>
          )}
        </div>
        {canRevert && (
          <button
            onClick={onRevert}
            disabled={revertPending}
            className="flex h-6 shrink-0 items-center gap-1 rounded border px-2 text-[11px] font-semibold disabled:opacity-50"
            style={{ borderColor: "#E3E6EA", color: "#4F546B" }}
          >
            <RotateCcw className="h-3 w-3" /> Revert
          </button>
        )}
      </div>
    </div>
  );
}

function RuleBadge({
  code,
  details,
}: {
  code: string;
  details: ReturnType<typeof ruleTooltipDetails>;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className="cursor-help rounded bg-[#EDE9FE] px-2 py-1 text-[11px] font-semibold outline-none focus:ring-2 focus:ring-[#C7D2FE]"
          style={{ color: "#7B68EE" }}
        >
          {code}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-72 bg-white text-[#292D34] shadow-lg" side="top">
        <div className="text-[12px] font-bold">
          {details.code} - {details.title}
        </div>
        <div className="mt-1 text-[11px]" style={{ color: "#818EA0" }}>
          {details.severity} / {details.category}
        </div>
        <div className="mt-2 text-[11px] leading-relaxed">{details.description}</div>
      </TooltipContent>
    </Tooltip>
  );
}

function WarningChip({ warning }: { warning: string }) {
  const details = warningDetails(warning);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className="cursor-help rounded px-2 py-1 text-[12px] outline-none focus:ring-2"
          style={{
            background: details.actionable ? "#FFF7ED" : "#F0FDF4",
            color: details.actionable ? "#B45309" : "#166534",
          }}
        >
          {details.label}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-72 bg-white text-[#292D34] shadow-lg" side="top">
        <div className="text-[12px] font-bold">{details.label}</div>
        <div className="mt-2 text-[11px] leading-relaxed">{details.description}</div>
      </TooltipContent>
    </Tooltip>
  );
}

function CommentsPanel({
  cellComments,
  sheetComments,
  teamMembers,
  target,
  targetName,
  pending,
  onSend,
  onReply,
  onToggleStatus,
  onSelectTarget,
}: {
  cellComments: ReviewCommentResponse[];
  sheetComments: ReviewCommentResponse[];
  teamMembers: MentionUser[];
  target: CommentTarget;
  targetName: string;
  pending: boolean;
  onSend: (body: string) => Promise<void>;
  onReply: (comment: ReviewCommentResponse, body: string) => Promise<void>;
  onToggleStatus: (comment: ReviewCommentResponse) => Promise<void>;
  onSelectTarget: (comment: ReviewCommentResponse) => void;
}) {
  const [view, setView] = useState<"cell" | "sheet">("cell");
  const [text, setText] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const displayedComments = view === "cell" ? cellComments : sheetComments;
  const threads = normalizeCommentThreads(displayedComments);

  const submit = async () => {
    if (!text.trim()) return;
    await onSend(text);
    setText("");
  };

  const submitReply = async (comment: ReviewCommentResponse) => {
    if (!replyText.trim()) return;
    await onReply(comment, replyText);
    setReplyText("");
    setReplyingTo(null);
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="border-b p-4" style={{ borderColor: "#E3E6EA" }}>
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <div className="text-[12px] font-bold" style={{ color: "#292D34" }}>
              {targetName}
            </div>
            <div className="mt-1 text-[11px]" style={{ color: "#818EA0" }}>
              {target.sheetName ?? "Current sheet"}
              {target.templateCell ? ` / ${target.templateCell}` : ""}
            </div>
          </div>
          <div className="flex rounded-md p-0.5" style={{ background: "#F7F8FA" }}>
            {(["cell", "sheet"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setView(tab)}
                className="h-7 rounded-md px-2.5 text-[11px] font-semibold capitalize"
                style={{
                  background: view === tab ? "#7B68EE" : "transparent",
                  color: view === tab ? "#fff" : "#818EA0",
                }}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
        <MentionComposer
          value={text}
          onChange={setText}
          teamMembers={teamMembers}
          placeholder="Add a review comment"
          rows={4}
        />
        <div className="mt-2 flex justify-end">
          <button
            onClick={submit}
            disabled={!text.trim() || pending}
            className="flex h-8 items-center gap-1.5 rounded-md px-3 text-[12px] font-semibold text-white disabled:opacity-50"
            style={{ background: "#7B68EE" }}
          >
            {pending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            Send
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {threads.length === 0 ? (
          <PanelEmpty
            icon={MessageSquare}
            title="No comments"
            detail={
              view === "cell"
                ? "Saved comments for this cell will appear here."
                : "Saved comments for this sheet will appear here."
            }
          />
        ) : (
          <ol className="space-y-3">
            {threads.map((comment) => (
              <CommentThreadItem
                key={comment.id}
                comment={comment}
                view={view}
                teamMembers={teamMembers}
                pending={pending}
                replying={replyingTo === comment.id}
                replyText={replyText}
                onReplyText={setReplyText}
                onStartReply={() => {
                  setReplyingTo(comment.id);
                  setReplyText("");
                }}
                onCancelReply={() => {
                  setReplyingTo(null);
                  setReplyText("");
                }}
                onSubmitReply={() => submitReply(comment)}
                onToggleStatus={() => onToggleStatus(comment)}
                onSelectTarget={() => onSelectTarget(comment)}
              />
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

function CommentThreadItem({
  comment,
  view,
  teamMembers,
  pending,
  replying,
  replyText,
  onReplyText,
  onStartReply,
  onCancelReply,
  onSubmitReply,
  onToggleStatus,
  onSelectTarget,
}: {
  comment: ReviewCommentResponse & { replies?: ReviewCommentResponse[] };
  view: "cell" | "sheet";
  teamMembers: MentionUser[];
  pending: boolean;
  replying: boolean;
  replyText: string;
  onReplyText: (value: string) => void;
  onStartReply: () => void;
  onCancelReply: () => void;
  onSubmitReply: () => void;
  onToggleStatus: () => void;
  onSelectTarget: () => void;
}) {
  return (
    <li className="rounded-lg border p-3" style={{ borderColor: "#E3E6EA" }}>
      <CommentBody comment={comment} view={view} onSelectTarget={onSelectTarget} />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={onStartReply}
          disabled={pending}
          className="flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] font-semibold disabled:opacity-50"
          style={{ borderColor: "#E3E6EA", color: "#4F546B" }}
        >
          <Reply className="h-3.5 w-3.5" />
          Reply
        </button>
        <button
          onClick={onToggleStatus}
          disabled={pending}
          className="h-7 rounded-md border px-2 text-[11px] font-semibold disabled:opacity-50"
          style={{ borderColor: "#E3E6EA", color: "#4F546B" }}
        >
          {comment.status === "resolved" ? "Reopen" : "Resolve"}
        </button>
      </div>
      {replying ? (
        <div className="mt-3 rounded-md bg-[#F7F8FA] p-2">
          <MentionComposer
            value={replyText}
            onChange={onReplyText}
            teamMembers={teamMembers}
            placeholder="Reply to this comment"
            rows={3}
          />
          <div className="mt-2 flex justify-end gap-2">
            <button
              onClick={onCancelReply}
              disabled={pending}
              className="h-7 rounded-md border px-2 text-[11px] font-semibold disabled:opacity-50"
              style={{ borderColor: "#E3E6EA", color: "#4F546B" }}
            >
              Cancel
            </button>
            <button
              onClick={onSubmitReply}
              disabled={!replyText.trim() || pending}
              className="flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-semibold text-white disabled:opacity-50"
              style={{ background: "#7B68EE" }}
            >
              {pending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              Send
            </button>
          </div>
        </div>
      ) : null}
      {!!comment.replies?.length && (
        <ol className="mt-3 space-y-2 border-l pl-3" style={{ borderColor: "#E3E6EA" }}>
          {comment.replies.map((replyComment) => (
            <li key={replyComment.id} className="rounded-md bg-[#F7F8FA] p-2">
              <CommentBody
                comment={replyComment}
                view={view}
                compact
                onSelectTarget={onSelectTarget}
              />
            </li>
          ))}
        </ol>
      )}
    </li>
  );
}

function CommentBody({
  comment,
  view,
  compact = false,
  onSelectTarget,
}: {
  comment: ReviewCommentResponse;
  view: "cell" | "sheet";
  compact?: boolean;
  onSelectTarget: () => void;
}) {
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold" style={{ color: "#818EA0" }}>
            {commentActorLabel(comment)} / {comment.status} / {formatCommentDate(comment.createdAt)}
          </div>
          {view === "sheet" && comment.templateCell ? (
            <button
              onClick={onSelectTarget}
              className="mt-1 max-w-full truncate text-left font-mono text-[11px] font-semibold"
              style={{ color: "#7B68EE" }}
            >
              {comment.sheetName}!{comment.templateCell}
            </button>
          ) : null}
        </div>
      </div>
      <div
        className={compact ? "mt-1 text-[12px]" : "mt-2 text-[13px]"}
        style={{ color: "#292D34" }}
      >
        {comment.body}
      </div>
      <MentionChips comment={comment} />
    </>
  );
}

function commentActorLabel(comment: ReviewCommentResponse) {
  return stringValue(comment.actorName, stringValue(comment.actor, "Commenter"));
}

function MentionChips({ comment }: { comment: ReviewCommentResponse }) {
  const resolved = Array.isArray(comment.mentions?.resolved)
    ? (comment.mentions.resolved as Array<Record<string, unknown>>)
    : [];
  const unresolved = Array.isArray(comment.mentions?.unresolved)
    ? (comment.mentions.unresolved as unknown[])
    : [];
  if (!resolved.length && !unresolved.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {resolved.map((mention) => (
        <span
          key={String(mention.email ?? mention.name)}
          className="rounded bg-[#EDE9FE] px-1.5 py-0.5 text-[10px] font-semibold"
          style={{ color: "#7B68EE" }}
        >
          @{String(mention.name ?? mention.email)}
        </span>
      ))}
      {unresolved.map((mention) => (
        <span
          key={String(mention)}
          className="rounded bg-[#FFF7ED] px-1.5 py-0.5 text-[10px] font-semibold"
          style={{ color: "#B45309" }}
        >
          @{String(mention)}
        </span>
      ))}
    </div>
  );
}

function MentionComposer({
  value,
  onChange,
  teamMembers,
  placeholder,
  rows,
}: {
  value: string;
  onChange: (value: string) => void;
  teamMembers: MentionUser[];
  placeholder: string;
  rows: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [cursor, setCursor] = useState(value.length);
  const [popupPosition, setPopupPosition] = useState({ left: 8, top: 32 });
  const mention = activeMentionQuery(value, cursor);
  const matches = mention ? filterMentionMembers(teamMembers, mention.query) : [];

  useEffect(() => {
    if (!mention || !ref.current) return;
    const nextPosition = measureTextareaCaret(ref.current, cursor);
    setPopupPosition((current) =>
      current.left === nextPosition.left && current.top === nextPosition.top
        ? current
        : nextPosition,
    );
  }, [cursor, mention?.start, mention?.end, value]);

  const syncCursor = () => {
    const textarea = ref.current;
    if (!textarea) return;
    setCursor(textarea.selectionStart ?? value.length);
  };

  const chooseMention = (member: MentionUser) => {
    if (!mention) return;
    const nextValue = insertMention(value, mention, member);
    onChange(nextValue);
    window.setTimeout(() => {
      ref.current?.focus();
      const nextCursor = mention.start + nextValue.slice(mention.start).indexOf(" ") + 1;
      ref.current?.setSelectionRange(nextCursor, nextCursor);
      setCursor(nextCursor);
    }, 0);
  };

  return (
    <div className="relative">
      <textarea
        ref={ref}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setCursor(event.target.selectionStart ?? event.target.value.length);
        }}
        onClick={syncCursor}
        onKeyUp={syncCursor}
        onSelect={syncCursor}
        rows={rows}
        className="w-full resize-none rounded-lg border p-2 text-[13px] outline-none"
        style={{ borderColor: "#E3E6EA", color: "#292D34" }}
        placeholder={placeholder}
      />
      {mention ? (
        <div
          className="absolute z-50 mt-1 max-h-56 overflow-y-auto rounded-md border bg-white shadow-lg"
          style={{
            borderColor: "#E3E6EA",
            left: popupPosition.left,
            top: popupPosition.top,
            width: "min(320px, calc(100% - 16px))",
          }}
        >
          {matches.length > 0 ? (
            matches.map((member) => (
              <button
                key={member.email}
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  chooseMention(member);
                }}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[12px] hover:bg-[#F7F8FA]"
              >
                <span className="font-semibold" style={{ color: "#292D34" }}>
                  {member.name}
                </span>
                <span className="truncate text-[11px]" style={{ color: "#818EA0" }}>
                  {member.email}
                </span>
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-[12px]" style={{ color: "#818EA0" }}>
              No matching users
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function measureTextareaCaret(textarea: HTMLTextAreaElement, cursor: number) {
  const style = window.getComputedStyle(textarea);
  const mirror = document.createElement("div");
  const marker = document.createElement("span");
  const containerWidth = textarea.clientWidth || 320;

  mirror.style.position = "absolute";
  mirror.style.visibility = "hidden";
  mirror.style.pointerEvents = "none";
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.overflowWrap = "break-word";
  mirror.style.boxSizing = style.boxSizing;
  mirror.style.width = `${containerWidth}px`;
  mirror.style.font = style.font;
  mirror.style.letterSpacing = style.letterSpacing;
  mirror.style.lineHeight = style.lineHeight;
  mirror.style.padding = style.padding;
  mirror.style.border = style.border;
  mirror.style.top = "0";
  mirror.style.left = "-9999px";

  mirror.textContent = textarea.value.slice(0, cursor);
  marker.textContent = "\u200b";
  mirror.appendChild(marker);
  document.body.appendChild(mirror);

  const left = Math.min(
    Math.max(marker.offsetLeft - textarea.scrollLeft, 8),
    Math.max(containerWidth - 328, 8),
  );
  const top = Math.max(marker.offsetTop - textarea.scrollTop + marker.offsetHeight, 28);
  document.body.removeChild(mirror);

  return {
    left: Number.isFinite(left) ? left : 8,
    top: Number.isFinite(top) ? top : 32,
  };
}

function EmptyState({
  title,
  detail,
  loading = false,
}: {
  title: string;
  detail: string;
  loading?: boolean;
}) {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div
        className="max-w-md rounded-lg border bg-white p-6 text-center"
        style={{ borderColor: "#E3E6EA" }}
      >
        {loading ? (
          <Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin text-[#7B68EE]" />
        ) : (
          <Stethoscope className="mx-auto mb-3 h-5 w-5 text-[#7B68EE]" />
        )}
        <div className="text-[14px] font-bold" style={{ color: "#292D34" }}>
          {title}
        </div>
        <div className="mt-1 text-[13px]" style={{ color: "#818EA0" }}>
          {detail}
        </div>
      </div>
    </div>
  );
}

function PanelEmpty({
  icon: Icon,
  title,
  detail,
}: {
  icon: typeof Stethoscope;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center p-6 text-center">
      <Icon className="mb-3 h-5 w-5 text-[#7B68EE]" />
      <div className="text-[13px] font-bold" style={{ color: "#292D34" }}>
        {title}
      </div>
      <div className="mt-1 text-[12px]" style={{ color: "#818EA0" }}>
        {detail}
      </div>
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 text-[12px]">
      <span style={{ color: "#818EA0" }}>{label}</span>
      <span className="max-w-[210px] text-right font-semibold" style={{ color: "#292D34" }}>
        {value}
      </span>
    </div>
  );
}
