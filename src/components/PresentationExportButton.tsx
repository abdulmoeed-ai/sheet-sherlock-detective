import { Loader2, Presentation } from "lucide-react";
import { toast } from "sonner";
import {
  useCreatePresentationExport,
  useDownloadPresentationExport,
} from "@/hooks/use-project-actions";

interface Props {
  projectId: string;
  className?: string;
  style?: React.CSSProperties;
}

export function PresentationExportButton({ projectId, className, style }: Props) {
  const create = useCreatePresentationExport(projectId);
  const download = useDownloadPresentationExport(projectId);
  const isPending = create.isPending || download.isPending;

  const handleClick = async () => {
    try {
      const result = await create.mutateAsync();

      if (result.warnings.includes("llm_unavailable_used_deterministic")) {
        toast.info("Gemini unavailable — generated slides deterministically.");
      } else if (result.warnings.includes("llm_reinference_failed_used_deterministic")) {
        toast.info("LLM code failed after retry — generated slides deterministically.");
      } else if (result.warnings.includes("llm_code_error_retried")) {
        toast.info("Generated with LLM (one retry needed).");
      }

      const blob = await download.mutateAsync(result.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${result.projectId}_Financial_Report.pptx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      if (!result.warnings.length || result.warnings[0] === "llm_code_error_retried") {
        toast.success("Presentation downloaded.");
      }
    } catch {
      toast.error("Failed to generate presentation. Please try again.");
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={!projectId || isPending}
      className={
        className ??
        "flex h-7 items-center gap-1.5 rounded-md border px-3 text-[12px] font-semibold disabled:opacity-50"
      }
      style={style ?? { borderColor: "#E3E6EA", color: "#4F546B", background: "#fff" }}
    >
      {isPending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Presentation className="h-3.5 w-3.5" />
      )}
      {isPending ? "Generating…" : "Export to PPT"}
    </button>
  );
}
