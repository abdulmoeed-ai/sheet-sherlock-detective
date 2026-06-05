export const RIGHT_PANEL_DEFAULT_WIDTH = 380;
export const RIGHT_PANEL_MIN_WIDTH = 320;
export const RIGHT_PANEL_MAX_WIDTH = 920;
export const WORKBOOK_PANEL_MIN_WIDTH = 280;

const RIGHT_PANEL_WIDTH_KEY = "diagnosis-right-panel-width";

export function clampDiagnosisRightPanelWidth(
  width: number | null | undefined,
  containerWidth?: number,
) {
  const rawWidth =
    typeof width === "number" && Number.isFinite(width) ? width : RIGHT_PANEL_DEFAULT_WIDTH;

  const minWidth = containerWidth
    ? Math.min(RIGHT_PANEL_MIN_WIDTH, Math.max(240, containerWidth - WORKBOOK_PANEL_MIN_WIDTH))
    : RIGHT_PANEL_MIN_WIDTH;
  const maxWidth = containerWidth
    ? Math.min(RIGHT_PANEL_MAX_WIDTH, Math.max(minWidth, containerWidth - WORKBOOK_PANEL_MIN_WIDTH))
    : RIGHT_PANEL_MAX_WIDTH;

  return Math.min(maxWidth, Math.max(minWidth, rawWidth));
}

export function readDiagnosisRightPanelWidth() {
  if (typeof window === "undefined") return RIGHT_PANEL_DEFAULT_WIDTH;
  return clampDiagnosisRightPanelWidth(Number(window.localStorage.getItem(RIGHT_PANEL_WIDTH_KEY)));
}

export function persistDiagnosisRightPanelWidth(width: number) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(RIGHT_PANEL_WIDTH_KEY, String(clampDiagnosisRightPanelWidth(width)));
}
