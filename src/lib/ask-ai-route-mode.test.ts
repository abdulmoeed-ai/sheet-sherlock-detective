import { describe, expect, it } from "vitest";

import { askAiRouteModeForPath } from "./ask-ai-route-mode";

describe("askAiRouteModeForPath", () => {
  it("forces expanded forecast chat and hides close, collapse, and attachment controls", () => {
    expect(askAiRouteModeForPath("/forecast")).toEqual({
      isForecastRoute: true,
      forceOpen: true,
      forceExpanded: true,
      reserveSidebar: true,
      showClose: false,
      showCollapse: false,
      showAttachment: false,
      placeholder: "Ask for a forecast, normalized CAGR, outlier treatment, analyst view, or scenario assumptions...",
      emptyStateDescription:
        "Ask about forecasts, normalized growth, outliers, analyst views, sector drivers, scenarios, and assumptions using approved workbook and source context.",
    });
  });

  it("keeps normal Ask AI controls on non-forecast routes", () => {
    expect(askAiRouteModeForPath("/diagnosis/project-1")).toMatchObject({
      isForecastRoute: false,
      forceOpen: false,
      forceExpanded: false,
      reserveSidebar: false,
      showClose: true,
      showCollapse: true,
      showAttachment: true,
    });
  });
});
