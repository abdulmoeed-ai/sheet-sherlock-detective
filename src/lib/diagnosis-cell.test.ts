import { describe, expect, it } from "vitest";
import {
  buildExportWarningSummary,
  canRevertReviewHistoryEntry,
  diagnosisCellTone,
  formatLlmReview,
  formatTermStandardization,
  formatHistoryEntry,
  formatHistoryTimestamp,
  historyValue,
  isActionableWarningSet,
  orderedHistoryEntries,
  ruleTooltipDetails,
  sheetNeedsAttention,
  shouldCommitCellDraftOnKey,
  warningDetails,
  workbookPayloadDisplayValue,
  workbookRevisionHistoryEntry,
} from "./diagnosis-cell";

describe("diagnosis cell helpers", () => {
  it("prioritizes warning cells over low confidence", () => {
    expect(
      diagnosisCellTone({
        formula: false,
        status: "pending",
        confidence: 95,
        hasWarning: true,
      }),
    ).toBe("candidate");
  });

  it("marks low-confidence, edited, and formula cells distinctly", () => {
    expect(diagnosisCellTone({ formula: false, status: "pending", confidence: 65 })).toBe("low-confidence");
    expect(diagnosisCellTone({ formula: false, status: "edited", confidence: 95 })).toBe("edited");
    expect(diagnosisCellTone({ formula: true, status: "pending", confidence: 95 })).toBe("formula");
  });

  it("derives workbook tone from backend confidence level before local score heuristics", () => {
    expect(diagnosisCellTone({ formula: false, status: "pending", confidence: 98, confidenceLevel: "medium" })).toBe(
      "medium-confidence",
    );
    expect(diagnosisCellTone({ formula: false, status: "pending", confidence: 98, confidenceLevel: "blocked" })).toBe(
      "blocked-confidence",
    );
    expect(diagnosisCellTone({ formula: false, status: "pending", confidence: 98, confidenceLevel: "low" })).toBe(
      "low-confidence",
    );
    expect(diagnosisCellTone({ formula: false, status: "pending", confidence: 98, confidenceLevel: "high" })).toBe(
      "high-confidence",
    );
  });

  it("builds export warning summaries from unresolved backend confidence states", () => {
    expect(
      buildExportWarningSummary([
        { diagnosis: { confidenceLevel: "high", warnings: [] } },
        { diagnosis: { confidenceLevel: "low", warnings: ["note_subtotal_reconciliation"] } },
        { diagnosis: { confidenceLevel: "blocked", warnings: [] } },
        {},
      ]),
    ).toEqual({
      unresolvedIssues: 3,
      lowConfidence: 1,
      blocked: 1,
      missing: 1,
      actionableWarnings: 1,
    });
  });

  it("extracts a revertable value from history entries", () => {
    expect(historyValue({ value: "10", newValue: "11" })).toBe("10");
    expect(historyValue({ newValue: "11" })).toBe("11");
  });

  it("only allows persisted review history revisions to be reverted", () => {
    expect(canRevertReviewHistoryEntry({ id: "revision-1", action: "edit" })).toBe(true);
    expect(canRevertReviewHistoryEntry({ id: "field-1-optimistic-1780693774190", action: "edit" })).toBe(false);
    expect(canRevertReviewHistoryEntry({ id: "field-1-source", action: "source" })).toBe(false);
    expect(canRevertReviewHistoryEntry({ id: "revision-2", action: "revert" })).toBe(false);
    expect(canRevertReviewHistoryEntry({ action: "edit" })).toBe(false);
  });

  it("formats workbook revision payloads for manual-cell history", () => {
    expect(workbookPayloadDisplayValue(null)).toBe("-");
    expect(workbookPayloadDisplayValue({ v: 2500 })).toBe("2,500");
    expect(workbookPayloadDisplayValue({ f: "SUM(A1:A2)", v: null })).toBe("=SUM(A1:A2)");

    expect(
      workbookRevisionHistoryEntry({
        id: "revision-1",
        actor: "analyst-1",
        actorName: "Dev Finance Analyst",
        action: "edit",
        oldPayload: null,
        newPayload: { v: "Manual input" },
        createdAt: "2026-06-04T08:00:00Z",
      }),
    ).toEqual({
      id: "revision-1",
      action: "edit",
      actor: "analyst-1",
      actorDisplayName: "Dev Finance Analyst",
      oldValue: "-",
      newValue: "Manual input",
      note: "Saved from workbook editor.",
      createdAt: "2026-06-04T08:00:00Z",
    });
  });

  it("formats source, edit, and revert history entries for analysts", () => {
    expect(formatHistoryEntry({ action: "source", value: "(85)" }).title).toBe("Source extraction: -85");

    const editEntry = formatHistoryEntry({
      action: "edit",
      actorDisplayName: "Dev Finance Analyst",
      oldValue: "(85)",
      newValue: "(86)",
      note: "Saved from Diagnosis draft.",
      createdAt: "2026-06-02T09:35:00",
    });
    expect(editEntry.title).toBe("Dev Finance Analyst changed -85 -> -86");
    expect(editEntry.meta).toContain("Jun 2, 2026");
    expect(editEntry.meta).toContain("9:35 AM");
    expect(editEntry.note).toBe("Saved from Diagnosis draft.");

    expect(
      formatHistoryEntry({
        action: "revert",
        actor: "analyst-1",
        oldValue: "(86)",
        newValue: "(85)",
      }).title,
    ).toBe("analyst-1 reverted -86 -> -85");
  });

  it("handles missing actors and invalid timestamps in history formatting", () => {
    expect(
      formatHistoryEntry({
        action: "edit",
        oldValue: "120",
        newValue: "121",
        createdAt: "not-a-date",
      }),
    ).toEqual({
      title: "Analyst changed 120 -> 121",
      meta: "",
      note: "",
    });

    expect(formatHistoryTimestamp(null)).toBe("");
  });

  it("uses the current user name when backend history only has the actor id", () => {
    expect(
      formatHistoryEntry(
        {
          action: "edit",
          actor: "10b5b347-8e8f-41e0-97c5-1847893d04ef",
          oldValue: "(85)",
          newValue: "(86)",
        },
        {
          currentUser: {
            id: "10b5b347-8e8f-41e0-97c5-1847893d04ef",
            name: "Dev Finance Analyst",
          },
        },
      ).title,
    ).toBe("Dev Finance Analyst changed -85 -> -86");
  });

  it("commits an edited cell draft on Enter only when there is a value to save", () => {
    expect(shouldCommitCellDraftOnKey({ key: "Enter", draftValue: "-86", editable: true, pending: false })).toBe(true);
    expect(shouldCommitCellDraftOnKey({ key: "Tab", draftValue: "-86", editable: true, pending: false })).toBe(false);
    expect(shouldCommitCellDraftOnKey({ key: "Enter", draftValue: "   ", editable: true, pending: false })).toBe(false);
    expect(shouldCommitCellDraftOnKey({ key: "Enter", draftValue: "-86", editable: false, pending: false })).toBe(false);
    expect(shouldCommitCellDraftOnKey({ key: "Enter", draftValue: "-86", editable: true, pending: true })).toBe(false);
  });

  it("orders history with the most recent analyst activity first and source extraction last", () => {
    const history = [
      { id: "field-source", action: "source", createdAt: "2026-06-01T08:50:00Z" },
      { id: "edit-1", action: "edit", createdAt: "2026-06-02T04:35:00Z" },
      { id: "edit-2", action: "edit", createdAt: "2026-06-02T05:10:00Z" },
    ];

    expect(orderedHistoryEntries(history).map((entry) => entry.id)).toEqual(["edit-2", "edit-1", "field-source"]);
  });

  it("formats comparative-year warnings as informational provenance", () => {
    expect(warningDetails("comparative_year")).toEqual({
      label: "Comparative-year source column",
      description: "This value was extracted from the prior-year/comparative column in the PDF table. It is informational, not an error.",
      actionable: false,
    });
    expect(warningDetails("note_subtotal_reconciliation")).toEqual({
      label: "Note subtotal reconciliation",
      description: "Review this extraction warning before sign-off.",
      actionable: true,
    });
  });

  it("formats AI warnings and review metadata", () => {
    expect(warningDetails("llm.accepted_after_validation")).toEqual({
      label: "AI accepted after validation",
      description: "AI reviewed this ambiguous row and deterministic checks accepted the recommendation.",
      actionable: false,
    });
    expect(warningDetails("llm.rejected_wrong_section").actionable).toBe(true);

    expect(
      formatLlmReview({
        decision: "accept",
        validationStatus: "accepted",
        recommendedValue: "0",
        reason: "Dash source evidence.",
        provider: "google-genai",
        model: "gemini-3.5-flash",
        riskFlags: ["dash_zero"],
      }),
    ).toEqual({
      decision: "accept",
      validationStatus: "accepted",
      recommendedValue: "0",
      reason: "Dash source evidence.",
      provider: "google-genai",
      model: "gemini-3.5-flash",
      riskFlags: ["dash_zero"],
    });
  });

  it("formats term standardization warnings and metadata", () => {
    expect(warningDetails("llm.term_standardization_requires_review")).toEqual({
      label: "Term mapping needs review",
      description: "AI found a likely standardized financial term, but analyst review is required.",
      actionable: true,
    });
    expect(warningDetails("llm.term_standardized_after_validation").actionable).toBe(false);

    expect(
      formatTermStandardization({
        decision: "match",
        validationStatus: "requires_review",
        canonicalFinancialTerm: "Goods Cost",
        standardizedFromLabel: "Cost of Goods",
        standardizedToLabel: "Goods Cost",
        confidence: 0.84,
        reason: "Equivalent finance term.",
        provider: "google-genai",
        model: "gemini-3.5-flash",
        riskFlags: ["term.medium_confidence_requires_review"],
        mappingRules: [
          {
            ruleCode: "C3",
            status: "warning",
            severity: "Advisory",
            message: "Movement schedule component mapped.",
          },
        ],
        mappingRuleCautionIds: ["C3"],
        competingSourceValues: [{ sourceDocumentId: "older.pdf", value: "100" }],
      }),
    ).toEqual({
      decision: "match",
      validationStatus: "requires_review",
      canonicalFinancialTerm: "Goods Cost",
      standardizedFromLabel: "Cost of Goods",
      standardizedToLabel: "Goods Cost",
      confidence: "0.84",
      reason: "Equivalent finance term.",
      provider: "google-genai",
      model: "gemini-3.5-flash",
      riskFlags: ["term.medium_confidence_requires_review"],
      mappingRules: [
        {
          ruleCode: "C3",
          status: "warning",
          severity: "Advisory",
          message: "Movement schedule component mapped.",
        },
      ],
      mappingRuleCautionIds: ["C3"],
      competingSourceValues: [{ sourceDocumentId: "older.pdf", value: "100" }],
    });
  });

  it("formats mapping-rule cautions as analyst-review warnings", () => {
    expect(warningDetails("mapping_rule.C3.warning")).toEqual({
      label: "Movement schedule caution",
      description:
        "A movement schedule component was mapped. Confirm whether this should feed the cell or only the closing balance should be used.",
      actionable: true,
    });
    expect(warningDetails("mapping_rule.MULTI_SOURCE.warning")).toEqual({
      label: "Multiple source files",
      description:
        "Multiple uploaded files produced values for the same cell. The selected source should be reviewed against alternatives.",
      actionable: true,
    });
  });

  it("treats comparative-year alone as non-actionable but mixed warnings as actionable", () => {
    expect(isActionableWarningSet(["comparative_year"])).toBe(false);
    expect(isActionableWarningSet(["comparative_year", "note_subtotal_reconciliation"])).toBe(true);
    expect(isActionableWarningSet([])).toBe(false);
  });

  it("builds tooltip details for known and unknown rule metadata", () => {
    expect(
      ruleTooltipDetails("B1", {
        B1: {
          code: "B1",
          title: "PKR thousands unit policy",
          category: "Value Interpretation",
          severity: "Critical",
          description: "All monetary values are in Rupees in thousand.",
        },
      }),
    ).toEqual({
      code: "B1",
      title: "PKR thousands unit policy",
      category: "Value Interpretation",
      severity: "Critical",
      description: "All monetary values are in Rupees in thousand.",
      missing: false,
    });

    expect(ruleTooltipDetails("Z9", {})).toEqual({
      code: "Z9",
      title: "Rule metadata unavailable",
      category: "-",
      severity: "-",
      description: "This rule code was attached to the cell, but the current mapping-rule manifest did not include details for it.",
      missing: true,
    });
  });

  it("marks a workbook sheet tab only when it has actionable warning cells", () => {
    expect(
      sheetNeedsAttention([
        { diagnosis: { warnings: ["comparative_year"] } },
        { diagnosis: { warnings: [] } },
      ]),
    ).toBe(false);

    expect(
      sheetNeedsAttention([
        { diagnosis: { warnings: ["comparative_year", "note_subtotal_reconciliation"] } },
      ]),
    ).toBe(true);
  });
});
