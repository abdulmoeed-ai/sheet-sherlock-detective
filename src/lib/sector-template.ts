/**
 * Maps a PSX company sector string to the correct Excel template filename.
 * Matching is case-insensitive and uses substring checks to handle PSX naming variants.
 */

export type SectorTemplate =
  | "Millat - Template.xlsx"
  | "Cement Sector Template Presentation.xlsx"
  | "E&P Sector Template Presentation.xlsx";

const CEMENT_TEMPLATE: SectorTemplate = "Cement Sector Template Presentation.xlsx";
const EP_TEMPLATE: SectorTemplate = "E&P Sector Template Presentation.xlsx";
const DEFAULT_TEMPLATE: SectorTemplate = "Millat - Template.xlsx";

export function templateForSector(sector: string | null | undefined): SectorTemplate {
  if (!sector) return DEFAULT_TEMPLATE;
  const s = sector.toLowerCase();

  if (s.includes("cement")) return CEMENT_TEMPLATE;

  if (
    s.includes("e&p") ||
    s.includes("exploration") ||
    s.includes("oil & gas") ||
    s.includes("oil and gas")
  ) {
    return EP_TEMPLATE;
  }

  return DEFAULT_TEMPLATE;
}

export const TEMPLATE_LABELS: Record<string, string> = {
  [DEFAULT_TEMPLATE]: "Engineering & Industrials",
  [CEMENT_TEMPLATE]: "Cement",
  [EP_TEMPLATE]: "E&P (Oil & Gas Exploration)",
};
