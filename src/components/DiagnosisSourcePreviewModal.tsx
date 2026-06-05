import { useEffect, useMemo, useState, type ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  AlertCircle,
  ExternalLink,
  Loader2,
  Maximize2,
  Minimize2,
  RotateCcw,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  Dialog,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/dialog";
import { IconTooltip } from "@/components/IconTooltip";
import { readDocumentPageImage } from "@/lib/api/projects";

export type SourceBoundingBox =
  | [number, number, number, number]
  | { x?: number | null; y?: number | null; width?: number | null; height?: number | null };

export type DiagnosisSourcePreview = {
  projectId: string;
  documentId: string;
  documentFilename: string;
  pdfPageIndex: number;
  printedPageNumber?: number | null;
  label?: string | null;
  value?: string | null;
  confidence?: number | null;
  sourceText?: string | null;
  boundingBox?: SourceBoundingBox | null;
};

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.25;

function useDiagnosisSourceImage(enabled: boolean, source: DiagnosisSourcePreview | null) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const projectId = source?.projectId;
  const documentId = source?.documentId;
  const pdfPageIndex = source?.pdfPageIndex;

  useEffect(() => {
    if (!enabled || !projectId || !documentId || pdfPageIndex === undefined) {
      setImageUrl(null);
      setImageError(null);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;
    setImageUrl(null);
    setImageError(null);
    readDocumentPageImage(projectId, documentId, pdfPageIndex)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setImageUrl(objectUrl);
      })
      .catch((error) => {
        if (cancelled) return;
        setImageError(error instanceof Error ? error.message : "Source page unavailable");
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [documentId, enabled, pdfPageIndex, projectId]);

  return { imageUrl, imageError };
}

export function DiagnosisSourceInlinePreview({
  source,
  onExpand,
}: {
  source: DiagnosisSourcePreview;
  onExpand: () => void;
}) {
  const [zoom, setZoom] = useState(0.78);
  const pageLabel = source.printedPageNumber ?? source.pdfPageIndex + 1;
  const bbox = useMemo(() => normalizeBoundingBox(source.boundingBox), [source.boundingBox]);
  const { imageUrl, imageError } = useDiagnosisSourceImage(true, source);

  useEffect(() => {
    setZoom(0.78);
  }, [source.documentId, source.pdfPageIndex]);

  const changeZoom = (nextZoom: number) => {
    setZoom(Math.min(1.6, Math.max(0.45, Number(nextZoom.toFixed(2)))));
  };

  return (
    <section
      className="mt-3 overflow-hidden rounded-lg border bg-white"
      style={{ borderColor: "#D8DEE8" }}
    >
      <div
        className="flex min-h-12 items-center justify-between gap-2 border-b px-3 py-2"
        style={{ borderColor: "#E3E6EA", background: "#F8FAFC" }}
      >
        <div className="min-w-0">
          <div
            className="truncate text-[11px] font-bold uppercase tracking-wide"
            style={{ color: "#64748B" }}
          >
            Source preview
          </div>
          <div className="truncate text-[12px] font-semibold" style={{ color: "#1F2937" }}>
            {source.documentFilename} · Page {pageLabel}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <IconButton
            label="Zoom out"
            onClick={() => changeZoom(zoom - ZOOM_STEP)}
            disabled={zoom <= 0.45}
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton
            label="Zoom in"
            onClick={() => changeZoom(zoom + ZOOM_STEP)}
            disabled={zoom >= 1.6}
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton label="Expand preview" onClick={onExpand}>
            <Maximize2 className="h-3.5 w-3.5" />
          </IconButton>
        </div>
      </div>

      <div className="max-h-[420px] overflow-auto bg-[#F3F4F6] p-3">
        <div
          className="relative mx-auto w-[min(100%,720px)] origin-top"
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: "top center",
            transition: "transform 120ms ease",
          }}
        >
          <div
            className="relative overflow-hidden border bg-white shadow-sm"
            style={{ borderColor: "#CBD5E1" }}
          >
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={`${source.documentFilename} page ${pageLabel}`}
                className="block h-auto w-full"
              />
            ) : (
              <div className="flex h-80 items-center justify-center">
                {imageError ? (
                  <div className="flex items-center gap-2 text-[12px]" style={{ color: "#B91C1C" }}>
                    <AlertCircle className="h-4 w-4" />
                    {imageError}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-[12px]" style={{ color: "#64748B" }}>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading source page
                  </div>
                )}
              </div>
            )}

            {bbox && (
              <div
                aria-label="Highlighted source row"
                className="pointer-events-none absolute"
                style={{
                  left: `${highlightBox(bbox).x}%`,
                  top: `${highlightBox(bbox).y}%`,
                  width: `${highlightBox(bbox).width}%`,
                  height: `${highlightBox(bbox).height}%`,
                  border: "2px solid #DC2626",
                  borderRadius: "6px",
                  background: "rgba(220, 38, 38, 0.09)",
                  boxShadow: "0 0 0 9999px rgba(17, 24, 39, 0.035)",
                }}
              />
            )}
          </div>
        </div>
      </div>

      <div
        className="flex items-center justify-between gap-3 border-t px-3 py-2"
        style={{ borderColor: "#E3E6EA" }}
      >
        <div className="min-w-0 truncate text-[11px]" style={{ color: "#4F546B" }}>
          {bbox ? (
            <>
              <span className="font-semibold" style={{ color: "#DC2626" }}>
                Highlighted row
              </span>
              {source.sourceText ? ` · ${source.sourceText}` : ""}
            </>
          ) : (
            <span className="font-semibold" style={{ color: "#B45309" }}>
              Source row location unavailable
            </span>
          )}
        </div>
        <div className="shrink-0 text-[11px] font-semibold" style={{ color: "#292D34" }}>
          {source.value ?? "-"}
        </div>
      </div>
    </section>
  );
}

export function DiagnosisSourcePreviewModal({
  open,
  onOpenChange,
  source,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: DiagnosisSourcePreview | null;
}) {
  const [zoom, setZoom] = useState(1);
  const pageLabel = source?.printedPageNumber ?? (source ? source.pdfPageIndex + 1 : "-");
  const bbox = useMemo(() => normalizeBoundingBox(source?.boundingBox), [source?.boundingBox]);
  const { imageUrl, imageError } = useDiagnosisSourceImage(open, source);

  useEffect(() => {
    setZoom(1);
  }, [source?.documentId, source?.pdfPageIndex]);

  const changeZoom = (nextZoom: number) => {
    setZoom(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(nextZoom.toFixed(2)))));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content className="fixed left-[50%] top-[50%] z-50 flex h-[88vh] w-[min(1180px,94vw)] translate-x-[-50%] translate-y-[-50%] flex-col overflow-hidden border bg-background shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:rounded-lg">
          <div
            className="flex min-h-14 items-center justify-between gap-3 border-b px-4"
            style={{ borderColor: "#E3E6EA" }}
          >
            <div className="min-w-0">
              <DialogTitle className="truncate text-[14px] font-bold" style={{ color: "#292D34" }}>
                {source?.documentFilename ?? "Source page preview"}
              </DialogTitle>
              <DialogDescription className="truncate text-[12px]" style={{ color: "#818EA0" }}>
                Page {pageLabel} · {source?.label ?? "Selected cell"} ·{" "}
                {confidenceLabel(source?.confidence)}
              </DialogDescription>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <IconButton
                label="Zoom out"
                onClick={() => changeZoom(zoom - ZOOM_STEP)}
                disabled={zoom <= MIN_ZOOM}
              >
                <ZoomOut className="h-4 w-4" />
              </IconButton>
              <span
                className="w-12 text-center text-[12px] font-semibold"
                style={{ color: "#4F546B" }}
              >
                {Math.round(zoom * 100)}%
              </span>
              <IconButton
                label="Zoom in"
                onClick={() => changeZoom(zoom + ZOOM_STEP)}
                disabled={zoom >= MAX_ZOOM}
              >
                <ZoomIn className="h-4 w-4" />
              </IconButton>
              <IconButton label="Reset zoom" onClick={() => changeZoom(1)}>
                <RotateCcw className="h-4 w-4" />
              </IconButton>
              <IconButton label="Fit page" onClick={() => changeZoom(0.85)}>
                <Maximize2 className="h-4 w-4" />
              </IconButton>
              <IconTooltip label="Open image in new tab">
                <a
                  href={imageUrl ?? "#"}
                  target={imageUrl ? "_blank" : undefined}
                  rel={imageUrl ? "noreferrer" : undefined}
                  aria-label="Open image in new tab"
                  className="flex h-8 w-8 items-center justify-center rounded-md border disabled:opacity-50"
                  style={{ borderColor: "#E3E6EA", color: "#4F546B", background: "#fff" }}
                  onClick={(event) => {
                    if (!imageUrl) event.preventDefault();
                  }}
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </IconTooltip>
              <IconButton label="Close preview" onClick={() => onOpenChange(false)}>
                <X className="h-4 w-4" />
              </IconButton>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto bg-[#F3F4F6] p-5">
            <div
              data-testid="source-page-scale"
              className="relative mx-auto w-[min(100%,900px)] origin-top"
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: "top center",
                transition: "transform 120ms ease",
              }}
            >
              <div
                className="relative overflow-hidden border bg-white shadow-sm"
                style={{ borderColor: "#D1D5DB" }}
              >
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={`${source?.documentFilename ?? "Source document"} page ${pageLabel}`}
                    className="block h-auto w-full"
                  />
                ) : (
                  <div className="flex h-[620px] items-center justify-center">
                    {imageError ? (
                      <div
                        className="flex items-center gap-2 text-[13px]"
                        style={{ color: "#B91C1C" }}
                      >
                        <AlertCircle className="h-4 w-4" />
                        {imageError}
                      </div>
                    ) : (
                      <div
                        className="flex items-center gap-2 text-[13px]"
                        style={{ color: "#818EA0" }}
                      >
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading source page
                      </div>
                    )}
                  </div>
                )}

                {bbox && (
                  <div
                    aria-label="Highlighted source row"
                    className="pointer-events-none absolute"
                    style={{
                      left: `${highlightBox(bbox).x}%`,
                      top: `${highlightBox(bbox).y}%`,
                      width: `${highlightBox(bbox).width}%`,
                      height: `${highlightBox(bbox).height}%`,
                      border: "2px solid #DC2626",
                      borderRadius: "6px",
                      background: "rgba(220, 38, 38, 0.09)",
                      boxShadow: "0 0 0 9999px rgba(17, 24, 39, 0.04)",
                    }}
                  />
                )}
              </div>
            </div>
          </div>

          <div
            className="flex min-h-12 items-center justify-between gap-3 border-t px-4"
            style={{ borderColor: "#E3E6EA" }}
          >
            <div className="min-w-0 truncate text-[12px]" style={{ color: "#4F546B" }}>
              {bbox ? (
                <>
                  <span className="font-semibold" style={{ color: "#DC2626" }}>
                    Highlighted row
                  </span>
                  {source?.sourceText ? ` · ${source.sourceText}` : ""}
                </>
              ) : (
                <span className="font-semibold" style={{ color: "#B45309" }}>
                  Source row location unavailable
                </span>
              )}
            </div>
            <div className="shrink-0 text-[12px] font-semibold" style={{ color: "#292D34" }}>
              {source?.value ?? "-"}
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}

const ASK_AI_PANEL_WIDTH = 430;

export function CitationPreviewSidebar({
  source,
  onClose,
  askAiExpanded = false,
  expandedLeft = 0,
}: {
  source: DiagnosisSourcePreview | null;
  onClose: () => void;
  askAiExpanded?: boolean;
  expandedLeft?: number;
}) {
  const [zoom, setZoom] = useState(1);
  const [expanded, setExpanded] = useState(false);
  const pageLabel = source?.printedPageNumber ?? (source ? source.pdfPageIndex + 1 : "-");
  const bbox = useMemo(() => normalizeBoundingBox(source?.boundingBox), [source?.boundingBox]);
  const { imageUrl, imageError } = useDiagnosisSourceImage(source !== null, source);

  useEffect(() => {
    setZoom(1);
    setExpanded(false);
  }, [source?.documentId, source?.pdfPageIndex]);

  const changeZoom = (next: number) => {
    setZoom(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(next.toFixed(2)))));
  };

  if (!source) return null;

  // When Ask AI is expanded (full-screen), sidebar sits on top at the right edge (z-55).
  // When Ask AI is normal width, sidebar sits left of the Ask AI panel (z-40).
  const sidebarStyle: React.CSSProperties = askAiExpanded
    ? {
        right: 0,
        width: expanded ? `calc(100vw - ${expandedLeft}px)` : "400px",
        zIndex: 55,
        borderColor: "#E3E6EA",
        boxShadow: "-8px 0 24px -12px rgba(17,24,39,0.25)",
        transition: "width 180ms ease",
      }
    : {
        right: `${ASK_AI_PANEL_WIDTH}px`,
        width: expanded ? `calc(100vw - ${ASK_AI_PANEL_WIDTH}px)` : "360px",
        zIndex: 40,
        borderColor: "#E3E6EA",
        boxShadow: "-8px 0 24px -12px rgba(17,24,39,0.18)",
        transition: "width 180ms ease",
      };

  return (
    <aside
      className="fixed top-0 flex h-screen flex-col overflow-hidden border-l bg-white"
      style={sidebarStyle}
    >
      {/* Header — row 1: title + close */}
      <div
        className="flex shrink-0 items-center justify-between gap-3 border-b px-4 pt-3 pb-2"
        style={{ borderColor: "#E3E6EA", background: "#F8FAFC" }}
      >
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold" style={{ color: "#1F2937" }}>
            {source.documentFilename}
          </div>
          <div className="mt-0.5 text-[11px]" style={{ color: "#818EA0" }}>
            Page {pageLabel}
            {source.label ? ` · ${source.label}` : ""}
            {source.confidence != null ? ` · ${Math.round(source.confidence)}% confidence` : ""}
          </div>
        </div>
        <IconButton label="Close preview" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </IconButton>
      </div>

      {/* Header — row 2: zoom + expand + external */}
      <div
        className="flex shrink-0 items-center gap-1 border-b px-3 py-1.5"
        style={{ borderColor: "#E3E6EA", background: "#F8FAFC" }}
      >
        <IconButton
          label="Zoom out"
          onClick={() => changeZoom(zoom - ZOOM_STEP)}
          disabled={zoom <= MIN_ZOOM}
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </IconButton>
        <span className="w-10 text-center text-[11px] font-semibold" style={{ color: "#4F546B" }}>
          {Math.round(zoom * 100)}%
        </span>
        <IconButton
          label="Zoom in"
          onClick={() => changeZoom(zoom + ZOOM_STEP)}
          disabled={zoom >= MAX_ZOOM}
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </IconButton>
        <IconButton label="Reset zoom" onClick={() => changeZoom(1)}>
          <RotateCcw className="h-3.5 w-3.5" />
        </IconButton>
        <div className="ml-auto flex items-center gap-1">
          <IconButton
            label={expanded ? "Collapse to sidebar" : "Expand full width"}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
          </IconButton>
          {imageUrl && (
            <IconButton
              label="Open image in new tab"
              onClick={() => window.open(imageUrl, "_blank")}
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </IconButton>
          )}
        </div>
      </div>

      {/* PDF viewer */}
      <div className="min-h-0 flex-1 overflow-auto bg-[#F3F4F6] p-3">
        <div
          className="relative mx-auto w-[min(100%,860px)] origin-top"
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: "top center",
            transition: "transform 120ms ease",
          }}
        >
          <div
            className="relative overflow-hidden border bg-white shadow-sm"
            style={{ borderColor: "#D1D5DB" }}
          >
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={`${source.documentFilename} page ${pageLabel}`}
                className="block h-auto w-full"
              />
            ) : (
              <div className="flex h-[520px] items-center justify-center">
                {imageError ? (
                  <div className="flex items-center gap-2 text-[13px]" style={{ color: "#B91C1C" }}>
                    <AlertCircle className="h-4 w-4" />
                    {imageError}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-[13px]" style={{ color: "#818EA0" }}>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading source page…
                  </div>
                )}
              </div>
            )}

            {bbox && (
              <div
                aria-label="Highlighted source row"
                className="pointer-events-none absolute"
                style={{
                  left: `${highlightBox(bbox).x}%`,
                  top: `${highlightBox(bbox).y}%`,
                  width: `${highlightBox(bbox).width}%`,
                  height: `${highlightBox(bbox).height}%`,
                  border: "2px solid #DC2626",
                  borderRadius: "6px",
                  background: "rgba(220,38,38,0.09)",
                  boxShadow: "0 0 0 9999px rgba(17,24,39,0.04)",
                }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div
        className="flex shrink-0 min-h-11 items-center justify-between gap-3 border-t px-4"
        style={{ borderColor: "#E3E6EA", background: "#F8FAFC" }}
      >
        <div className="min-w-0 truncate text-[11px]" style={{ color: "#4F546B" }}>
          {bbox ? (
            <>
              <span className="font-semibold" style={{ color: "#DC2626" }}>Highlighted row</span>
              {source.sourceText ? ` · ${source.sourceText}` : ""}
            </>
          ) : (
            <span style={{ color: "#B45309" }}>Source row location unavailable</span>
          )}
        </div>
        {source.value && (
          <div className="shrink-0 text-[11px] font-semibold" style={{ color: "#292D34" }}>
            {source.value}
          </div>
        )}
      </div>
    </aside>
  );
}

function IconButton({
  label,
  children,
  onClick,
  disabled = false,
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <IconTooltip label={label}>
      <button
        type="button"
        aria-label={label}
        onClick={onClick}
        disabled={disabled}
        className="flex h-8 w-8 items-center justify-center rounded-md border disabled:opacity-50"
        style={{ borderColor: "#E3E6EA", color: "#4F546B", background: "#fff" }}
      >
        {children}
      </button>
    </IconTooltip>
  );
}

function normalizeBoundingBox(
  value?: SourceBoundingBox | null,
): [number, number, number, number] | null {
  const parts = Array.isArray(value)
    ? value
    : value && typeof value === "object"
      ? [value.x, value.y, value.width, value.height].map((part) =>
          part === null || part === undefined ? NaN : Number(part) * 100,
        )
      : null;
  if (!parts || parts.length !== 4) return null;
  const [x, y, width, height] = parts.map(Number);
  if ([x, y, width, height].some((part) => Number.isNaN(part))) return null;
  if (width <= 0 || height <= 0) return null;
  return [
    clamp(x, 0, 100),
    clamp(y, 0, 100),
    clamp(width, 0, 100 - clamp(x, 0, 100)),
    clamp(height, 0, 100 - clamp(y, 0, 100)),
  ];
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function highlightBox([x, y, width, height]: [number, number, number, number]) {
  const xPadding = 0.8;
  const yPadding = Math.max(0.55, Math.min(1.2, height * 0.45));
  const nextX = clamp(x - xPadding, 0, 100);
  const nextY = clamp(y - yPadding, 0, 100);
  return {
    x: nextX,
    y: nextY,
    width: clamp(width + xPadding * 2, 0, 100 - nextX),
    height: clamp(height + yPadding * 2, 0, 100 - nextY),
  };
}

function confidenceLabel(value?: number | null) {
  if (value === null || value === undefined) return "Confidence unavailable";
  return `${Math.round(value)}% confidence`;
}
