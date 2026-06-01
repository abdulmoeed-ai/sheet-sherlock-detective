import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PageShell } from "@/components/PageShell";
import { cycleStore, useCycle } from "@/lib/cycle-store";
import { Pencil, Check, X, Download } from "lucide-react";

export const Route = createFileRoute("/assumptions")({
  head: () => ({
    meta: [
      { title: "Assumptions — Sheet Sherlock" },
      { name: "description", content: "Auto-generated assumptions sheet from ingestion with full source citation." },
    ],
  }),
  component: Assumptions,
});

interface Row {
  name: string;
  value: string;
  source: string;
  date: string;
  conf: number;
  sens: "High" | "Med" | "Low";
}

const ROWS: Row[] = [
  { name: "Tractor unit sales CAGR", value: "5.6%/yr",   source: "PAMA",      date: "Apr 2025", conf: 99, sens: "High" },
  { name: "KIBOR (base case)",      value: "18.5%",     source: "SBP",        date: "May 2025", conf: 97, sens: "High" },
  { name: "CPI YoY",                value: "11.2%",     source: "PBS",        date: "Apr 2025", conf: 94, sens: "High" },
  { name: "PKR/USD (avg)",          value: "287.4",     source: "SBP",        date: "May 2025", conf: 96, sens: "Med" },
  { name: "Revenue CAGR (5yr)",     value: "11.2%",     source: "Calculated", date: "—",        conf: 91, sens: "High" },
  { name: "EBITDA margin target",   value: "24.8%",     source: "Management", date: "—",        conf: 85, sens: "High" },
  { name: "Capex FY2026",           value: "PKR 3.2B",  source: "Mgmt Est.",  date: "—",        conf: 80, sens: "Low"  },
  { name: "Discount rate (WACC)",   value: "14.8%",     source: "Calculated", date: "—",        conf: 88, sens: "High" },
];

function Assumptions() {
  const navigate = useNavigate();
  const cycle = useCycle();
  const [rows, setRows] = useState<Row[]>(ROWS);
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [showModal, setShowModal] = useState(false);

  const saveEdit = (i: number) => {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, value: draft } : row)));
    setEditing(null);
  };

  const submit = () => {
    setShowModal(false);
    cycleStore.setStatus("review");
    window.dispatchEvent(
      new CustomEvent("sherlock-toast", {
        detail: "Submitted for review. Awaiting Omar R.'s approval.",
      }),
    );
    navigate({ to: "/" });
  };

  return (
    <PageShell
      title={`Assumptions — ${cycle.period} · ${cycle.company}`}
      subtitle="Auto-generated from ingestion log · all sources pre-cited"
      actions={
        <button
          className="inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-[12px] font-semibold"
          style={{ borderColor: "var(--color-border-strong)", color: "var(--color-text-secondary)" }}
        >
          <Download className="h-3.5 w-3.5" /> Export CSV
        </button>
      }
    >
      <div data-testid="assumptions-page" className="pb-24">
        <div className="text-[13px]" style={{ color: "var(--color-text-secondary)" }}>
          47 assumption rows · 0 unresolved flags
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border bg-white" style={{ borderColor: "var(--color-border-default)" }}>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] uppercase" style={{ background: "var(--color-table-header)", color: "var(--color-text-muted)" }}>
                <th className="px-3 py-2.5">#</th>
                <th className="px-3 py-2.5">Assumption</th>
                <th className="px-3 py-2.5">Value</th>
                <th className="px-3 py-2.5">Source</th>
                <th className="px-3 py-2.5">Pub. date</th>
                <th className="px-3 py-2.5">Confidence</th>
                <th className="px-3 py-2.5">Sensitivity</th>
                <th className="px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const confBg = r.conf >= 90 ? "var(--color-success-bg)" : r.conf >= 80 ? "var(--color-warning-bg)" : "var(--color-danger-bg)";
                const confFg = r.conf >= 90 ? "var(--color-success-fg)" : r.conf >= 80 ? "var(--color-warning-fg)" : "var(--color-danger-fg)";
                const sensStyle = r.sens === "High"
                  ? { bg: "#E3E6EA", fg: "#1A1A2E" }
                  : r.sens === "Med"
                    ? { bg: "#F3F4F6", fg: "#374151" }
                    : { bg: "#F9FAFB", fg: "#818EA0" };
                return (
                  <tr key={r.name} data-testid="assumption-row" className="border-b" style={{ borderColor: "var(--color-border-default)" }}>
                    <td className="px-3 py-2.5 text-[var(--color-text-muted)]">{i + 1}</td>
                    <td className="px-3 py-2.5 font-medium">{r.name}</td>
                    <td className="px-3 py-2.5">
                      {editing === i ? (
                        <div className="flex items-center gap-1">
                          <input
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            className="h-7 rounded border px-2 text-[12px]"
                            style={{ borderColor: "var(--color-brand)" }}
                            autoFocus
                          />
                          <button onClick={() => saveEdit(i)} className="rounded p-1" style={{ color: "var(--color-success-fg)" }}>
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => setEditing(null)} className="rounded p-1" style={{ color: "var(--color-text-muted)" }}>
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="font-semibold tnum">{r.value}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-[var(--color-text-secondary)]">{r.source}</td>
                    <td className="px-3 py-2.5 text-[var(--color-text-muted)]">{r.date}</td>
                    <td className="px-3 py-2.5">
                      <span className="rounded-md px-1.5 py-0.5 text-[11px] font-semibold" style={{ background: confBg, color: confFg }}>
                        {r.conf}%
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="rounded-md px-2 py-0.5 text-[11px] font-semibold" style={{ background: sensStyle.bg, color: sensStyle.fg }}>
                        {r.sens}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {editing !== i && (
                        <button
                          onClick={() => {
                            setEditing(i);
                            setDraft(r.value);
                          }}
                          className="rounded p-1 hover:bg-[var(--color-tag-bg)]"
                        >
                          <Pencil className="h-3.5 w-3.5" style={{ color: "var(--color-text-muted)" }} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="border-t px-5 py-3" style={{ borderColor: "var(--color-border-default)" }}>
            <span className="text-[12px]" style={{ color: "var(--color-text-muted)" }}>
              Last updated: just now · 0 manual edits made
            </span>
          </div>
        </div>
      </div>

      <div
        className="fixed bottom-0 left-[240px] right-0 z-20 flex h-16 items-center justify-between border-t bg-white px-8"
        style={{ borderColor: "var(--color-border-default)" }}
      >
        <span className="text-[12px]" style={{ color: "var(--color-text-muted)" }}>
          Version: {cycle.period}-v1 · will be locked on submission
        </span>
        <div className="flex items-center gap-2">
          <button
            className="h-10 rounded-lg border px-4 text-[13px] font-semibold"
            style={{ borderColor: "var(--color-border-strong)", color: "var(--color-text-secondary)", background: "#fff" }}
          >
            Save draft
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="h-10 rounded-lg px-5 text-[13px] font-semibold text-white"
            style={{ background: "var(--color-brand)" }}
          >
            Submit for Manager review →
          </button>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(25,31,46,0.5)" }}>
          <div
            className="w-[440px] rounded-xl bg-white"
            style={{ borderTop: "4px solid var(--color-brand)" }}
          >
            <div className="px-6 py-5">
              <div className="text-[15px] font-semibold" style={{ color: "var(--color-text-primary)" }}>
                Submit {cycle.period} · {cycle.company} for review?
              </div>
              <p className="mt-2 text-[13px] leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
                This version will be locked. Analyst: Ayesha S. Routes to: Omar R. (Finance Manager). Assumptions: 47 rows · 0 unresolved flags.
              </p>
            </div>
            <div className="flex justify-end gap-2 border-t px-6 py-4" style={{ borderColor: "var(--color-border-default)" }}>
              <button
                onClick={() => setShowModal(false)}
                className="h-9 rounded-md px-4 text-[13px] font-semibold"
                style={{ color: "var(--color-text-secondary)" }}
              >
                Cancel
              </button>
              <button
                onClick={submit}
                className="h-9 rounded-md px-4 text-[13px] font-semibold text-white"
                style={{ background: "var(--color-brand)" }}
              >
                Confirm submission →
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
