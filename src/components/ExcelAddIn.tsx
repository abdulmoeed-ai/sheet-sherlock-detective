import { useState } from "react";
import { Sparkles, Save, Undo2, Redo2, Search, Lock, AlertTriangle, Check } from "lucide-react";

type CellMeta = { editable?: boolean; flagged?: boolean; locked?: boolean; ai?: boolean };

const COLS = ["A", "B", "C", "D", "E", "F"];

interface Row {
  label: string;
  values: (string | number)[];
  meta?: Record<number, CellMeta>;
  bold?: boolean;
  group?: "header" | "sub" | "total";
}

const INITIAL_ROWS: Row[] = [
  { label: "Balance Sheet — LUCK · FY2025 (PKR M)", values: ["", "FY23", "FY24", "FY25", "Δ YoY", "Source"], bold: true, group: "header" },
  { label: "Total Assets", values: ["", 152340, 168920, 184210, "+9.1%", "PSX AR p.72"], bold: true, group: "total" },
  { label: "Current Assets", values: ["", 38120, 40210, 41820, "+4.0%", "p.73"], group: "sub" },
  { label: "  Cash & equivalents", values: ["", 12400, 14100, 15240, "+8.1%", "p.73"] },
  { label: "  Receivables", values: ["", 4810, 4920, 5118, "+4.0%", "p.73"] },
  {
    label: "  Inventory",
    values: ["", 5210, 5840, 6040, "+228%", "p.74"],
    meta: { 3: { editable: true, flagged: true, ai: true }, 4: { flagged: true } },
  },
  { label: "  Other current", values: ["", 15700, 15350, 15422, "+0.5%", "p.73"] },
  { label: "Non-current Assets", values: ["", 114220, 128710, 142390, "+10.6%", "p.75"], group: "sub" },
  { label: "  PP&E", values: ["", 98400, 110200, 122800, "+11.4%", "p.75"], meta: { 3: { editable: true } } },
  { label: "  Intangibles", values: ["", 15820, 18510, 19590, "+5.8%", "p.76"], meta: { 3: { editable: true } } },
  { label: "Total Equity + Liabilities", values: ["", 152340, 168920, 180010, "+6.6%", "p.78"], bold: true, group: "total", meta: { 3: { flagged: true, locked: true } } },
  { label: "  Equity", values: ["", 94200, 103500, 112400, "+8.6%", "p.79"], group: "sub" },
  { label: "  Liabilities", values: ["", 58140, 65420, 67610, "+3.3%", "p.80"], group: "sub" },
];

export function ExcelAddIn() {
  const [rows, setRows] = useState<Row[]>(INITIAL_ROWS);
  const [selected, setSelected] = useState<{ r: number; c: number }>({ r: 5, c: 3 });
  const [editing, setEditing] = useState(false);

  const sel = rows[selected.r];
  const selVal = sel?.values[selected.c] ?? "";
  const cellRef = `BS!${COLS[selected.c]}${selected.r + 40}`;

  const setCell = (r: number, c: number, v: string) => {
    const num = Number(v.replace(/,/g, ""));
    const value = isNaN(num) || v === "" ? v : num;
    setRows((prev) => {
      const next = prev.map((row) => ({ ...row, values: [...row.values] }));
      next[r].values[c] = value;
      return next;
    });
  };

  return (
    <div className="overflow-hidden rounded-xl border bg-white shadow-sm" style={{ borderColor: "var(--color-border-default)" }}>
      {/* Add-in header */}
      <div
        className="flex items-center justify-between border-b px-4 py-2.5"
        style={{ borderColor: "var(--color-border-default)", background: "linear-gradient(180deg, #FAFAFD 0%, #F4F3FA 100%)" }}
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md" style={{ background: "var(--color-brand)" }}>
            <span className="text-[11px] font-bold text-white">X</span>
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-[12px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
              Sherlock Excel Add-in
            </span>
            <span className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>
              LUCK_FY25_Model.xlsx · Synced 2s ago
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {[
            { I: Undo2, l: "Undo" },
            { I: Redo2, l: "Redo" },
            { I: Search, l: "Find" },
          ].map(({ I, l }) => (
            <button
              key={l}
              className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--color-text-secondary)] hover:bg-[var(--color-tag-bg)]"
              title={l}
            >
              <I className="h-3.5 w-3.5" />
            </button>
          ))}
          <button
            className="ml-1 flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[11px] font-semibold text-white"
            style={{ background: "var(--color-brand)" }}
          >
            <Save className="h-3 w-3" /> Save
          </button>
        </div>
      </div>

      {/* Formula bar */}
      <div className="flex items-center gap-2 border-b px-3 py-1.5" style={{ borderColor: "var(--color-border-default)", background: "#fff" }}>
        <span
          className="flex h-6 min-w-[60px] items-center justify-center rounded border px-2 font-mono text-[11px] font-semibold"
          style={{ borderColor: "var(--color-border-strong)", background: "var(--color-tag-bg)", color: "var(--color-brand)" }}
        >
          {cellRef}
        </span>
        <span className="font-mono text-[12px]" style={{ color: "var(--color-text-muted)" }}>
          ƒx
        </span>
        <input
          value={String(selVal)}
          onChange={(e) => setCell(selected.r, selected.c, e.target.value)}
          className="flex-1 bg-transparent font-mono text-[12px] outline-none"
          style={{ color: "var(--color-text-primary)" }}
        />
      </div>

      {/* Grid */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr>
              <th
                className="sticky left-0 z-10 w-10 border-b border-r"
                style={{ background: "var(--color-table-header)", borderColor: "var(--color-border-default)" }}
              ></th>
              <th
                className="sticky left-10 z-10 min-w-[220px] border-b border-r px-3 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide"
                style={{ background: "var(--color-table-header)", borderColor: "var(--color-border-default)", color: "var(--color-text-secondary)" }}
              >
                A — Line item
              </th>
              {COLS.slice(1).map((c) => (
                <th
                  key={c}
                  className="border-b border-r px-3 py-1.5 text-right text-[10px] font-semibold uppercase tracking-wide"
                  style={{ background: "var(--color-table-header)", borderColor: "var(--color-border-default)", color: "var(--color-text-secondary)" }}
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(1).map((row, ri) => {
              const realR = ri + 1;
              const rowBg =
                row.group === "total"
                  ? "var(--color-table-header)"
                  : row.group === "sub"
                    ? "var(--color-table-row-alt)"
                    : "#fff";
              return (
                <tr key={ri}>
                  <td
                    className="sticky left-0 z-10 border-b border-r px-2 text-center text-[10px] font-medium"
                    style={{
                      background: "var(--color-table-header)",
                      borderColor: "var(--color-border-default)",
                      color: "var(--color-text-muted)",
                      height: 30,
                    }}
                  >
                    {realR + 39}
                  </td>
                  <td
                    className="sticky left-10 z-10 border-b border-r px-3 whitespace-pre"
                    style={{
                      background: rowBg,
                      borderColor: "var(--color-border-default)",
                      fontWeight: row.bold ? 700 : 500,
                      color: "var(--color-text-primary)",
                    }}
                  >
                    {row.label}
                  </td>
                  {row.values.slice(1).map((v, ci) => {
                    const realC = ci + 1;
                    const meta = row.meta?.[realC] ?? {};
                    const isSel = selected.r === realR && selected.c === realC;
                    const isNum = typeof v === "number";
                    return (
                      <td
                        key={ci}
                        onClick={() => {
                          setSelected({ r: realR, c: realC });
                          setEditing(false);
                        }}
                        onDoubleClick={() => meta.editable && setEditing(true)}
                        className="relative border-b border-r px-3 cursor-cell"
                        style={{
                          background: meta.flagged
                            ? "var(--color-danger-bg)"
                            : meta.ai
                              ? "var(--color-tag-bg)"
                              : rowBg,
                          borderColor: "var(--color-border-default)",
                          textAlign: isNum || typeof v === "string" && v.startsWith("+") ? "right" : "left",
                          fontVariantNumeric: "tabular-nums",
                          fontWeight: row.bold ? 700 : 500,
                          color: meta.flagged ? "var(--color-danger)" : "var(--color-text-primary)",
                          boxShadow: isSel ? "inset 0 0 0 2px var(--color-brand)" : undefined,
                          height: 30,
                        }}
                      >
                        {isSel && editing && meta.editable ? (
                          <input
                            autoFocus
                            value={String(v)}
                            onChange={(e) => setCell(realR, realC, e.target.value)}
                            onBlur={() => setEditing(false)}
                            onKeyDown={(e) => e.key === "Enter" && setEditing(false)}
                            className="absolute inset-0 w-full bg-white px-3 font-mono outline-none"
                            style={{ color: "var(--color-text-primary)" }}
                          />
                        ) : (
                          <span className="flex items-center justify-end gap-1.5">
                            {meta.locked && <Lock className="h-3 w-3" style={{ color: "var(--color-text-muted)" }} />}
                            {meta.flagged && <AlertTriangle className="h-3 w-3" style={{ color: "var(--color-danger)" }} />}
                            {isNum ? v.toLocaleString() : v}
                          </span>
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

      {/* AI suggestion drawer */}
      <div
        className="flex items-start gap-3 border-t px-4 py-3"
        style={{ borderColor: "var(--color-border-default)", background: "var(--color-tag-bg)" }}
      >
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md" style={{ background: "var(--color-brand)" }}>
          <Sparkles className="h-3.5 w-3.5 text-white" />
        </div>
        <div className="flex-1 text-[12px]">
          <div className="flex items-center gap-2">
            <span className="font-semibold" style={{ color: "var(--color-text-primary)" }}>
              Sherlock suggests editing <span className="font-mono">{cellRef}</span>
            </span>
            <span
              className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase"
              style={{ background: "var(--color-danger-bg)", color: "var(--color-danger)" }}
            >
              Flagged
            </span>
          </div>
          <p className="mt-0.5" style={{ color: "var(--color-text-secondary)" }}>
            OCR-extracted <span className="font-mono">6,040</span> (conf 71%) appears transposed. Source PDF p.74 shows{" "}
            <span className="font-mono font-semibold" style={{ color: "var(--color-text-primary)" }}>
              1,840
            </span>
            . Apply to balance the sheet.
          </p>
        </div>
        <button
          onClick={() => {
            setCell(selected.r, selected.c, "1840");
            setEditing(false);
          }}
          className="flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[11px] font-semibold text-white"
          style={{ background: "var(--color-brand)" }}
        >
          <Check className="h-3 w-3" /> Apply
        </button>
        <button
          className="flex h-7 items-center rounded-md border px-2.5 text-[11px] font-semibold"
          style={{ borderColor: "var(--color-border-strong)", color: "var(--color-text-secondary)" }}
        >
          Dismiss
        </button>
      </div>

      {/* Sheet tabs */}
      <div className="flex items-center gap-0 border-t px-2 py-1 text-[11px]" style={{ borderColor: "var(--color-border-default)", background: "#FAFAFD" }}>
        {["Cover", "Assumptions", "BS", "IS", "CF", "Forecast"].map((t) => {
          const active = t === "BS";
          return (
            <button
              key={t}
              className="px-3 py-1 font-medium"
              style={{
                color: active ? "var(--color-brand)" : "var(--color-text-secondary)",
                background: active ? "#fff" : "transparent",
                borderTop: active ? "2px solid var(--color-brand)" : "2px solid transparent",
                borderRadius: "4px 4px 0 0",
              }}
            >
              {t}
            </button>
          );
        })}
      </div>
    </div>
  );
}
