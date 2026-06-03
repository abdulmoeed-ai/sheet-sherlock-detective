import { describe, expect, it } from "vitest";
import { normalizeForecastVisuals } from "./ask-ai-forecast";

describe("normalizeForecastVisuals", () => {
  it("keeps supported chart series with numeric points and filters unsupported data", () => {
    const visuals = normalizeForecastVisuals({
      confidence: "Medium",
      assumptionPills: ["Demand recovery", ""],
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
    expect(visuals?.assumptionPills).toEqual(["Demand recovery"]);
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
