import { AlertTriangle, CheckCircle2, Info, Loader2, RefreshCcw } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { RagIndexStatusResponse } from "@/lib/api/types";

type RagIndexStatusIndicatorProps = {
  status: RagIndexStatusResponse | null;
  loading?: boolean;
};

export function ragIndexStatusLabel(status: RagIndexStatusResponse | null): string {
  if (!status) return "Ask AI PDF search status unavailable";
  if (status.readyForAskAi) return "Ask AI PDF search ready";
  if (status.status === "running" || status.status === "queued") {
    return `Preparing Ask AI PDF search${status.percent ? ` (${status.percent}%)` : ""}`;
  }
  if (status.status === "failed") return "Ask AI PDF search failed";
  if (status.stale || status.status === "stale") return "Ask AI PDF search updating";
  return "Ask AI PDF search not ready";
}

export function ragIndexStatusDetail(status: RagIndexStatusResponse | null, loading?: boolean): string {
  if (loading && !status) return "Checking Ask AI PDF search status.";
  if (!status) return "Ask AI remains available while PDF search status is unavailable.";
  if (status.readyForAskAi) return "Ask AI can search indexed PDF evidence for this project.";
  if (status.status === "failed") {
    return "PDF search indexing failed. Ask AI remains available without fresh PDF search.";
  }
  if (status.status === "running" || status.status === "queued") {
    return "PDF search is still indexing. Ask AI remains available.";
  }
  if (status.stale || status.status === "stale") {
    return "PDF search is updating after recent workbook changes.";
  }
  return "PDF search has not been indexed yet. Ask AI remains available.";
}

export function RagIndexStatusIndicator({ status, loading = false }: RagIndexStatusIndicatorProps) {
  const label = loading && !status ? "Checking Ask AI PDF search" : ragIndexStatusLabel(status);
  const detail = ragIndexStatusDetail(status, loading);
  const tone = statusTone(status, loading);
  const Icon = tone.icon;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-[11px] font-semibold"
            style={{ borderColor: tone.border, background: tone.background, color: tone.color }}
            aria-label={label}
          >
            <Icon
              className={`h-3.5 w-3.5 ${tone.spin ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            <span className="whitespace-nowrap">{label}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-72">
          {detail}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function statusTone(status: RagIndexStatusResponse | null, loading: boolean) {
  if (loading && !status) {
    return {
      icon: Loader2,
      spin: true,
      border: "#DDE3EA",
      background: "#F7F8FA",
      color: "#4F546B",
    };
  }
  if (status?.readyForAskAi) {
    return {
      icon: CheckCircle2,
      spin: false,
      border: "#A7F3D0",
      background: "#F0FDF4",
      color: "#15803D",
    };
  }
  if (status?.status === "failed") {
    return {
      icon: AlertTriangle,
      spin: false,
      border: "#FECACA",
      background: "#FEF2F2",
      color: "#B91C1C",
    };
  }
  if (status?.status === "running" || status?.status === "queued") {
    return {
      icon: Loader2,
      spin: true,
      border: "#BFDBFE",
      background: "#EFF6FF",
      color: "#1D4ED8",
    };
  }
  if (status?.stale || status?.status === "stale") {
    return {
      icon: RefreshCcw,
      spin: false,
      border: "#FDE68A",
      background: "#FFFBEB",
      color: "#B45309",
    };
  }
  return {
    icon: Info,
    spin: false,
    border: "#E3E6EA",
    background: "#F7F8FA",
    color: "#4F546B",
  };
}
