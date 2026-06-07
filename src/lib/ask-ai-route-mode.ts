export type AskAiRouteMode = {
  isForecastRoute: boolean;
  forceOpen: boolean;
  forceExpanded: boolean;
  reserveSidebar: boolean;
  showClose: boolean;
  showCollapse: boolean;
  showAttachment: boolean;
  placeholder: string;
  emptyStateDescription: string;
};

const DEFAULT_EMPTY_STATE =
  "Ask about uploaded PDFs, accepted cells, source-ingestion fields, or the screen you are reviewing.";

const DIAGNOSIS_EMPTY_STATE =
  "Ask about the active model, selected Diagnosis cell, forecast scenario, source evidence, validation blockers, or next workflow action.";

const FORECAST_EMPTY_STATE =
  "Ask about forecasts, normalized growth, outliers, analyst views, sector drivers, scenarios, and assumptions using approved workbook and source context.";

export function askAiRouteModeForPath(routePath: string): AskAiRouteMode {
  const normalized = normalizeRoutePath(routePath);
  const isForecastRoute = normalized === "/forecast";
  const isDiagnosisRoute = normalized.startsWith("/diagnosis/");
  return {
    isForecastRoute,
    forceOpen: isForecastRoute,
    forceExpanded: isForecastRoute,
    reserveSidebar: isForecastRoute,
    showClose: !isForecastRoute,
    showCollapse: !isForecastRoute,
    showAttachment: !isForecastRoute,
    placeholder: isForecastRoute
      ? "Ask for a forecast, normalized CAGR, outlier treatment, analyst view, or scenario assumptions..."
      : isDiagnosisRoute
        ? "Ask about this model, a cell, or an assumption..."
        : "Ask about a PDF, cell, assumption, or source citation...",
    emptyStateDescription: isForecastRoute
      ? FORECAST_EMPTY_STATE
      : isDiagnosisRoute
        ? DIAGNOSIS_EMPTY_STATE
        : DEFAULT_EMPTY_STATE,
  };
}

function normalizeRoutePath(routePath: string): string {
  const clean = routePath.trim();
  if (!clean) return "/";
  return clean.startsWith("/") ? clean : `/${clean}`;
}
