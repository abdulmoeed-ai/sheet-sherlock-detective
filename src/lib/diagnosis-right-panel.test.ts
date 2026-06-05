import { afterEach, describe, expect, it } from "vitest";
import {
  clampDiagnosisRightPanelWidth,
  persistDiagnosisRightPanelWidth,
  readDiagnosisRightPanelWidth,
} from "./diagnosis-right-panel";

describe("diagnosis right panel sizing", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it("clamps saved panel widths to the supported desktop range", () => {
    expect(clampDiagnosisRightPanelWidth(200)).toBe(320);
    expect(clampDiagnosisRightPanelWidth(420)).toBe(420);
    expect(clampDiagnosisRightPanelWidth(800)).toBe(800);
    expect(clampDiagnosisRightPanelWidth(1200)).toBe(920);
    expect(clampDiagnosisRightPanelWidth(Number.NaN)).toBe(380);
  });

  it("keeps the panel readable on narrow containers", () => {
    expect(clampDiagnosisRightPanelWidth(380, 390)).toBe(240);
    expect(clampDiagnosisRightPanelWidth(Number.NaN, 390)).toBe(240);
  });

  it("persists a clamped diagnosis panel width", () => {
    persistDiagnosisRightPanelWidth(1200);

    expect(readDiagnosisRightPanelWidth()).toBe(920);
    expect(window.localStorage.getItem("diagnosis-right-panel-width")).toBe("920");
  });
});
