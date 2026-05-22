import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  History,
  Download,
  Sparkles,
  X,
  ChevronDown,
  Loader2,
  CheckCircle2,
  Pencil,
  MessageSquare,
  Flag,
  Check,
  ArrowRight,
  AlertCircle,
} from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { cycleStore, useCycle } from "@/lib/cycle-store";
import { toast } from "sonner";
import { Lock, PanelRightClose, PanelRightOpen } from "lucide-react";

export const Route = createFileRoute("/diagnosis")({
  head: () => ({
    meta: [
      { title: "Diagnosis — Sheet Sherlock" },
      { name: "description", content: "Excel-style cell workspace for 3-statement diagnosis." },
    ],
  }),
  component: Diagnosis,
});

/* ────────────────────────── Types & data ────────────────────────── */

type CellState = "flag-red" | "flag-amber" | "corrected" | "commented" | null;
type RowKind = "section" | "item" | "subtotal";
interface Row {
  kind: RowKind;
  label: string;
  note?: string;
  indent?: number;
  values: (number | string | null)[]; // [C, D, E, F]
  formula?: boolean[]; // per data col, marks computed
  states?: (CellState | CellState[])[]; // per data col
}

const COLS = ["A", "B", "C", "D", "E", "F"] as const;
const DATA_COLS = ["C", "D", "E", "F"] as const;
const COL_LABEL: Record<string, string> = {
  A: "Particulars",
  B: "Note",
  C: "2025",
  D: "2024 Restated",
  E: "Var %",
  F: "Check",
};

const ROWS: Row[] = [
  { kind: "section", label: "EQUITY AND LIABILITIES", values: [] },
  { kind: "section", label: "Shareholders' Equity", values: [] },
  { kind: "item", label: "Share capital", note: "3", values: [6469, 6469, "0.0%", "OK"], formula: [false, false, true, true] },
  { kind: "item", label: "Reserves", note: "4", values: [180420, 165110, "+9.3%", "OK"], formula: [false, false, true, true] },
  { kind: "item", label: "Unappropriated profit", note: "5", values: [42180, 38950, "+8.3%", "OK"], formula: [false, false, true, true] },
  { kind: "subtotal", label: "Total Equity", values: [229069, 210529, "+8.8%", "OK"], formula: [true, true, true, true] },

  { kind: "section", label: "NON-CURRENT LIABILITIES", values: [] },
  { kind: "item", label: "Long-term financing", note: "6", values: [18420, 21100, "−12.7%", "OK"], formula: [false, false, true, true] },
  { kind: "item", label: "Deferred liabilities", note: "7", values: [9840, 9230, "+6.6%", "OK"], formula: [false, false, true, true] },
  { kind: "item", label: "Deferred taxation", note: "8", values: [15600, 14820, "+5.3%", "OK"], formula: [false, false, true, true] },
  { kind: "subtotal", label: "Total Non-current Liabilities", values: [43860, 45150, "−2.9%", "OK"], formula: [true, true, true, true] },

  { kind: "section", label: "CURRENT LIABILITIES", values: [] },
  { kind: "item", label: "Trade and other payables", note: "9", values: [22310, 19840, "+12.4%", "OK"], formula: [false, false, true, true] },
  {
    kind: "item",
    label: "Short-term borrowings",
    note: "14",
    values: [8420, -7610, "−210.6%", "Sign?"],
    formula: [false, false, true, true],
    states: ["flag-amber", null, "flag-amber", "flag-amber"],
  },
  { kind: "item", label: "Accrued mark-up", note: "10", values: [1320, 1180, "+11.9%", "OK"], formula: [false, false, true, true] },
  { kind: "item", label: "Provision for taxation", note: "11", values: [4210, 3960, "+6.3%", "OK"], formula: [false, false, true, true] },
  { kind: "subtotal", label: "Total Current Liabilities", values: [36260, 17370, "+108.7%", "Recheck"], formula: [true, true, true, true] },

  { kind: "subtotal", label: "TOTAL EQUITY AND LIABILITIES", values: [309189, 273049, "+13.2%", "Imbalance"], formula: [true, true, true, true] },

  { kind: "section", label: "ASSETS", values: [] },
  { kind: "section", label: "Non-current Assets", values: [] },
  { kind: "item", label: "Property, plant & equipment", note: "12", values: [195420, 182300, "+7.2%", "OK"], formula: [false, false, true, true] },
  { kind: "item", label: "Long-term investments", note: "13", values: [38210, 34800, "+9.8%", "OK"], formula: [false, false, true, true], states: [null, "corrected", null, null] },
  { kind: "item", label: "Long-term deposits", note: "14", values: [820, 760, "+7.9%", "OK"], formula: [false, false, true, true] },
  { kind: "subtotal", label: "Total Non-current Assets", values: [234450, 217860, "+7.6%", "OK"], formula: [true, true, true, true] },

  { kind: "section", label: "Current Assets", values: [] },
  { kind: "item", label: "Stores, spares & loose tools", note: "15", values: [12480, 11240, "+11.0%", "OK"], formula: [false, false, true, true] },
  { kind: "item", label: "Stock-in-trade", note: "16", values: [9820, 8460, "+16.1%", "OK"], formula: [false, false, true, true], states: [null, null, null, "commented"] },
  {
    kind: "item",
    label: "Inventory",
    note: "25",
    values: [19800, 12100, "+63.6%", "Imbalance"],
    formula: [false, false, true, true],
    states: ["flag-red", null, "flag-red", ["flag-red", "commented"]],
  },
  { kind: "item", label: "Trade debts", note: "17", values: [14210, 12860, "+10.5%", "OK"], formula: [false, false, true, true], indent: 0 },
  { kind: "item", label: "Loans & advances", note: "18", values: [3640, 3210, "+13.4%", "OK"], formula: [false, false, true, true] },
  { kind: "item", label: "Short-term investments", note: "19", values: [4820, 4150, "+16.1%", "OK"], formula: [false, false, true, true], states: [null, null, "corrected", null] },
  { kind: "item", label: "Cash & bank balances", note: "20", values: [9969, 3169, "+214.5%", "OK"], formula: [false, false, true, true] },
  { kind: "subtotal", label: "Total Current Assets", values: [74739, 55189, "+35.4%", "OK"], formula: [true, true, true, true] },

  { kind: "subtotal", label: "TOTAL ASSETS", values: [309189, 273049, "+13.2%", "OK"], formula: [true, true, true, true] },
];

const SHEET_TABS = [
  { name: "P&L", dot: "amber" as const },
  { name: "Balance Sheet", dot: "red" as const },
  { name: "Cash Flow", dot: "green" as const },
  { name: "Note 32 – Revenue", dot: null },
  { name: "Note 33 – Cost of Sales", dot: null },
  { name: "Note 34–36 – Expenses", dot: null },
  { name: "Note 37 – Other Income", dot: null },
  { name: "Note 38 – Finance Cost", dot: null },
  { name: "Note 39 – Levy / Tax", dot: null },
];

const MEMBERS = [
  { initials: "AS", name: "Ayesha S.", role: "Finance Analyst" },
  { initials: "OR", name: "Omar R.", role: "Finance Manager" },
  { initials: "SK", name: "Sara K.", role: "Senior Analyst" },
  { initials: "CF", name: "CFO", role: "Finance Director" },
];

/* Static issues list */
const ISSUES = [
  { addr: "BS!D42", desc: "Inventory double-count", sheet: "Balance Sheet", severity: "red", status: "Open", row: 28, col: 0 },
  { addr: "BS!F18", desc: "Short-term borrowings sign error", sheet: "Balance Sheet", severity: "amber", status: "Open", row: 13, col: 3 },
  { addr: "PL!C14", desc: "Revenue period misalignment", sheet: "P&L", severity: "amber", status: "Resolved", row: -1, col: -1 },
] as const;

/* ────────────────────────── Component ────────────────────────── */

function asArr(s: CellState | CellState[] | undefined): CellState[] {
  if (!s) return [];
  return Array.isArray(s) ? s : [s];
}

function topStateColor(states: CellState[]): { border?: string; bg?: string } {
  if (states.includes("flag-red")) return { border: "#EF4444", bg: "#FFF5F5" };
  if (states.includes("flag-amber")) return { border: "#F59E0B", bg: "#FFFBEB" };
  if (states.includes("corrected")) return { border: "#22C55E", bg: "#F0FDF4" };
  return {};
}

function Diagnosis() {
  const navigate = useNavigate();
  const [activeSheet, setActiveSheet] = useState("Balance Sheet");
  const [sel, setSel] = useState<{ r: number; c: number }>({ r: 28, c: 0 }); // Inventory C? we use data col index 0..3 → BS!C..F
  // Cell address mapping: data col index 0..3 -> C..F; row index in ROWS maps to spreadsheet row number = idx + 2 (row 1 = headers)
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [corrected, setCorrected] = useState<Record<string, boolean>>({});
  const [panelTab, setPanelTab] = useState<"diagnosis" | "comments">("diagnosis");
  const [panelOpen, setPanelOpen] = useState(false);
  const [commentScope, setCommentScope] = useState<"cell" | "sheet">("cell");
  const [commentText, setCommentText] = useState("");
  const [mentionOpen, setMentionOpen] = useState(false);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideReason, setOverrideReason] = useState<string | null>(null);
  const [rechecking, setRechecking] = useState(false);
  const [resolved, setResolved] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; r: number; c: number } | null>(null);
  const [historyPopover, setHistoryPopover] = useState<{ x: number; y: number; addr: string } | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [readyModal, setReadyModal] = useState(false);
  const cycle = useCycle();
  const locked = cycle.status === "review" || cycle.status === "approved";
  const gridRef = useRef<HTMLDivElement>(null);

  const cellAddress = (r: number, c: number) => {
    if (r < 0 || c < 0) return "—";
    const colLetter = DATA_COLS[c];
    const rowNum = r + 2;
    return `BS!${colLetter}${rowNum}`;
  };

  const currentAddr = cellAddress(sel.r, sel.c);
  const currentRow = ROWS[sel.r];
  const currentValue =
    currentRow && currentRow.kind !== "section"
      ? overrides[currentAddr] ?? currentRow.values[sel.c]
      : null;
  const isFormula = currentRow?.formula?.[sel.c] === true;
  const formulaDisplay = isFormula ? `=SUM(${DATA_COLS[sel.c]}${sel.r - 4}:${DATA_COLS[sel.c]}${sel.r})` : (currentValue ?? "").toString();

  /* keyboard nav */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (editing) return;
      if (e.key === "ArrowDown") {
        setSel((s) => ({ ...s, r: Math.min(ROWS.length - 1, s.r + 1) }));
        e.preventDefault();
      } else if (e.key === "ArrowUp") {
        setSel((s) => ({ ...s, r: Math.max(0, s.r - 1) }));
        e.preventDefault();
      } else if (e.key === "ArrowRight" || e.key === "Tab") {
        setSel((s) => ({ ...s, c: Math.min(3, s.c + 1) }));
        e.preventDefault();
      } else if (e.key === "ArrowLeft") {
        setSel((s) => ({ ...s, c: Math.max(0, s.c - 1) }));
        e.preventDefault();
      } else if (e.key === "Escape") {
        setCtxMenu(null);
        setHistoryPopover(null);
        setMentionOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing]);

  useEffect(() => {
    const close = () => {
      setCtxMenu(null);
      setMoreOpen(false);
    };
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);

  const openIssueCount = ISSUES.filter((i) => i.status === "Open" && !corrected[i.addr]).length;
  const allClear = openIssueCount === 0;

  const applyCorrection = () => {
    setRechecking(true);
    setTimeout(() => {
      setOverrides((o) => ({ ...o, "BS!D42": 15600 }));
      setCorrected((c) => ({ ...c, "BS!D42": true }));
      setRechecking(false);
      setResolved(true);
    }, 1500);
  };

  const formulaBarValue = currentRow?.kind === "section" ? "" : isFormula ? formulaDisplay : String(currentValue ?? "");

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#F7F8FA" }}>
      <Sidebar />
      <div
        className="grid h-screen min-w-0 flex-1"
        style={{
          gridTemplateRows: "48px 36px 1fr",
          gridTemplateColumns: panelOpen ? "1fr 380px" : "1fr 0px",
        }}
      >
        {/* ROW 1 — TOOLBAR */}
        <div
          className="col-span-2 flex items-center px-4"
          style={{ background: "#FFFFFF", borderBottom: "1px solid #E3E6EA" }}
        >
          <div className="flex items-center gap-1">
            <button
              onClick={() => navigate({ to: "/diff-review" })}
              className="flex h-7 w-7 items-center justify-center rounded hover:bg-[#F7F8FA]"
              title="Back to Diff Review"
            >
              <ArrowLeft className="h-4 w-4" style={{ color: "#818EA0" }} />
            </button>
            <div className="mx-2 h-5 w-px" style={{ background: "#E3E6EA" }} />
            <div className="flex items-center gap-1 text-[12px]">
              <span style={{ color: "#818EA0" }}>FY2025</span>
              <span style={{ color: "#818EA0" }}>/</span>
              <span style={{ color: "#818EA0" }}>Lucky Cement</span>
              <span style={{ color: "#818EA0" }}>/</span>
              <span className="font-semibold" style={{ color: "#292D34" }}>Diagnosis</span>
            </div>
            <div className="mx-3 h-5 w-px" style={{ background: "#E3E6EA" }} />
            <div
              className="flex items-center gap-1 rounded-full px-2.5 py-[3px] text-[11px] font-semibold"
              style={{
                background: locked ? "#D1FAE5" : allClear ? "#D1FAE5" : "#FEF3C7",
                border: `1px solid ${locked ? "#86EFAC" : allClear ? "#A7F3D0" : "#FDE68A"}`,
                color: locked ? "#15803D" : allClear ? "#15803D" : "#B45309",
              }}
            >
              {locked && <Lock className="h-3 w-3" />}
              {locked ? "Locked — Ready for CEO review" : allClear ? "All clear" : `${openIssueCount} issue${openIssueCount === 1 ? "" : "s"} open`}
            </div>
          </div>

          <div className="flex flex-1 items-center justify-center gap-1.5">
            <div
              className="flex h-7 w-[420px] items-center gap-2 rounded-md px-2.5"
              style={{ background: "#F7F8FA", border: "1px solid #E3E6EA" }}
            >
              <div
                className="min-w-[52px] rounded px-2 py-0.5 text-center text-[12px] font-semibold"
                style={{ background: "#FFFFFF", border: "1px solid #E3E6EA", color: "#292D34" }}
              >
                {currentAddr}
              </div>
              <div className="h-4 w-px" style={{ background: "#E3E6EA" }} />
              <div className="flex-1 truncate font-mono text-[12px] tnum" style={{ color: "#292D34" }}>
                {formulaBarValue}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPanelOpen((o) => !o)}
              className="flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-[11px] font-semibold hover:bg-[#F7F8FA]"
              style={{ borderColor: "#E3E6EA", color: "#4F546B", background: "#fff" }}
              title={panelOpen ? "Hide Diagnosis / Comments panel" : "Show Diagnosis / Comments panel"}
            >
              {panelOpen ? <PanelRightClose className="h-3.5 w-3.5" /> : <PanelRightOpen className="h-3.5 w-3.5" />}
              {panelOpen ? "Hide panel" : "Show panel"}
            </button>
            <button className="flex h-7 w-7 items-center justify-center rounded hover:bg-[#F7F8FA]" title="Version history">
              <History className="h-4 w-4" style={{ color: "#818EA0" }} />
            </button>
            <button className="flex h-7 w-7 items-center justify-center rounded hover:bg-[#F7F8FA]" title="Export model">
              <Download className="h-4 w-4" style={{ color: "#818EA0" }} />
            </button>
            <div className="mx-1 h-5 w-px" style={{ background: "#E3E6EA" }} />
            <button
              className="h-[30px] rounded-md border px-3.5 text-[12px] font-semibold"
              style={{ borderColor: "#E3E6EA", color: "#4F546B", background: "#fff" }}
            >
              Save draft
            </button>
            <button
              disabled={!allClear || locked}
              onClick={() => setReadyModal(true)}
              className="h-[30px] rounded-md px-4 text-[12px] font-semibold text-white transition-opacity"
              style={{
                background: locked ? "#15803D" : "#7B68EE",
                opacity: (allClear && !locked) || locked ? 1 : 0.45,
                cursor: allClear && !locked ? "pointer" : locked ? "default" : "not-allowed",
              }}
              title={locked ? "Diagnosis locked & sent for CEO review" : "Lock diagnosis and mark ready for CEO review"}
            >
              {locked ? "✓ Ready for CEO review" : "Mark ready for CEO review →"}
            </button>
          </div>
        </div>

        {/* ROW 2 — SHEET TABS */}
        <div
          className="col-span-2 flex items-end overflow-x-auto px-4"
          style={{ background: "#FFFFFF", borderBottom: "1px solid #E3E6EA", scrollbarWidth: "none" }}
        >
          {SHEET_TABS.map((t) => {
            const active = t.name === activeSheet;
            const dotColor = t.dot === "red" ? "#EF4444" : t.dot === "amber" ? "#F59E0B" : t.dot === "green" ? "#22C55E" : null;
            return (
              <button
                key={t.name}
                onClick={() => setActiveSheet(t.name)}
                className="flex h-[34px] items-center gap-1.5 whitespace-nowrap px-3.5 text-[12px]"
                style={{
                  color: active ? "#292D34" : "#818EA0",
                  fontWeight: active ? 600 : 500,
                  borderBottom: `2px solid ${active ? "#7B68EE" : "transparent"}`,
                }}
              >
                {dotColor && <span className="h-1.5 w-1.5 rounded-full" style={{ background: dotColor }} />}
                {t.name}
              </button>
            );
          })}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMoreOpen((o) => !o);
              }}
              className="ml-1 flex h-[26px] items-center gap-1 rounded-full border px-2.5 text-[11px] font-medium"
              style={{ borderColor: "#E3E6EA", color: "#818EA0", background: "#F7F8FA" }}
            >
              + More <ChevronDown className="h-3 w-3" />
            </button>
            {moreOpen && (
              <div
                className="absolute right-0 top-9 z-30 min-w-[200px] rounded-lg border bg-white py-1 shadow-lg"
                style={{ borderColor: "#E3E6EA" }}
                onClick={(e) => e.stopPropagation()}
              >
                {["Note 40 – Related Parties", "Note 41 – Segments", "Note 42 – EPS", "Assumptions"].map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setActiveSheet(s);
                      setMoreOpen(false);
                    }}
                    className="block w-full px-3 py-1.5 text-left text-[12px] hover:bg-[#F7F8FA]"
                    style={{ color: "#4F546B" }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* LEFT — GRID */}
        <div className="flex min-w-0 min-h-0 flex-col overflow-hidden" style={{ background: "#FFFFFF", borderRight: "1px solid #E3E6EA", gridRow: 3, gridColumn: 1 }}>
          <div ref={gridRef} className="flex-1 overflow-auto">
            <table className="min-w-full border-collapse text-[12px]" style={{ tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: 48 }} />
                <col style={{ width: 280 }} />
                <col style={{ width: 60 }} />
                <col style={{ width: 140 }} />
                <col style={{ width: 140 }} />
                <col style={{ width: 100 }} />
                <col style={{ width: 120 }} />
              </colgroup>
              <thead className="sticky top-0 z-20">
                <tr style={{ height: 24 }}>
                  <th style={{ background: "#F7F8FA", borderRight: "1px solid #E3E6EA", borderBottom: "1px solid #E3E6EA" }} />
                  {COLS.map((c) => (
                    <th
                      key={c}
                      className="text-[11px] font-semibold"
                      style={{
                        background: "#F7F8FA",
                        color: "#818EA0",
                        borderRight: "1px solid #E3E6EA",
                        borderBottom: "1px solid #E3E6EA",
                        height: 24,
                      }}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>{c}</span>
                        <span className="text-[10px] font-medium" style={{ color: "#A0A8B8" }}>
                          · {COL_LABEL[c]}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row, ri) => {
                  if (row.kind === "section") {
                    return (
                      <tr key={ri} style={{ height: 26, background: "#F7F8FA" }}>
                        <td
                          className="sticky left-0 text-center text-[11px]"
                          style={{ background: "#F7F8FA", color: "#818EA0", borderRight: "1px solid #E3E6EA", borderBottom: "1px solid #F0F1F4" }}
                        >
                          {ri + 2}
                        </td>
                        <td
                          colSpan={6}
                          className="px-4 text-[11px] font-bold uppercase"
                          style={{ color: "#292D34", letterSpacing: "0.05em", borderBottom: "1px solid #F0F1F4" }}
                        >
                          {row.label}
                        </td>
                      </tr>
                    );
                  }
                  const rowSelected = sel.r === ri;
                  const isTotal = row.kind === "subtotal";
                  const rowBg = isTotal ? "#F3F0FF" : "#FFFFFF";
                  return (
                    <tr key={ri} style={{ height: 26 }}>
                      <td
                        className="sticky left-0 text-center text-[11px]"
                        style={{
                          background: rowSelected ? "#EDE9FE" : "#F7F8FA",
                          color: rowSelected ? "#7B68EE" : "#818EA0",
                          borderRight: "1px solid #E3E6EA",
                          borderBottom: "1px solid #F7F8FA",
                          fontWeight: rowSelected ? 600 : 400,
                        }}
                      >
                        {ri + 2}
                      </td>
                      <td
                        className="sticky left-12 truncate"
                        style={{
                          background: rowBg,
                          color: "#4F546B",
                          paddingLeft: row.indent ? 28 : 16,
                          paddingRight: 8,
                          fontSize: 12,
                          fontWeight: isTotal ? 700 : 400,
                          borderRight: "1px solid #F0F1F4",
                          borderBottom: "1px solid #F7F8FA",
                          borderTop: isTotal ? "1px solid #E3E6EA" : undefined,
                        }}
                      >
                        {row.label}
                      </td>
                      <td
                        className="text-center text-[11px]"
                        style={{
                          background: rowBg,
                          color: "#7B68EE",
                          cursor: row.note ? "pointer" : "default",
                          borderRight: "1px solid #F0F1F4",
                          borderBottom: "1px solid #F7F8FA",
                          borderTop: isTotal ? "1px solid #E3E6EA" : undefined,
                        }}
                        title={row.note ? `Jump to Note ${row.note}` : undefined}
                      >
                        {row.note ?? ""}
                      </td>
                      {row.values.map((v, ci) => {
                        const formula = row.formula?.[ci] === true;
                        const states = asArr(row.states?.[ci]);
                        const stateColors = topStateColor(states);
                        const isSel = rowSelected && sel.c === ci;
                        const addr = `BS!${DATA_COLS[ci]}${ri + 2}`;
                        const isCorrected = corrected[addr];
                        const showCorrectedOverlay = isCorrected;
                        const baseBg = showCorrectedOverlay ? "#F0FDF4" : (stateColors.bg ?? rowBg);
                        const leftBorder = showCorrectedOverlay
                          ? "3px solid #22C55E"
                          : stateColors.border
                            ? `3px solid ${stateColors.border}`
                            : "none";
                        const display = overrides[addr] ?? v;
                        const isNum = typeof display === "number";
                        return (
                          <td
                            key={ci}
                            onClick={() => {
                              setSel({ r: ri, c: ci });
                              setEditing(false);
                            }}
                            onDoubleClick={() => {
                              if (!formula) {
                                setSel({ r: ri, c: ci });
                                setEditValue(String(display ?? ""));
                                setEditing(true);
                              }
                            }}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              setSel({ r: ri, c: ci });
                              setCtxMenu({ x: e.clientX, y: e.clientY, r: ri, c: ci });
                            }}
                            className="relative px-2.5"
                            style={{
                              background: isSel ? "#F5F3FF" : baseBg,
                              borderRight: "1px solid #F0F1F4",
                              borderBottom: "1px solid #F7F8FA",
                              borderTop: isTotal ? "1px solid #E3E6EA" : undefined,
                              borderLeft: leftBorder,
                              color: showCorrectedOverlay
                                ? "#15803D"
                                : states.includes("flag-red")
                                  ? "#B91C1C"
                                  : states.includes("flag-amber")
                                    ? "#B45309"
                                    : formula
                                      ? "#292D34"
                                      : "#1D4ED8",
                              fontWeight: isTotal ? 700 : formula ? 500 : 500,
                              textAlign: "right",
                              fontVariantNumeric: "tabular-nums",
                              fontSize: 12,
                              cursor: formula ? "default" : "cell",
                              outline: isSel ? "2px solid #7B68EE" : undefined,
                              outlineOffset: -1,
                            }}
                          >
                            {formula && (
                              <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[8px]" style={{ color: "#A0A8B8" }}>
                                ƒ
                              </span>
                            )}
                            {states.includes("commented") && (
                              <span
                                className="absolute right-0 top-0"
                                style={{
                                  width: 0,
                                  height: 0,
                                  borderLeft: "6px solid transparent",
                                  borderTop: "6px solid #7B68EE",
                                }}
                                title="Has comments"
                              />
                            )}
                            {(states.includes("flag-red") || states.includes("flag-amber")) && !states.includes("commented") && (
                              <span
                                className="absolute right-0 top-0"
                                style={{
                                  width: 0,
                                  height: 0,
                                  borderLeft: "6px solid transparent",
                                  borderTop: `6px solid ${states.includes("flag-red") ? "#EF4444" : "#F59E0B"}`,
                                }}
                              />
                            )}
                            {isSel && editing && !formula ? (
                              <input
                                autoFocus
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={() => {
                                  const n = Number(editValue.replace(/,/g, ""));
                                  if (!Number.isNaN(n)) {
                                    setOverrides((o) => ({ ...o, [addr]: n }));
                                    setCorrected((c) => ({ ...c, [addr]: true }));
                                  }
                                  setEditing(false);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
                                  if (e.key === "Escape") setEditing(false);
                                }}
                                className="absolute inset-0 w-full bg-white px-2.5 text-right font-mono outline-none"
                                style={{ border: "1px solid #7B68EE", color: "#292D34", fontSize: 12 }}
                              />
                            ) : isNum ? (
                              (display as number).toLocaleString()
                            ) : (
                              display
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* RIGHT — PANEL */}
        {panelOpen && (
          <div className="flex h-full min-h-0 flex-col overflow-hidden" style={{ background: "#FFFFFF" }}>
            <div
              className="flex h-12 items-center justify-between px-4"
              style={{ borderBottom: "1px solid #E3E6EA" }}
            >
              <div className="flex items-center gap-1 rounded-md p-0.5" style={{ background: "#F7F8FA" }}>
                {(["diagnosis", "comments"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setPanelTab(t)}
                    className="h-7 rounded-md px-3.5 text-[12px] font-semibold capitalize transition-colors"
                    style={{
                      background: panelTab === t ? "#7B68EE" : "transparent",
                      color: panelTab === t ? "#fff" : "#818EA0",
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                  style={{ background: "#EDE9FE", color: "#7B68EE" }}
                >
                  5 comments
                </span>
                <button onClick={() => setPanelOpen(false)} className="rounded p-1 hover:bg-[#F7F8FA]">
                  <X className="h-4 w-4" style={{ color: "#818EA0" }} />
                </button>
              </div>
            </div>

            {panelTab === "diagnosis" ? (
              <div className="flex-1 overflow-y-auto">
                {/* Active cell block */}
                <div className="sticky top-0 z-10 px-4 py-3" style={{ background: "#FFFFFF", borderBottom: "1px solid #E3E6EA" }}>
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-bold" style={{ color: "#292D34" }}>
                      {currentAddr}
                    </span>
                    <span
                      className="rounded px-2 py-0.5 text-[11px] font-medium"
                      style={{ background: "#F3F0FF", color: "#7B68EE" }}
                    >
                      Balance Sheet
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="text-[12px]" style={{ color: "#4F546B" }}>
                      {currentRow?.kind === "section" ? "—" : currentRow?.label}
                    </span>
                    {currentRow?.label === "Inventory" && !resolved && (
                      <span
                        className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                        style={{ background: "#FEF2F2", color: "#EF4444" }}
                      >
                        Blocking issue
                      </span>
                    )}
                    {resolved && currentRow?.label === "Inventory" && (
                      <span
                        className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                        style={{ background: "#D1FAE5", color: "#15803D" }}
                      >
                        Resolved
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex gap-4">
                    <KV label="Extracted" value={isNumDisplay(currentValue) ? Number(currentValue).toLocaleString() + ",000" : "—"} />
                    <KV
                      label="Prior (Restated)"
                      value={
                        currentRow && currentRow.kind !== "section" && typeof currentRow.values[1] === "number"
                          ? (currentRow.values[1] as number).toLocaleString() + ",000"
                          : "—"
                      }
                    />
                    <KV
                      label="Variance"
                      value={currentRow && currentRow.kind !== "section" ? String(currentRow.values[2] ?? "—") : "—"}
                      danger
                    />
                  </div>
                </div>

                {/* Diagnosis card (only if Inventory active or showing default) */}
                {(currentRow?.label === "Inventory" || sel.r === 28) && (
                  <div
                    className="mx-4 mt-3 rounded-[10px] p-3.5"
                    style={{ background: resolved ? "#F0FDF4" : "#FFF5F5", border: `1px solid ${resolved ? "#A7F3D0" : "#FECACA"}` }}
                  >
                    <div className="flex items-center gap-1.5">
                      {resolved ? (
                        <CheckCircle2 className="h-3.5 w-3.5" style={{ color: "#15803D" }} />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" style={{ color: "#EF4444" }} />
                      )}
                      <span className="text-[12px] font-semibold" style={{ color: resolved ? "#15803D" : "#EF4444" }}>
                        Sherlock AI — {resolved ? "Resolved" : "Diagnosis"}
                      </span>
                    </div>

                    {!resolved && (
                      <>
                        <p className="mt-2 text-[12px] leading-[1.6]" style={{ color: "#4F546B" }}>
                          Balance sheet imbalance of <strong>PKR 4.2M</strong> traced to <strong>Inventory (Note 25)</strong>. Closing stock in
                          <strong> BS!D42</strong> appears to include Work-in-Process held with third parties (Note 25.3 — Rs.{" "}
                          <strong>268,881</strong> thousand) which may be double-counted against Stock-in-trade.
                        </p>

                        <div className="mt-3">
                          {[
                            ["Causal cell", "BS!D42"],
                            ["Classification", "Possible double-count"],
                            ["Imbalance amount", "PKR 4,200,000"],
                          ].map(([k, v]) => (
                            <div key={k} className="flex items-center justify-between py-[7px]" style={{ borderBottom: "1px solid #F3F4F6" }}>
                              <span className="text-[11px]" style={{ color: "#818EA0" }}>{k}</span>
                              <span className="text-[12px] font-semibold" style={{ color: "#292D34" }}>{v}</span>
                            </div>
                          ))}
                        </div>

                        <div className="mt-2.5 rounded-md px-3 py-2.5" style={{ background: "#F0FDF4" }}>
                          <div className="mb-1.5 text-[10px] font-semibold uppercase" style={{ color: "#15803D" }}>
                            Proposed correction
                          </div>
                          <div className="font-mono text-[12px]" style={{ color: "#292D34" }}>
                            Remove WIP component from closing stock
                          </div>
                          <div className="font-mono text-[12px]" style={{ color: "#292D34" }}>
                            BS!D42: 19,800,000 → 15,600,000
                          </div>
                          <div className="mt-1 text-right text-[11px] font-semibold" style={{ color: "#15803D" }}>
                            Confidence: High (89%)
                          </div>
                        </div>

                        <div className="mt-2.5 flex items-center gap-2">
                          <div className="relative flex-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setOverrideOpen((o) => !o);
                              }}
                              className="flex h-8 w-full items-center justify-between rounded-md border px-3 text-[12px] font-medium"
                              style={{ borderColor: "#E3E6EA", color: "#4F546B", background: "#fff" }}
                            >
                              <span className="truncate">{overrideReason ?? "Override ▾"}</span>
                              <ChevronDown className="h-3.5 w-3.5 flex-shrink-0" />
                            </button>
                            {overrideOpen && (
                              <div
                                className="absolute right-0 top-9 z-30 w-full rounded-lg border bg-white py-1.5 shadow-lg"
                                style={{ borderColor: "#E3E6EA" }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {[
                                  "Sign error (+/- reversed)",
                                  "Wrong period applied",
                                  "Intercompany elimination needed",
                                  "OCR extraction error",
                                  "Other (add comment)",
                                ].map((r) => (
                                  <button
                                    key={r}
                                    onClick={() => {
                                      setOverrideReason(r);
                                      setOverrideOpen(false);
                                    }}
                                    className="block h-8 w-full px-3.5 text-left text-[12px] hover:bg-[#F7F8FA]"
                                    style={{ color: "#292D34" }}
                                  >
                                    {r}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={applyCorrection}
                            disabled={rechecking}
                            className="h-8 rounded-md px-3.5 text-[12px] font-semibold text-white"
                            style={{ background: "#7B68EE", opacity: rechecking ? 0.6 : 1 }}
                          >
                            Apply correction
                          </button>
                        </div>

                        {rechecking && (
                          <div className="mt-2.5 flex items-center gap-2 text-[12px]" style={{ color: "#818EA0" }}>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Running 3-statement check...
                          </div>
                        )}
                      </>
                    )}
                    {resolved && (
                      <p className="mt-2 text-[12px]" style={{ color: "#15803D" }}>
                        Balance sheet balanced ✓ — correction applied to BS!D42.
                      </p>
                    )}
                  </div>
                )}

                {/* Issues list */}
                <div className="px-4 pb-6 pt-2">
                  <div
                    className="py-2.5 text-[11px] font-semibold uppercase"
                    style={{ color: "#818EA0", letterSpacing: "0.06em" }}
                  >
                    All open issues
                  </div>
                  {ISSUES.map((i) => {
                    const isRes = i.status === "Resolved" || corrected[i.addr];
                    return (
                      <button
                        key={i.addr}
                        onClick={() => {
                          if (i.row >= 0) setSel({ r: i.row, c: i.col });
                        }}
                        className="mb-1.5 flex w-full items-start gap-2.5 rounded-lg border p-3 text-left transition-colors hover:bg-[#FAFBFC]"
                        style={{ borderColor: "#E3E6EA" }}
                      >
                        <span
                          className="mt-1 h-2 w-2 flex-shrink-0 rounded-full"
                          style={{ background: i.severity === "red" ? "#EF4444" : "#F59E0B" }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] font-semibold" style={{ color: "#7B68EE" }}>{i.addr}</div>
                          <div className="text-[12px] font-semibold" style={{ color: "#292D34" }}>{i.desc}</div>
                          <div className="text-[11px]" style={{ color: "#818EA0" }}>
                            {i.sheet} · {i.severity === "red" ? "Blocking" : "Warning"}
                          </div>
                        </div>
                        <span
                          className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                          style={{
                            background: isRes ? "#D1FAE5" : "#FEE2E2",
                            color: isRes ? "#15803D" : "#DC2626",
                          }}
                        >
                          {isRes ? "Resolved" : "Open"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* COMMENTS TAB */
              <CommentsPanel
                scope={commentScope}
                setScope={setCommentScope}
                currentAddr={currentAddr}
                commentText={commentText}
                setCommentText={setCommentText}
                mentionOpen={mentionOpen}
                setMentionOpen={setMentionOpen}
              />
            )}
          </div>
        )}

        {!panelOpen && (
          <button
            onClick={() => setPanelOpen(true)}
            className="fixed right-4 top-[72px] z-30 flex h-9 items-center gap-1.5 rounded-md border bg-white px-3 text-[12px] font-semibold shadow-md hover:bg-[#F7F8FA]"
            style={{ borderColor: "#E3E6EA", color: "#4F546B" }}
            title="Show Diagnosis / Comments panel"
          >
            <PanelRightOpen className="h-4 w-4" style={{ color: "#7B68EE" }} />
            Diagnosis &amp; Comments
          </button>
        )}

        {/* Context menu */}
        {ctxMenu && (
          <div
            className="fixed z-50 min-w-[200px] rounded-lg border bg-white py-1.5"
            style={{ borderColor: "#E3E6EA", left: ctxMenu.x, top: ctxMenu.y, boxShadow: "0 4px 12px rgba(0,0,0,0.12)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {[
              { I: Pencil, l: "Edit cell value", action: () => { setEditValue(String(currentValue ?? "")); setEditing(true); setCtxMenu(null); } },
              { I: MessageSquare, l: "Add comment", action: () => { setPanelTab("comments"); setCommentScope("cell"); setCtxMenu(null); } },
              { I: History, l: "View cell history", action: () => { setHistoryPopover({ x: ctxMenu.x, y: ctxMenu.y, addr: currentAddr }); setCtxMenu(null); } },
              { I: Flag, l: "Flag for review", action: () => setCtxMenu(null) },
              { I: Check, l: "Mark as resolved", action: () => { setCorrected((c) => ({ ...c, [currentAddr]: true })); setCtxMenu(null); } },
              { I: ArrowRight, l: "Go to source note", action: () => setCtxMenu(null) },
            ].map(({ I, l, action }) => (
              <button
                key={l}
                onClick={action}
                className="flex h-8 w-full items-center gap-2.5 px-3.5 text-left text-[12px] hover:bg-[#F7F8FA]"
                style={{ color: "#292D34" }}
              >
                <I className="h-3.5 w-3.5" style={{ color: "#818EA0" }} />
                {l}
              </button>
            ))}
            <div className="my-1 h-px" style={{ background: "#F3F4F6" }} />
            <button
              onClick={() => setCtxMenu(null)}
              className="flex h-8 w-full items-center gap-2.5 px-3.5 text-left text-[12px] hover:bg-[#FEF2F2]"
              style={{ color: "#EF4444" }}
            >
              <AlertCircle className="h-3.5 w-3.5" />
              Report OCR error
            </button>
          </div>
        )}

        {/* Cell history popover */}
        {historyPopover && (
          <div
            className="fixed z-50 w-[280px] rounded-[10px] border bg-white p-3.5"
            style={{ borderColor: "#E3E6EA", left: historyPopover.x, top: historyPopover.y, boxShadow: "0 6px 20px rgba(0,0,0,0.14)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2.5 text-[12px] font-bold" style={{ color: "#292D34" }}>
              {historyPopover.addr} — Value history
            </div>
            {[
              ["3d ago", "19,800,000", "OCR extraction"],
              ["2h ago", "19,800,000", "Flagged by Sherlock AI"],
              ["Now", "15,600,000", "Manual edit by Ayesha S."],
            ].map(([t, v, src]) => (
              <div key={t} className="mb-2 flex items-start gap-2.5">
                <span className="min-w-[60px] text-[11px]" style={{ color: "#818EA0" }}>{t}</span>
                <div>
                  <div className="text-[13px] font-semibold tnum" style={{ color: "#292D34" }}>{v}</div>
                  <div className="text-[11px]" style={{ color: "#818EA0" }}>{src}</div>
                </div>
              </div>
            ))}
            <div className="flex justify-end">
              <button onClick={() => setHistoryPopover(null)} className="text-[12px]" style={{ color: "#818EA0" }}>
                Close
              </button>
            </div>
          </div>
        )}

        {/* Mark Ready confirmation modal */}
        {readyModal && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center"
            style={{ background: "rgba(15,20,30,0.55)" }}
            onClick={() => setReadyModal(false)}
          >
            <div
              className="w-[460px] rounded-xl bg-white p-6"
              style={{ boxShadow: "0 20px 50px rgba(0,0,0,0.25)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-full" style={{ background: "#EDE9FE" }}>
                  <Lock className="h-4 w-4" style={{ color: "#7B68EE" }} />
                </div>
                <div className="text-[15px] font-bold" style={{ color: "#292D34" }}>
                  Mark diagnosis ready for CEO review
                </div>
              </div>
              <p className="mt-3 text-[13px] leading-[1.55]" style={{ color: "#4F546B" }}>
                This locks the Balance Sheet, P&amp;L and Cash Flow cells you've reviewed. The Forecast tab will use these finalized
                figures as its baseline. You can re-open this cycle by clicking <strong>Unlock</strong> on the Audit Trail.
              </p>
              <div className="mt-4 rounded-lg border p-3 text-[12px]" style={{ borderColor: "#E3E6EA", background: "#F7F8FA" }}>
                <div className="flex justify-between py-1">
                  <span style={{ color: "#818EA0" }}>Cells corrected</span>
                  <span className="font-semibold" style={{ color: "#292D34" }}>
                    {Object.keys(corrected).length}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span style={{ color: "#818EA0" }}>Open issues</span>
                  <span className="font-semibold" style={{ color: openIssueCount === 0 ? "#15803D" : "#B45309" }}>
                    {openIssueCount}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span style={{ color: "#818EA0" }}>Statements reconciled</span>
                  <span className="font-semibold" style={{ color: "#15803D" }}>3 / 3</span>
                </div>
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  onClick={() => setReadyModal(false)}
                  className="h-9 rounded-md border px-4 text-[12px] font-semibold"
                  style={{ borderColor: "#E3E6EA", color: "#4F546B" }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    cycleStore.setStatus("review");
                    setReadyModal(false);
                    toast.success("Diagnosis locked — sent for CEO review. Forecast is now using these figures.");
                    setTimeout(() => navigate({ to: "/forecast" }), 600);
                  }}
                  className="h-9 rounded-md px-4 text-[12px] font-semibold text-white"
                  style={{ background: "#7B68EE" }}
                >
                  Confirm &amp; lock →
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function isNumDisplay(v: unknown): v is number {
  return typeof v === "number";
}

function KV({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] font-medium uppercase" style={{ color: "#818EA0" }}>{label}</span>
      <span className="mt-0.5 text-[14px] font-bold tnum" style={{ color: danger ? "#EF4444" : "#292D34" }}>{value}</span>
    </div>
  );
}

/* ────────────── Comments Panel ────────────── */

interface CommentsProps {
  scope: "cell" | "sheet";
  setScope: (s: "cell" | "sheet") => void;
  currentAddr: string;
  commentText: string;
  setCommentText: (s: string) => void;
  mentionOpen: boolean;
  setMentionOpen: (b: boolean) => void;
}

function CommentsPanel({ scope, setScope, currentAddr, commentText, setCommentText, mentionOpen, setMentionOpen }: CommentsProps) {
  const threads = useMemo(
    () => [
      {
        id: 1,
        initials: "OR",
        author: "Omar Rashid",
        ref: "BS!D42",
        time: "2h ago",
        text: "@AyeshaS the WIP component in closing inventory (Note 25.3) looks like it may be double-counted. Can you verify against the MEL merger restatement schedule before we submit?",
        replies: [
          {
            initials: "AS",
            author: "Ayesha S.",
            time: "45m ago",
            text: "Looking into this now — will update the cell and apply the AI correction after confirming with the Note 25 breakdown.",
          },
        ],
      },
      {
        id: 2,
        initials: "SK",
        author: "Sara K.",
        ref: "BS!F18",
        time: "5h ago",
        text: "@OmarR this short-term borrowing sign looks wrong — it's showing positive but should be a liability (negative). Can you cross-check with Note 14 and correct?",
        replies: [],
      },
      {
        id: 3,
        initials: "AS",
        author: "Ayesha S.",
        ref: "Balance Sheet",
        time: "1d ago",
        text: "Reminder: all 2024 figures on this sheet are Restated due to MEL merger. Do not compare directly to the original 2024 model — use the restated comparative column only.",
        replies: [],
      },
    ],
    [],
  );

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <div className="px-4 py-2.5" style={{ borderBottom: "1px solid #E3E6EA" }}>
        <div className="text-[11px]" style={{ color: "#818EA0" }}>Viewing comments for:</div>
        <div className="mt-1.5 flex gap-1.5">
          <button
            onClick={() => setScope("cell")}
            className="rounded-md px-2.5 py-1 text-[11px] font-semibold"
            style={{
              background: scope === "cell" ? "#EDE9FE" : "#F7F8FA",
              color: scope === "cell" ? "#7B68EE" : "#818EA0",
            }}
          >
            Selected cell: {currentAddr}
          </button>
          <button
            onClick={() => setScope("sheet")}
            className="rounded-md px-2.5 py-1 text-[11px] font-semibold"
            style={{
              background: scope === "sheet" ? "#EDE9FE" : "#F7F8FA",
              color: scope === "sheet" ? "#7B68EE" : "#818EA0",
            }}
          >
            Entire sheet
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {threads.map((t) => (
          <div key={t.id} className="mb-3.5 flex items-start gap-2.5">
            <div
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[12px] font-bold"
              style={{ background: "#EDE9FE", color: "#7B68EE" }}
            >
              {t.initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[12px] font-semibold" style={{ color: "#292D34" }}>{t.author}</span>
                <span className="rounded px-1.5 py-px text-[11px] font-medium" style={{ background: "#F3F0FF", color: "#7B68EE" }}>
                  {t.ref}
                </span>
                <span className="ml-auto text-[11px]" style={{ color: "#818EA0" }}>{t.time}</span>
              </div>
              <p className="mt-1 text-[12px] leading-[1.5]" style={{ color: "#4F546B" }}>
                {renderText(t.text)}
              </p>
              <div className="mt-1.5 flex gap-3">
                <button className="text-[11px]" style={{ color: "#818EA0" }}>Reply</button>
                <button className="text-[11px]" style={{ color: "#22C55E" }}>Resolve</button>
              </div>
              {t.replies.map((r, i) => (
                <div key={i} className="mt-2 border-l-2 pl-3" style={{ borderColor: "#E3E6EA" }}>
                  <div className="flex items-start gap-2">
                    <div
                      className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                      style={{ background: "#EDE9FE", color: "#7B68EE" }}
                    >
                      {r.initials}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[12px] font-semibold" style={{ color: "#292D34" }}>{r.author}</span>
                        <span className="ml-auto text-[11px]" style={{ color: "#818EA0" }}>{r.time}</span>
                      </div>
                      <p className="mt-0.5 text-[12px]" style={{ color: "#4F546B" }}>{r.text}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="relative px-4 py-3" style={{ borderTop: "1px solid #E3E6EA", background: "#FFFFFF" }}>
        <div className="mb-1.5 flex items-center gap-2 text-[11px]" style={{ color: "#818EA0" }}>
          Commenting on:
          <span className="rounded px-1.5 py-px text-[11px] font-medium" style={{ background: "#F3F0FF", color: "#7B68EE" }}>
            {scope === "cell" ? currentAddr : "Balance Sheet"}
          </span>
          <button
            onClick={() => setScope(scope === "cell" ? "sheet" : "cell")}
            className="ml-auto text-[11px]"
            style={{ color: "#7B68EE" }}
          >
            Switch to {scope === "cell" ? "sheet" : "cell"} level
          </button>
        </div>
        <textarea
          value={commentText}
          onChange={(e) => {
            const v = e.target.value;
            setCommentText(v);
            const last = v.slice(-1);
            if (last === "@") setMentionOpen(true);
            else if (v.length === 0) setMentionOpen(false);
          }}
          placeholder="Add a comment — type @ to tag a team member..."
          className="w-full resize-none rounded-md p-2.5 text-[13px] outline-none"
          style={{ border: "1px solid #E3E6EA", color: "#292D34", minHeight: 72, maxHeight: 120, lineHeight: 1.5 }}
        />
        {mentionOpen && (
          <div
            className="absolute bottom-[110px] left-4 z-40 w-[240px] rounded-lg border bg-white py-1.5"
            style={{ borderColor: "#E3E6EA", boxShadow: "0 4px 12px rgba(0,0,0,0.12)" }}
          >
            {MEMBERS.map((m) => (
              <button
                key={m.initials}
                onClick={() => {
                  setCommentText(commentText + m.name.replace(" ", "") + " ");
                  setMentionOpen(false);
                }}
                className="flex h-9 w-full items-center gap-2 px-3 hover:bg-[#F7F8FA]"
              >
                <div
                  className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold"
                  style={{ background: "#EDE9FE", color: "#7B68EE" }}
                >
                  {m.initials}
                </div>
                <div className="flex flex-1 items-baseline gap-2 text-left">
                  <span className="text-[13px] font-medium" style={{ color: "#292D34" }}>{m.name}</span>
                  <span className="text-[11px]" style={{ color: "#818EA0" }}>{m.role}</span>
                </div>
              </button>
            ))}
          </div>
        )}
        <div className="mt-2 flex items-center justify-end gap-2">
          <button
            onClick={() => setCommentText("")}
            className="h-7 px-3 text-[12px]"
            style={{ color: "#818EA0" }}
          >
            Cancel
          </button>
          <button
            disabled={!commentText.trim()}
            onClick={() => setCommentText("")}
            className="h-7 rounded-md px-3.5 text-[12px] font-semibold text-white"
            style={{ background: "#7B68EE", opacity: commentText.trim() ? 1 : 0.4 }}
          >
            Post
          </button>
        </div>
      </div>
    </div>
  );
}

function renderText(text: string) {
  const parts = text.split(/(@\w+)/g);
  return parts.map((p, i) =>
    p.startsWith("@") ? (
      <span key={i} className="rounded px-1 font-medium" style={{ background: "#EDE9FE", color: "#7B68EE" }}>
        {p}
      </span>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}
