import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { CYCLE_STEPS, stepIndex, useCycle } from "@/lib/cycle-store";

export function CycleProgress() {
  const cycle = useCycle();
  if (cycle.status === "idle") return null;
  const current = stepIndex(cycle.status);

  return (
    <div
      className="mb-6 rounded-xl border bg-white px-5 py-3.5"
      style={{ borderColor: "var(--color-border-default)" }}
    >
      <div className="mb-2.5 flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--color-text-muted)" }}>
          Active cycle · {cycle.period} · {cycle.company}
        </div>
        <div className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>
          Started {cycle.startedAt ? new Date(cycle.startedAt).toLocaleString() : "—"}
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        {CYCLE_STEPS.map((step, i) => {
          const done = i < current;
          const active = i === current;
          const upcoming = i > current;

          const dotBg = done
            ? "#22C55E"
            : active
              ? "#7B68EE"
              : "#FFFFFF";
          const dotColor = done || active ? "#FFFFFF" : "#818EA0";
          const dotBorder = done
            ? "#22C55E"
            : active
              ? "#7B68EE"
              : "#E3E6EA";
          const lineColor = done ? "#22C55E" : "#E3E6EA";

          return (
            <div key={step.key} className="flex flex-1 items-center gap-1.5">
              <Link
                to={step.to}
                className="flex items-center gap-2 group"
                style={{ pointerEvents: upcoming ? "none" : undefined }}
              >
                <span
                  className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold transition-all"
                  style={{
                    background: dotBg,
                    color: dotColor,
                    border: `2px solid ${dotBorder}`,
                    boxShadow: active ? "0 0 0 4px rgba(123,104,238,0.15)" : undefined,
                  }}
                >
                  {done ? <Check className="h-3 w-3" /> : i + 1}
                </span>
                <span
                  className="text-[12px] font-medium"
                  style={{
                    color: active
                      ? "var(--color-text-primary)"
                      : done
                        ? "var(--color-text-secondary)"
                        : "var(--color-text-muted)",
                    fontWeight: active ? 600 : 500,
                  }}
                >
                  {step.label}
                </span>
              </Link>
              {i < CYCLE_STEPS.length - 1 && (
                <div className="flex-1 h-px" style={{ background: lineColor }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
