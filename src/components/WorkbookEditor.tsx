import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  diagnosisCellTone,
  isActionableWarningSet,
  shouldCommitCellDraftOnKey,
} from "@/lib/diagnosis-cell";
import type { CellCommentIndicator } from "@/lib/comments";
import { createDebouncedCallback, type DebouncedCallback } from "@/lib/debounce";
import {
  cellToneStyle,
  columnName,
  displayValue,
  editedValueFromEvent,
  getCell,
  numberOrNull,
  prepareWorkbookForUniver,
  resolveWorkbookSheetId,
  selectionFromUniverSelectionEvent,
  sheetShape,
  stringOrNull,
  workbookEditEventFromCell,
  workbookEditEventFromUniverEnd,
  workbookSnapshotFromApi,
  type WorkbookCellPayload,
  type WorkbookEditEvent,
  type WorkbookPayload,
  type WorkbookSelection,
  type WorkbookSheetPayload,
} from "@/lib/workbook-editor-utils";
import { CalculationMode } from "@univerjs/sheets-formula";
import "@univerjs/preset-sheets-core/lib/index.css";

export type {
  WorkbookCellMeta,
  WorkbookCellPayload,
  WorkbookEditEvent,
  WorkbookPayload,
  WorkbookSelection,
  WorkbookSheetPayload,
} from "@/lib/workbook-editor-utils";

const SELECTION_UPDATE_DEBOUNCE_MS = 100;
const EMPTY_COMMENT_INDICATORS = new Map<string, CellCommentIndicator>();

export function WorkbookEditor({
  workbook,
  activeSheetId,
  selected,
  draftValue,
  commentIndicators = EMPTY_COMMENT_INDICATORS,
  commitPending,
  onSelect,
  onCommitEdit,
}: {
  workbook: WorkbookPayload;
  activeSheetId?: string | null;
  selected: WorkbookSelection;
  draftValue: string;
  commentIndicators?: Map<string, CellCommentIndicator>;
  commitPending: boolean;
  onSelect: (selection: WorkbookSelection) => void;
  onCommitEdit: (event: WorkbookEditEvent) => Promise<void> | void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onSelectRef = useRef(onSelect);
  const onCommitEditRef = useRef(onCommitEdit);
  const selectionDebouncerRef = useRef<DebouncedCallback<[WorkbookSelection]> | null>(null);
  const [editing, setEditing] = useState<WorkbookSelection | null>(null);
  const [editValue, setEditValue] = useState("");
  const [univerState, setUniverState] = useState<"loading" | "ready" | "fallback">("loading");
  const [paintState, setPaintState] = useState<"unknown" | "painted" | "blank">("unknown");
  const preparedWorkbook = useMemo(
    () => prepareWorkbookForUniver(workbook, commentIndicators),
    [commentIndicators, workbook],
  );
  const activeSheet = activeSheetId ? workbook.sheets?.[activeSheetId] : undefined;
  const shape = useMemo(() => sheetShape(activeSheet), [activeSheet]);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    onCommitEditRef.current = onCommitEdit;
  }, [onCommitEdit]);

  if (!selectionDebouncerRef.current) {
    selectionDebouncerRef.current = createDebouncedCallback(
      (selection: WorkbookSelection) => onSelectRef.current(selection),
      SELECTION_UPDATE_DEBOUNCE_MS,
    );
  }

  const clearScheduledSelection = () => {
    selectionDebouncerRef.current?.cancel();
  };

  const selectImmediately = (selection: WorkbookSelection) => {
    clearScheduledSelection();
    onSelectRef.current(selection);
  };

  const scheduleSelection = (selection: WorkbookSelection) => {
    selectionDebouncerRef.current?.run(selection);
  };

  useEffect(() => {
    let disposed = false;
    let dispose: (() => void) | undefined;
    let paintTimer: number | undefined;

    async function bootUniver() {
      if (!containerRef.current) return;
      try {
        const [
          { createUniver, LocaleType, mergeLocales },
          { UniverSheetsCorePreset },
          localeModule,
        ] = await Promise.all([
          import("@univerjs/presets"),
          import("@univerjs/preset-sheets-core"),
          import("@univerjs/preset-sheets-core/locales/en-US"),
        ]);
        if (disposed || !containerRef.current) return;
        const { univerAPI } = createUniver({
          locale: LocaleType.EN_US,
          locales: {
            [LocaleType.EN_US]: mergeLocales(localeModule.default),
          },
          presets: [
            UniverSheetsCorePreset({
              container: containerRef.current,
              formula: {
                initialFormulaComputing: CalculationMode.FORCED,
              },
            }),
          ],
        });
        const eventApi = univerAPI as unknown as {
          getFormula?: () => { setInitialFormulaComputing?: (mode: unknown) => void };
          createWorkbook: (data: WorkbookPayload, options?: Record<string, unknown>) => void;
          getActiveWorkbook?: () => {
            setActiveSheet?: (sheetId: string) => void;
            save?: () => WorkbookPayload;
            getSnapshot?: () => WorkbookPayload;
          };
          dispose: () => void;
          Event?: {
            BeforeSheetEditEnd?: unknown;
            BeforeSheetEditStart?: unknown;
            CellClicked?: unknown;
            SelectionChanged?: unknown;
            SelectionMoveEnd?: unknown;
            SheetEditEnded?: unknown;
          };
          addEvent?: (event: unknown, callback: (params: Record<string, unknown>) => void) => void;
        };
        eventApi.getFormula?.().setInitialFormulaComputing?.(CalculationMode.FORCED);
        eventApi.createWorkbook(preparedWorkbook, { makeCurrent: true });
        if (activeSheetId) {
          eventApi.getActiveWorkbook?.().setActiveSheet?.(activeSheetId);
        }
        eventApi.addEvent?.(eventApi.Event?.CellClicked, (params) => {
          const eventWorkbook = workbookSnapshotFromApi(eventApi) ?? workbook;
          const worksheet = params.worksheet as
            | { getSheetId?: () => string; getName?: () => string }
            | undefined;
          const sheetId = resolveWorkbookSheetId(
            eventWorkbook,
            stringOrNull(worksheet?.getSheetId?.()) ?? stringOrNull(worksheet?.getName?.()),
          );
          const row = numberOrNull(params.row);
          const column = numberOrNull(params.column);
          if (sheetId && row !== null && column !== null) {
            selectImmediately({ sheetId, row, col: column });
          }
        });
        const selectFromSelectionEvent = (params: Record<string, unknown>) => {
          const eventWorkbook = workbookSnapshotFromApi(eventApi) ?? workbook;
          const selection = selectionFromUniverSelectionEvent(eventWorkbook, params);
          if (selection) {
            scheduleSelection(selection);
          }
        };
        eventApi.addEvent?.(eventApi.Event?.SelectionMoveEnd, selectFromSelectionEvent);
        eventApi.addEvent?.(eventApi.Event?.SelectionChanged, selectFromSelectionEvent);
        eventApi.addEvent?.(eventApi.Event?.BeforeSheetEditStart, (params) => {
          const eventWorkbook = workbookSnapshotFromApi(eventApi) ?? workbook;
          const worksheet = params.worksheet as
            | { getSheetId?: () => string; getName?: () => string }
            | undefined;
          const sheetId = resolveWorkbookSheetId(
            eventWorkbook,
            stringOrNull(worksheet?.getSheetId?.()) ?? stringOrNull(worksheet?.getName?.()),
          );
          const row = numberOrNull(params.row);
          const column = numberOrNull(params.column);
          if (sheetId && row !== null && column !== null) {
            selectImmediately({ sheetId, row, col: column });
          }
        });
        eventApi.addEvent?.(eventApi.Event?.BeforeSheetEditEnd, (params) => {
          const eventWorkbook = workbookSnapshotFromApi(eventApi) ?? workbook;
          const worksheet = params.worksheet as
            | { getSheetId?: () => string; getName?: () => string }
            | undefined;
          const sheetId = resolveWorkbookSheetId(
            eventWorkbook,
            stringOrNull(worksheet?.getSheetId?.()) ?? stringOrNull(worksheet?.getName?.()),
          );
          const row = numberOrNull(params.row);
          const column = numberOrNull(params.column);
          if (sheetId && row !== null && column !== null) {
            selectImmediately({ sheetId, row, col: column });
          }
          const editEvent =
            sheetId && row !== null && column !== null
              ? workbookEditEventFromUniverEnd(
                  workbook.sheets?.[sheetId] ? workbook : eventWorkbook,
                  { sheetId, row, column },
                  editedValueFromEvent(params),
                )
              : null;
          if (editEvent && editEvent.oldValue !== editEvent.newValue) {
            void Promise.resolve(onCommitEditRef.current(editEvent));
          }
        });
        eventApi.addEvent?.(eventApi.Event?.SheetEditEnded, (params) => {
          const eventWorkbook = workbookSnapshotFromApi(eventApi) ?? workbook;
          const worksheet = params.worksheet as
            | { getSheetId?: () => string; getName?: () => string }
            | undefined;
          const sheetId = resolveWorkbookSheetId(
            eventWorkbook,
            stringOrNull(worksheet?.getSheetId?.()) ?? stringOrNull(worksheet?.getName?.()),
          );
          const row = numberOrNull(params.row);
          const column = numberOrNull(params.column);
          if (sheetId && row !== null && column !== null) {
            selectImmediately({ sheetId, row, col: column });
          }
        });
        dispose = () => eventApi.dispose();
        setUniverState("ready");
        paintTimer = window.setTimeout(() => {
          if (disposed || !containerRef.current) return;
          setPaintState(containerRef.current.querySelector("canvas") ? "painted" : "blank");
        }, 1600);
      } catch {
        if (!disposed) setUniverState("fallback");
      }
    }

    void bootUniver();
    return () => {
      disposed = true;
      if (paintTimer !== undefined) window.clearTimeout(paintTimer);
      clearScheduledSelection();
      dispose?.();
    };
  }, [preparedWorkbook, workbook]);

  const startEdit = (selection: WorkbookSelection, cell?: WorkbookCellPayload) => {
    setEditing(selection);
    setEditValue(displayValue(cell));
  };

  const commitEdit = async (cell?: WorkbookCellPayload) => {
    if (!activeSheet || !editing) return;
    const currentEditing = editing;
    const nextValue = editValue.trim();
    const editEvent = workbookEditEventFromCell(
      workbook,
      activeSheet,
      { row: currentEditing.row, column: currentEditing.col },
      cell,
      nextValue,
    );
    if (editEvent && editEvent.oldValue !== editEvent.newValue) {
      await onCommitEdit(editEvent);
    }
    setEditing(null);
    setEditValue("");
  };

  if (!activeSheet) {
    return <div className="p-4 text-[13px] text-[#818EA0]">No active sheet.</div>;
  }

  return (
    <div className="relative h-full min-h-[640px] bg-[#F7F8FA]">
      <div
        className="h-full min-h-[640px] w-full"
        ref={containerRef}
        data-testid="univer-workbook-host"
      />
      {univerState === "loading" && (
        <div className="absolute inset-x-4 top-4 flex items-center gap-2 rounded-md border bg-white px-3 py-2 text-[12px] text-[#4F546B] shadow-sm">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading spreadsheet engine
        </div>
      )}
      {univerState === "ready" && paintState === "blank" && (
        <div className="absolute left-4 top-4 max-w-sm rounded-md border bg-white px-3 py-2 text-[12px] text-[#4F546B] shadow-sm">
          The spreadsheet engine loaded, but the workbook canvas did not paint. Refresh the page or
          use the fallback grid.
        </div>
      )}
      <div
        className={
          univerState === "fallback" ? "absolute inset-0 overflow-auto bg-[#F7F8FA] p-4" : "sr-only"
        }
      >
        <table
          role="grid"
          aria-label={`${activeSheet.name} workbook editor`}
          className="w-full table-fixed border-collapse bg-white text-[12px]"
          style={{ minWidth: 40 + shape.cols * 108, boxShadow: "0 1px 2px rgba(15,23,42,0.08)" }}
        >
          <colgroup>
            <col style={{ width: 40 }} />
            {Array.from({ length: shape.cols }, (_, col) => (
              <col key={col} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-20 h-7 w-10 border bg-[#F7F8FA]" />
              {Array.from({ length: shape.cols }, (_, col) => (
                <th
                  key={col}
                  className="sticky top-0 z-10 h-7 min-w-[108px] border bg-[#F7F8FA] px-2 font-semibold text-[#818EA0]"
                >
                  {columnName(col)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: shape.rows }, (_, row) => (
              <tr key={row}>
                <th className="sticky left-0 z-10 h-8 border bg-[#F7F8FA] px-2 text-right font-medium text-[#818EA0]">
                  {row + 1}
                </th>
                {Array.from({ length: shape.cols }, (_, col) => {
                  const cell = getCell(activeSheet, row, col);
                  const address = `${columnName(col)}${row + 1}`;
                  const active =
                    selected.sheetId === activeSheetId &&
                    selected.row === row &&
                    selected.col === col;
                  const editingCell =
                    editing !== null &&
                    editing.sheetId === activeSheetId &&
                    editing.row === row &&
                    editing.col === col;
                  const formula = !!cell?.f || !!cell?.diagnosis?.formula;
                  const hasDiagnosis = !!cell?.diagnosis;
                  const tone = diagnosisCellTone({
                    formula,
                    status: cell?.diagnosis?.status,
                    confidence: cell?.diagnosis?.confidence,
                    confidenceLevel: cell?.diagnosis?.confidenceLevel,
                    hasWarning: isActionableWarningSet(cell?.diagnosis?.warnings),
                  });
                  const style = cellToneStyle(tone, { active, hasDiagnosis, formula });
                  return (
                    <td
                      key={col}
                      role="gridcell"
                      aria-label={`${address} ${displayValue(cell)}`}
                      onClick={() =>
                        onSelect({
                          sheetId: activeSheetId ?? activeSheet.id ?? activeSheet.name,
                          row,
                          col,
                        })
                      }
                      onDoubleClick={() =>
                        startEdit(
                          {
                            sheetId: activeSheetId ?? activeSheet.id ?? activeSheet.name,
                            row,
                            col,
                          },
                          cell,
                        )
                      }
                      className="relative h-8 truncate border px-2"
                      style={{
                        borderColor: style.borderColor,
                        outline: active ? "2px solid #7B68EE" : undefined,
                        outlineOffset: -1,
                        background: style.background,
                        color: style.color,
                        textAlign: typeof cell?.v === "number" ? "right" : "left",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {editingCell ? (
                        <input
                          value={editValue}
                          onChange={(event) => setEditValue(event.target.value)}
                          onKeyDown={(event) => {
                            if (
                              shouldCommitCellDraftOnKey({
                                key: event.key,
                                draftValue: editValue,
                                editable: true,
                                pending: commitPending,
                              })
                            ) {
                              event.preventDefault();
                              void commitEdit(cell);
                            }
                          }}
                          className="absolute inset-0 bg-white px-2 text-right outline-none"
                          style={{ border: "1px solid #7B68EE", color: "#292D34" }}
                          autoFocus
                        />
                      ) : (
                        displayValue(cell)
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
