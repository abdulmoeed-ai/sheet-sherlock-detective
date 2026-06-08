import { describe, expect, it } from "vitest";
import {
  formatForecastConfidenceLabel,
  forecastChartCardClassName,
  forecastChartGridClassName,
  forecastChartMargin,
  forecastChartYAxisProps,
  normalizeForecastAnalysis,
  normalizeForecastVisuals,
} from "./ask-ai-forecast";

describe("normalizeForecastVisuals", () => {
  it("keeps supported chart series with numeric points and filters unsupported data", () => {
    const visuals = normalizeForecastVisuals({
      confidence: "Medium",
      assumptionPills: [
        { label: "Base Case Revenue CAGR", value: "10.4%" },
        "{'label': 'Base Case Net Margin', 'value': '12.0%'}",
        "Demand recovery",
        "",
      ],
      riskCallouts: [
        { label: "Margin pressure", severity: "Medium" },
        { label: "", severity: "High" },
      ],
      chartSeries: [
        {
          id: "revenue-trend",
          title: "Revenue trend",
          metric: "revenue",
          points: [
            { label: "FY2025", value: 10 },
            { label: "FY2026", value: "12.5" },
            { label: "FY2027", value: "n/a" },
          ],
        },
        {
          id: "unsupported",
          title: "Unsupported",
          metric: "gross-margin",
          points: [{ label: "FY2025", value: 20 }],
        },
      ],
    });

    expect(visuals?.confidence).toBe("Medium");
    expect(visuals?.assumptionPills).toEqual([
      { label: "Base Case Revenue CAGR", value: "10.4%" },
      { label: "Base Case Net Margin", value: "12.0%" },
      { label: "Demand recovery" },
    ]);
    expect(visuals?.riskCallouts).toEqual([{ label: "Margin pressure", severity: "Medium" }]);
    expect(visuals?.chartSeries).toEqual([
      {
        id: "revenue-trend",
        title: "Revenue trend",
        metric: "revenue",
        points: [
          { label: "FY2025", value: 10 },
          { label: "FY2026", value: 12.5 },
        ],
      },
    ]);
  });

  it("returns null when no valid forecast visual data exists", () => {
    expect(normalizeForecastVisuals({ chartSeries: [] })).toBeNull();
    expect(normalizeForecastVisuals(null)).toBeNull();
  });
});

describe("forecast chart layout", () => {
  it("centers and enlarges a single forecast chart", () => {
    expect(forecastChartGridClassName(1)).toContain("justify-items-center");
    expect(forecastChartGridClassName(1)).not.toContain("md:grid-cols-2");
    expect(forecastChartCardClassName(1)).toContain("w-full");
    expect(forecastChartCardClassName(1)).toContain("max-w-[820px]");
  });

  it("reserves left padding for readable Y-axis labels", () => {
    expect(forecastChartMargin.left).toBeGreaterThan(0);
    expect(forecastChartYAxisProps.width).toBeGreaterThanOrEqual(56);
    expect(forecastChartYAxisProps.tickMargin).toBeGreaterThanOrEqual(8);
  });
});

describe("normalizeForecastAnalysis", () => {
  it("keeps historical, CAGR, scenario, forecast set, and missing-input metadata", () => {
    const analysis = normalizeForecastAnalysis({
      mode: "normalized_cagr",
      metric: "revenue",
      unit: "PKR billion",
      forecastHorizon: 5,
      historicalSeries: [
        {
          period: "FY2024",
          value: "95.0",
          citationIndexes: [1],
          treatment: "excluded",
          reason: "Boom year",
        },
        { period: "FY2025", value: 53.3, citationIndexes: [2], treatment: "included" },
        { period: "", value: "n/a", citationIndexes: [] },
      ],
      cagrResults: [
        {
          label: "FY2021 to FY2025 CAGR",
          startPeriod: "FY2021",
          endPeriod: "FY2025",
          value: "0.039",
          basis: "normalized",
        },
      ],
      normalizedBase: {
        mean: "50.275",
        median: "50.2",
        selectedValue: 50.2,
        citationIndexes: [2, 3],
      },
      scenarioTable: [
        {
          scenario: "Base",
          values: { FY2026: "55.9", FY2027: 58.7 },
          basis: "Normalized trend",
          citationIndexes: [2],
        },
      ],
      forecastSets: [
        {
          kind: "trend_only",
          points: { FY2026: 55.9, FY2027: "58.7" },
          basis: "Normalized trend",
        },
      ],
      missingInputs: ["analyst report"],
    });

    expect(analysis?.forecastHorizon).toBe(5);
    expect(analysis?.historicalSeries).toEqual([
      {
        period: "FY2024",
        value: 95,
        citationIndexes: [1],
        treatment: "excluded",
        reason: "Boom year",
      },
      {
        period: "FY2025",
        value: 53.3,
        citationIndexes: [2],
        treatment: "included",
      },
    ]);
    expect(analysis?.cagrResults[0].basis).toBe("normalized");
    expect(analysis?.normalizedBase?.median).toBe(50.2);
    expect(analysis?.scenarioTable[0].scenario).toBe("Base");
    expect(analysis?.forecastSets[0].kind).toBe("trend_only");
    expect(analysis?.missingInputs).toEqual(["analyst report"]);
  });

  it("returns null when no valid forecast analysis data exists", () => {
    expect(normalizeForecastAnalysis({ historicalSeries: [], scenarioTable: [] })).toBeNull();
    expect(normalizeForecastAnalysis(null)).toBeNull();
  });
});

describe("formatForecastConfidenceLabel", () => {
  it("formats decimal confidence as a whole-number percentage", () => {
    expect(formatForecastConfidenceLabel("0.85")).toBe("85%");
    expect(formatForecastConfidenceLabel("85% confidence")).toBe("85%");
    expect(formatForecastConfidenceLabel("Medium")).toBe("Medium");
  });
});
