import type {
  AskAiForecastAnalysis,
  AskAiForecastAssumptionPill,
  AskAiForecastAssumption,
  AskAiForecastCagrResult,
  AskAiForecastChartSeries,
  AskAiForecastHistoricalSeriesItem,
  AskAiForecastNormalizedBase,
  AskAiForecastScenarioRow,
  AskAiForecastSet,
  AskAiForecastVisuals,
  AskAiRiskCallout,
} from "@/lib/api/ask-ai-stream";

const SUPPORTED_METRICS = new Set(["revenue", "eps", "share_price", "pe_vs_sector"]);

export function normalizeForecastVisuals(value: unknown): AskAiForecastVisuals | null {
  if (!isRecord(value)) return null;
  const chartSeries = normalizeChartSeries(value.chartSeries);
  const assumptionPills = normalizeAssumptionPills(value.assumptionPills);
  const riskCallouts = normalizeRiskCallouts(value.riskCallouts);
  const confidence = stringValue(value.confidence);
  const executiveSummary = stringList(value.executiveSummary, 3);
  if (
    chartSeries.length === 0 &&
    assumptionPills.length === 0 &&
    riskCallouts.length === 0 &&
    !confidence
  ) {
    return null;
  }
  return {
    chartSeries,
    assumptionPills,
    riskCallouts,
    ...(confidence ? { confidence } : {}),
    ...(executiveSummary.length > 0 ? { executiveSummary } : {}),
  };
}

export function normalizeForecastAnalysis(value: unknown): AskAiForecastAnalysis | null {
  if (!isRecord(value)) return null;
  const historicalSeries = normalizeHistoricalSeries(value.historicalSeries);
  const cagrResults = normalizeCagrResults(value.cagrResults);
  const normalizedBase = normalizeNormalizedBase(value.normalizedBase);
  const scenarioTable = normalizeScenarioTable(value.scenarioTable);
  const forecastSets = normalizeForecastSets(value.forecastSets);
  const assumptions = normalizeAssumptions(value.assumptions);
  const missingInputs = stringList(value.missingInputs, 10);
  const forecastHorizon = positiveInteger(value.forecastHorizon);
  const mode = stringValue(value.mode);
  const metric = stringValue(value.metric);
  const unit = stringValue(value.unit);
  const hasContent =
    historicalSeries.length > 0 ||
    cagrResults.length > 0 ||
    scenarioTable.length > 0 ||
    forecastSets.length > 0 ||
    assumptions.length > 0 ||
    missingInputs.length > 0 ||
    normalizedBase !== undefined ||
    forecastHorizon !== null;
  if (!hasContent) return null;
  return {
    historicalSeries,
    cagrResults,
    scenarioTable,
    forecastSets,
    assumptions,
    missingInputs,
    ...(normalizedBase ? { normalizedBase } : {}),
    ...(forecastHorizon !== null ? { forecastHorizon } : {}),
    ...(mode ? { mode } : {}),
    ...(metric ? { metric } : {}),
    ...(unit ? { unit } : {}),
  };
}

export function formatForecastConfidenceLabel(value: string): string {
  const text = value.trim().replace(/\s+confidence$/i, "");
  const numericValue = Number(text.replace(/%$/, ""));
  if (!Number.isFinite(numericValue)) return text;
  const percentValue = text.endsWith("%") || numericValue > 1 ? numericValue : numericValue * 100;
  return `${Math.round(percentValue)}%`;
}

export function forecastChartGridClassName(chartCount: number) {
  return chartCount === 1 ? "grid justify-items-center gap-3" : "grid gap-3 md:grid-cols-2";
}

export function forecastChartCardClassName(chartCount: number) {
  const base = "min-w-0 rounded-lg border bg-white p-3";
  return chartCount === 1 ? `${base} w-full max-w-[820px]` : `${base} w-full`;
}

export function forecastChartContainerClassName(chartCount: number) {
  return chartCount === 1
    ? "h-[260px] min-h-[260px] w-full aspect-auto"
    : "h-[190px] min-h-[190px] w-full aspect-auto";
}

export const forecastChartMargin = { left: 14, right: 14, top: 10, bottom: 0 } as const;

export const forecastChartYAxisProps = { width: 62, tickMargin: 10 } as const;

function normalizeChartSeries(value: unknown): AskAiForecastChartSeries[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index): AskAiForecastChartSeries | null => {
      if (!isRecord(item)) return null;
      const metric = stringValue(item.metric);
      if (!metric || !SUPPORTED_METRICS.has(metric)) return null;
      const points = Array.isArray(item.points)
        ? item.points
            .map((point) => {
              if (!isRecord(point)) return null;
              const label = stringValue(point.label ?? point.year ?? point.period);
              const numericValue = numberValue(point.value);
              return label && numericValue !== null ? { label, value: numericValue } : null;
            })
            .filter((point): point is { label: string; value: number } => point !== null)
            .slice(0, 12)
        : [];
      if (points.length < 2) return null;
      return {
        id: stringValue(item.id) ?? `${metric}-${index + 1}`,
        title: stringValue(item.title) ?? titleForMetric(metric),
        metric,
        points,
      };
    })
    .filter((series): series is AskAiForecastChartSeries => series !== null)
    .slice(0, 4);
}

function normalizeRiskCallouts(value: unknown): AskAiRiskCallout[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item): AskAiRiskCallout | null => {
      if (!isRecord(item)) return null;
      const label = stringValue(item.label ?? item.risk);
      const severity = stringValue(item.severity);
      if (!label || !severity || !["High", "Medium", "Low"].includes(severity)) return null;
      return { label, severity: severity as AskAiRiskCallout["severity"] };
    })
    .filter((risk): risk is AskAiRiskCallout => risk !== null)
    .slice(0, 5);
}

function normalizeHistoricalSeries(value: unknown): AskAiForecastHistoricalSeriesItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item): AskAiForecastHistoricalSeriesItem | null => {
      if (!isRecord(item)) return null;
      const period = stringValue(item.period);
      const numericValue = numberValue(item.value);
      if (!period || numericValue === null) return null;
      const treatment = stringValue(item.treatment);
      const safeTreatment =
        treatment === "excluded" || treatment === "review" || treatment === "included"
          ? treatment
          : "included";
      const reason = stringValue(item.reason);
      return {
        period,
        value: numericValue,
        citationIndexes: citationIndexes(item.citationIndexes),
        treatment: safeTreatment,
        ...(reason ? { reason } : {}),
      };
    })
    .filter((item): item is AskAiForecastHistoricalSeriesItem => item !== null)
    .slice(0, 12);
}

function normalizeCagrResults(value: unknown): AskAiForecastCagrResult[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item): AskAiForecastCagrResult | null => {
      if (!isRecord(item)) return null;
      const label = stringValue(item.label);
      const startPeriod = stringValue(item.startPeriod);
      const endPeriod = stringValue(item.endPeriod);
      const numericValue = numberValue(item.value);
      const basis = stringValue(item.basis);
      if (!label || !startPeriod || !endPeriod || numericValue === null || !basis) return null;
      return { label, startPeriod, endPeriod, value: numericValue, basis };
    })
    .filter((item): item is AskAiForecastCagrResult => item !== null)
    .slice(0, 8);
}

function normalizeNormalizedBase(value: unknown): AskAiForecastNormalizedBase | undefined {
  if (!isRecord(value)) return undefined;
  const mean = numberValue(value.mean);
  const median = numberValue(value.median);
  const selectedValue = numberValue(value.selectedValue);
  const citationIndexList = citationIndexes(value.citationIndexes);
  if (
    mean === null &&
    median === null &&
    selectedValue === null &&
    citationIndexList.length === 0
  ) {
    return undefined;
  }
  return {
    ...(mean !== null ? { mean } : {}),
    ...(median !== null ? { median } : {}),
    ...(selectedValue !== null ? { selectedValue } : {}),
    citationIndexes: citationIndexList,
  };
}

function normalizeScenarioTable(value: unknown): AskAiForecastScenarioRow[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item): AskAiForecastScenarioRow | null => {
      if (!isRecord(item)) return null;
      const scenario = stringValue(item.scenario);
      const values = recordValues(item.values);
      if (!scenario || Object.keys(values).length === 0) return null;
      return {
        scenario,
        values,
        basis: stringValue(item.basis) ?? "",
        citationIndexes: citationIndexes(item.citationIndexes),
      };
    })
    .filter((item): item is AskAiForecastScenarioRow => item !== null)
    .slice(0, 6);
}

function normalizeForecastSets(value: unknown): AskAiForecastSet[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item): AskAiForecastSet | null => {
      if (!isRecord(item)) return null;
      const kind = stringValue(item.kind);
      const points = numericRecord(item.points);
      if (!kind || Object.keys(points).length === 0) return null;
      return { kind, points, basis: stringValue(item.basis) ?? "" };
    })
    .filter((item): item is AskAiForecastSet => item !== null)
    .slice(0, 4);
}

function normalizeAssumptions(value: unknown): AskAiForecastAssumption[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item): AskAiForecastAssumption | null => {
      if (!isRecord(item)) return null;
      const label = stringValue(item.label);
      const textValue = stringValue(item.value);
      if (!label || !textValue) return null;
      const scenario = stringValue(item.scenario);
      return {
        label,
        value: textValue,
        citationIndexes: citationIndexes(item.citationIndexes),
        ...(scenario ? { scenario } : {}),
      };
    })
    .filter((item): item is AskAiForecastAssumption => item !== null)
    .slice(0, 12);
}

function normalizeAssumptionPills(value: unknown): AskAiForecastAssumptionPill[] {
  const raw = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  const result: AskAiForecastAssumptionPill[] = [];
  for (const item of raw) {
    const pill = assumptionPillValue(item);
    if (!pill) continue;
    const exists = result.some(
      (current) => current.label === pill.label && (current.value ?? "") === (pill.value ?? ""),
    );
    if (!exists) result.push(pill);
    if (result.length >= 6) break;
  }
  return result;
}

function assumptionPillValue(value: unknown): AskAiForecastAssumptionPill | null {
  if (isRecord(value)) {
    const label = stringValue(value.label);
    const textValue = stringValue(value.value);
    if (!label && !textValue) return null;
    return {
      label: label ?? textValue ?? "",
      ...(label && textValue ? { value: textValue } : {}),
    };
  }
  const text = stringValue(value);
  if (!text) return null;
  const parsed = parseSerializedAssumptionPill(text);
  return parsed ?? { label: text };
}

function parseSerializedAssumptionPill(value: string): AskAiForecastAssumptionPill | null {
  const normalizedJson = value.replace(/'/g, '"');
  try {
    const parsed: unknown = JSON.parse(normalizedJson);
    return isRecord(parsed) ? assumptionPillValue(parsed) : null;
  } catch {
    const label = value.match(/["']label["']\s*:\s*["']([^"']+)["']/)?.[1];
    const textValue = value.match(/["']value["']\s*:\s*["']([^"']+)["']/)?.[1];
    if (!label && !textValue) return null;
    return {
      label: label ?? textValue ?? "",
      ...(label && textValue ? { value: textValue } : {}),
    };
  }
}

function stringList(value: unknown, limit: number): string[] {
  const raw = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  const result: string[] = [];
  for (const item of raw) {
    const text = stringValue(item);
    if (text && !result.includes(text)) result.push(text);
    if (result.length >= limit) break;
  }
  return result;
}

function stringValue(value: unknown): string | null {
  const text = String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
  return text ? text : null;
}

function numberValue(value: unknown): number | null {
  const number = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(number) ? number : null;
}

function positiveInteger(value: unknown): number | null {
  const number = numberValue(value);
  if (number === null || number <= 0) return null;
  return Math.trunc(number);
}

function citationIndexes(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const result: number[] = [];
  for (const item of value) {
    const number = positiveInteger(item);
    if (number !== null && !result.includes(number)) result.push(number);
    if (result.length >= 8) break;
  }
  return result;
}

function recordValues(value: unknown): Record<string, number | string> {
  if (!isRecord(value)) return {};
  const result: Record<string, number | string> = {};
  for (const [key, rawValue] of Object.entries(value).slice(0, 10)) {
    const label = stringValue(key);
    if (!label) continue;
    const numericValue = numberValue(rawValue);
    result[label] = numericValue ?? String(rawValue ?? "");
  }
  return result;
}

function numericRecord(value: unknown): Record<string, number> {
  if (!isRecord(value)) return {};
  const result: Record<string, number> = {};
  for (const [key, rawValue] of Object.entries(value).slice(0, 10)) {
    const label = stringValue(key);
    const numericValue = numberValue(rawValue);
    if (!label || numericValue === null) continue;
    result[label] = numericValue;
  }
  return result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function titleForMetric(metric: string): string {
  if (metric === "revenue") return "Revenue trend";
  if (metric === "eps") return "EPS trend";
  if (metric === "share_price") return "Share price trend";
  if (metric === "pe_vs_sector") return "Company P/E vs sector P/E";
  return "Forecast chart";
}
