import { describe, expect, it } from "bun:test";

import { templateForSector } from "./sector-template";

describe("templateForSector", () => {
  it("uses Cement template for Cement sector companies", () => {
    expect(templateForSector("Cement")).toBe("Cement Sector Template Presentation.xlsx");
    expect(templateForSector("CEMENT")).toBe("Cement Sector Template Presentation.xlsx");
  });

  it("uses E&P template for oil and gas exploration sectors", () => {
    expect(templateForSector("Oil & Gas Exploration")).toBe("E&P Sector Template Presentation.xlsx");
    expect(templateForSector("Oil and Gas Marketing")).toBe("E&P Sector Template Presentation.xlsx");
  });

  it("falls back to Millat template for other sectors", () => {
    expect(templateForSector("Engineering & Industrials")).toBe("Millat - Template.xlsx");
  });
});
