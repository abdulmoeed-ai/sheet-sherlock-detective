export function getAskAiCitationTitle(citation: Record<string, unknown>): string {
  if (citation.kind === "diagnosis_workbook_cell") {
    const label = String(citation.label ?? "Workbook cell");
    const ref = String(citation.cellReference ?? "").trim();
    return ref ? `${label} ${ref}` : label;
  }
  if (citation.kind === "model") {
    return `${String(citation.sheetName ?? "Model")} ${String(citation.cellReference ?? "")}`.trim();
  }
  if (citation.kind === "uploaded_pdf") {
    return String(citation.filename ?? "Uploaded PDF");
  }
  return String(citation.title ?? citation.sourceName ?? citation.kind ?? "Source");
}

export function getAskAiCitationPillLabel(citation: Record<string, unknown>): string {
  const index = citation.index ? `${String(citation.index)} ` : "";
  return `${index}${getAskAiCitationTitle(citation)}`.trim();
}

export function getAskAiCitationDetail(citation: Record<string, unknown>): string {
  if (citation.kind === "diagnosis_workbook_cell") {
    const location = [
      citation.sheetName,
      citation.cellReference,
      citation.rowNumber ? `row ${String(citation.rowNumber)}` : null,
    ]
      .filter(Boolean)
      .map(String)
      .join(" · ");
    const value = citation.currentValue ?? citation.value;
    return [
      `Workbook cell: ${location || "Current diagnosis workbook"}`,
      citation.label ? `Label: ${String(citation.label)}` : null,
      citation.period ? `Period: ${String(citation.period)}` : null,
      value !== undefined && value !== null && value !== "" ? `Value: ${String(value)}` : null,
      citation.formula ? `Formula: ${String(citation.formula)}` : null,
      citation.filename ? `Source PDF: ${String(citation.filename)}` : null,
    ]
      .filter(Boolean)
      .join("\n");
  }

  if (citation.kind === "model") {
    const title = [citation.sheetName, citation.cellReference]
      .filter(Boolean)
      .map(String)
      .join(" ");
    const value = citation.currentValue ?? citation.value;
    return [`Model cell: ${title || "Model evidence"}`, value ? `Value: ${String(value)}` : null]
      .filter(Boolean)
      .join("\n");
  }

  if (citation.kind === "uploaded_pdf") {
    const page = citation.pageNumber ?? citation.page ?? citation.pdfPageIndex;
    return [
      `Uploaded PDF: ${String(citation.filename ?? "Uploaded PDF")}`,
      page ? `Page: ${String(page)}` : null,
      citation.excerpt ? `Excerpt: ${String(citation.excerpt)}` : null,
    ]
      .filter(Boolean)
      .join("\n");
  }

  const source = String(citation.sourceName ?? citation.kind ?? "Source");
  return [
    `Source: ${source}`,
    citation.title ? `Title: ${String(citation.title)}` : null,
    citation.url ? `Website: ${String(citation.url)}` : null,
    citation.excerpt ? `Excerpt: ${String(citation.excerpt)}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export type AskAiCitationPreview =
  | {
      type: "document_page";
      documentId: string;
      pdfPageIndex: number;
      pageLabel: string;
      title: string;
    }
  | {
      type: "external_url";
      url: string;
      title: string;
    };

export function getAskAiCitationPreview(
  citation: Record<string, unknown>,
): AskAiCitationPreview | null {
  const title = getAskAiCitationTitle(citation);
  const url = typeof citation.url === "string" && citation.url.trim() ? citation.url.trim() : null;
  if (url) {
    return { type: "external_url", url, title };
  }

  const documentId =
    typeof citation.documentId === "string" && citation.documentId.trim()
      ? citation.documentId.trim()
      : null;
  if (!documentId) return null;

  const pageValue = citation.pdfPageIndex ?? citation.pageNumber ?? citation.page;
  const pageNumber =
    typeof pageValue === "number" ? pageValue : Number.parseInt(String(pageValue ?? ""), 10);
  if (!Number.isFinite(pageNumber)) return null;

  const isZeroBased = citation.pdfPageIndex !== undefined && citation.pdfPageIndex !== null;
  const pdfPageIndex = Math.max(0, isZeroBased ? pageNumber : pageNumber - 1);
  const pageLabel = String(isZeroBased ? pdfPageIndex + 1 : pageNumber);
  return { type: "document_page", documentId, pdfPageIndex, pageLabel, title };
}
