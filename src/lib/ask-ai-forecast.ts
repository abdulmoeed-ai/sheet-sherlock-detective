import type { AskAiForecastVisuals, AskAiForecastChartSeries, AskAiRiskCallout } from "@/lib/api/ask-ai-stream";

const SUPPORTED_METRICS = new Set(["revenue", "eps", "share_price", "pe_vs_sector"]);

export function normalizeForecastVisuals(value: unknown): AskAiForecastVisuals | null {
  if (!isRecord(value)) return null;
  const chartSeries = normalizeChartSeries(value.chartSeries);
  const assumptionPills = stringList(value.assumptionPills, 6);
  const riskCallouts = normalizeRiskCallouts(value.riskCallouts);
  const confidence = stringValue(value.confidence);
  const executiveSummary = stringList(value.executiveSummary, 3);
  if (chartSeries.length === 0 && assumptionPills.length === 0 && riskCallouts.length === 0 && !confidence) {
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
  const text = String(value ?? "").trim().replace(/\s+/g, " ");
  return text ? text : null;
}

function numberValue(value: unknown): number | null {
  const number = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(number) ? number : null;
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
