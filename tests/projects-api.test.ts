import { afterEach, describe, expect, it } from "bun:test";
import {
  askProjectAi,
  acceptBalanceSheetDiagnosis,
  acknowledgeMappingRules,
  acknowledgeAnalysisRequest,
  convertAnalysisRequestToProject,
  createAnalysisRequest,
  createReviewComment,
  createProjectForCycle,
  DEFAULT_ANALYSIS_REQUEST_ANALYST_EMAIL,
  downloadArchiveAuditJson,
  generateExecutiveBrief,
  generateProjectAssumptions,
  getLatestModelArchive,
  listAnalysisRequests,
  getMappingRules,
  recordCfoSignoff,
  recordManagerDecision,
  runBalanceSheetDiagnosis,
  runProjectForecast,
  startProjectExtraction,
  streamProjectAi,
  parseSseEvents,
  submitProjectForManagerReview,
  toggleProjectMappingRule,
  uploadProjectDocument,
} from "../src/lib/api/projects";

const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;

afterEach(() => {
  globalThis.fetch = originalFetch;
  globalThis.window = originalWindow;
});

describe("project ingestion api client", () => {
  it("runs the mapping-rules acknowledgement sequence with bearer auth", async () => {
    installSession();
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = ((url: string | URL | Request, init?: RequestInit) => {
      requests.push({ url: String(url), init });
      const path = String(url);
      if (path.endsWith("/api/projects")) {
        return jsonResponse({ id: "project-1", companyName: "Millat Tractors Limited", projectLabel: "FY2025", sector: "Engineering & Industrials", fiscalYear: "2025", currencyUnit: "Rs in Thousands", template: "Millat - Template.xlsx", status: "setup" }, 201);
      }
      if (path.endsWith("/api/projects/project-1/documents")) {
        return jsonResponse({ id: "document-1" }, 201);
      }
      if (path.endsWith("/api/projects/project-1/mapping-rules")) {
        return jsonResponse(mappingSummary());
      }
      if (path.endsWith("/api/projects/project-1/mapping-rules/acknowledge")) {
        return jsonResponse({ acknowledged: true });
      }
      if (path.endsWith("/api/projects/project-1/extractions")) {
        return jsonResponse({ id: "job-1", projectId: "project-1", status: "queued", percent: 0, message: "Extraction queued." }, 202);
      }
      return jsonResponse({ detail: "not found" }, 404);
    }) as typeof fetch;

    const project = await createProjectForCycle({
      companyName: "Millat Tractors Limited",
      projectLabel: "FY2025",
      sector: "Engineering & Industrials",
      fiscalYear: "2025",
    });
    const uploadedDocument = await uploadProjectDocument(project.id, new File(["%PDF-1.4"], "Millat - 2025.pdf", { type: "application/pdf" }));
    const summary = await getMappingRules(project.id);
    await acknowledgeMappingRules(project.id, summary);
    const job = await startProjectExtraction(project.id);

    expect(job.id).toBe("job-1");
    expect(uploadedDocument.id).toBe("document-1");
    expect(requests).toHaveLength(5);
    expect((requests[0].init?.headers as Record<string, string>).Authorization).toBe("Bearer access-token");
    expect(requests[1].init?.body).toBeInstanceOf(FormData);
    expect(JSON.parse(String(requests[3].init?.body))).toEqual({
      rulesHash: "a".repeat(64),
      rulesCount: 40,
      acknowledged: true,
    });
  });

  it("surfaces the backend extraction gate message", async () => {
    installSession();
    globalThis.fetch = (() =>
      jsonResponse({ detail: "Acknowledge the current Data Mapping Rules before extraction." }, 409)) as typeof fetch;

    await expect(startProjectExtraction("project-1")).rejects.toThrow(
      "Acknowledge the current Data Mapping Rules before extraction.",
    );
  });

  it("submits the manager review handoff and surfaces three-statement blocking messages", async () => {
    installSession();
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = ((url: string | URL | Request, init?: RequestInit) => {
      requests.push({ url: String(url), init });
      return jsonResponse({
        detail: {
          message: "Resolve or explicitly clear automatic three-statement check items before submitting.",
          threeStatementCheck: {
            status: "failed",
            summary: { blocking: true, errorCount: 1, warningCount: 0 },
            items: [{ checkCode: "BS_BALANCES", severity: "error" }],
          },
        },
      }, 409);
    }) as typeof fetch;

    await expect(submitProjectForManagerReview("project-1", "Ready for manager review")).rejects.toThrow(
      "Resolve or explicitly clear automatic three-statement check items before submitting.",
    );
    expect(requests[0].url).toEndWith("/api/projects/project-1/review/submit");
    expect(JSON.parse(String(requests[0].init?.body))).toEqual({ note: "Ready for manager review" });
  });

  it("asks the project-scoped Ask AI endpoint with bearer auth", async () => {
    installSession();
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = ((url: string | URL | Request, init?: RequestInit) => {
      requests.push({ url: String(url), init });
      return jsonResponse({
        answer: "Revenue is supported by PL1!F5 [1].",
        sourcesUsed: [],
        modelCitations: [],
        sourceCitations: [],
        warnings: [],
        usage: {},
      });
    }) as typeof fetch;

    const response = await askProjectAi("project-1", "What is revenue?");

    expect(response.answer).toContain("[1]");
    expect(requests[0].url).toEndWith("/api/projects/project-1/ask-ai");
    expect((requests[0].init?.headers as Record<string, string>).Authorization).toBe("Bearer access-token");
    expect(JSON.parse(String(requests[0].init?.body))).toEqual({
      question: "What is revenue?",
      includeExternalSources: false,
    });
  });

  it("parses split SSE chunks and multiple events per chunk", () => {
    const events = parseSseEvents([
      'event: status\ndata: {"stage":"context","message":"Preparing',
      ' project context","percent":10}\n\n',
      'event: token\ndata: {"delta":"Revenue "}\n\nevent: final\ndata: {"answer":"Revenue [1]."}\n\n',
    ]);

    expect(events).toEqual([
      { type: "status", payload: { stage: "context", message: "Preparing project context", percent: 10 } },
      { type: "token", payload: { delta: "Revenue " } },
      { type: "final", payload: { answer: "Revenue [1]." } },
    ]);
  });

  it("streams Ask AI activity, tokens, and final payload with abort support", async () => {
    installSession();
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = ((url: string | URL | Request, init?: RequestInit) => {
      requests.push({ url: String(url), init });
      return Promise.resolve(
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(encodeChunk('event: status\ndata: {"stage":"context","message":"Preparing project context","percent":10}\n\n'));
              controller.enqueue(encodeChunk('event: source\ndata: {"kind":"model","message":"Found accepted model fields","count":1,"items":[]}\n\n'));
              controller.enqueue(encodeChunk('event: approach\ndata: {"summary":"Use accepted model fields first."}\n\n'));
              controller.enqueue(encodeChunk('event: token\ndata: {"delta":"Revenue "}\n\nevent: token\ndata: {"delta":"is cited [1]."}\n\n'));
              controller.enqueue(encodeChunk('event: final\ndata: {"answer":"Revenue is cited [1].","sourcesUsed":[],"modelCitations":[],"sourceCitations":[],"warnings":[],"usage":{},"activityLog":[]}\n\n'));
              controller.close();
            },
          }),
          { status: 200, headers: { "Content-Type": "text/event-stream" } },
        ),
      );
    }) as typeof fetch;

    const seen: string[] = [];
    const abortController = new AbortController();
    await streamProjectAi("project-1", "What is revenue?", {
      sessionId: "chat-session-1",
      routePath: "/diff-review",
      screenName: "Diff Review",
      documentIds: ["document-1"],
      filters: { basis: "unconsolidated", period: "2025" },
      includeExternalSources: false,
      signal: abortController.signal,
      onStatus: (event) => seen.push(`status:${event.message}`),
      onSource: (event) => seen.push(`source:${event.kind}:${event.count}`),
      onApproach: (event) => seen.push(`approach:${event.summary}`),
      onToken: (event) => seen.push(`token:${event.delta}`),
      onFinal: (event) => seen.push(`final:${event.answer}`),
    });

    expect(seen).toEqual([
      "status:Preparing project context",
      "source:model:1",
      "approach:Use accepted model fields first.",
      "token:Revenue ",
      "token:is cited [1].",
      "final:Revenue is cited [1].",
    ]);
    expect(requests[0].url).toEndWith("/api/projects/project-1/ask-ai");
    expect((requests[0].init?.headers as Record<string, string>).Authorization).toBe("Bearer access-token");
    expect(requests[0].init?.signal).toBe(abortController.signal);
    expect(JSON.parse(String(requests[0].init?.body))).toEqual({
      question: "What is revenue?",
      sessionId: "chat-session-1",
      includeExternalSources: false,
      routePath: "/diff-review",
      screenName: "Diff Review",
      documentIds: ["document-1"],
      filters: { basis: "unconsolidated", period: "2025" },
    });
  });

  it("runs balance sheet diagnosis for the active project", async () => {
    installSession();
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = ((url: string | URL | Request, init?: RequestInit) => {
      requests.push({ url: String(url), init });
      return jsonResponse({
        runId: "diagnosis-1",
        projectId: "project-1",
        status: "ready_to_apply",
        imbalanceAmount: "100",
        candidates: [{ fieldId: "field-1", classification: "debit_credit_classification" }],
      });
    }) as typeof fetch;

    const response = await runBalanceSheetDiagnosis("project-1");

    expect(response.status).toBe("ready_to_apply");
    expect(requests[0].url).toEndWith("/api/projects/project-1/diagnosis/balance-sheet/run");
    expect(requests[0].init?.method).toBe("POST");
  });

  it("accepts a balance sheet diagnosis candidate", async () => {
    installSession();
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = ((url: string | URL | Request, init?: RequestInit) => {
      requests.push({ url: String(url), init });
      return jsonResponse({
        id: "decision-1",
        action: "accept",
        reasonCode: "diagnosis_accepted",
        field: { fieldId: "field-1", value: "0" },
      });
    }) as typeof fetch;

    const response = await acceptBalanceSheetDiagnosis("project-1", "candidate-1");

    expect(response.action).toBe("accept");
    expect(requests[0].url).toEndWith("/api/projects/project-1/diagnosis/balance-sheet/candidate-1/accept");
    expect(requests[0].init?.method).toBe("POST");
  });

  it("creates review comments with mention text", async () => {
    installSession();
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = ((url: string | URL | Request, init?: RequestInit) => {
      requests.push({ url: String(url), init });
      return jsonResponse({
        id: "comment-1",
        body: "Please review @Ayesha",
        status: "open",
        mentions: { resolved: [{ email: "ayesha@example.com" }], unresolved: [] },
      }, 201);
    }) as typeof fetch;

    const response = await createReviewComment("project-1", { body: "Please review @Ayesha", fieldId: "field-1" });

    expect(response.id).toBe("comment-1");
    expect(requests[0].url).toEndWith("/api/projects/project-1/comments");
    expect(JSON.parse(String(requests[0].init?.body))).toEqual({ body: "Please review @Ayesha", fieldId: "field-1" });
  });

  it("generates the CFO executive brief for the active project", async () => {
    installSession();
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = ((url: string | URL | Request, init?: RequestInit) => {
      requests.push({ url: String(url), init });
      return jsonResponse({
        id: "brief-1",
        projectId: "project-1",
        version: 1,
        status: "generated",
        generatedBy: "user-1",
        payload: { header: { company: "Millat Tractors Limited" } },
        createdAt: "2026-05-31T00:00:00Z",
        lockedAt: null,
      }, 201);
    }) as typeof fetch;

    const response = await generateExecutiveBrief("project-1");

    expect(response.id).toBe("brief-1");
    expect(response.status).toBe("generated");
    expect(requests[0].url).toEndWith("/api/projects/project-1/briefs/generate");
    expect(requests[0].init?.method).toBe("POST");
  });

  it("records manager and CFO review decisions", async () => {
    installSession();
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = ((url: string | URL | Request, init?: RequestInit) => {
      requests.push({ url: String(url), init });
      return jsonResponse({ projectId: "project-1", status: "cfo_review", locked: true, message: "ok" });
    }) as typeof fetch;

    await recordManagerDecision("project-1", { action: "approve", note: "Manager approved" });
    await recordCfoSignoff("project-1", { approved: true, note: "CFO approved", briefId: "brief-1" });

    expect(requests[0].url).toEndWith("/api/projects/project-1/review/manager-decision");
    expect(JSON.parse(String(requests[0].init?.body))).toEqual({ action: "approve", note: "Manager approved" });
    expect(requests[1].url).toEndWith("/api/projects/project-1/review/cfo-signoff");
    expect(JSON.parse(String(requests[1].init?.body))).toEqual({ approved: true, note: "CFO approved", briefId: "brief-1" });
  });

  it("runs forecast and generates assumptions through project APIs", async () => {
    installSession();
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = ((url: string | URL | Request, init?: RequestInit) => {
      requests.push({ url: String(url), init });
      if (String(url).endsWith("/forecast/run")) {
        return jsonResponse({
          status: "completed",
          projectId: "project-1",
          companyName: "Millat Tractors Limited",
          sector: "Industrial Engineering",
          projectionYears: 5,
          sourceStatus: "available",
          sourceReason: null,
          steps: [],
          scenarios: [],
          assumptions: [],
          citations: [],
          warnings: [],
        });
      }
      return jsonResponse({
        status: "generated",
        projectId: "project-1",
        sheetName: "Assumptions",
        generatedAt: "2026-06-01T00:00:00Z",
        writePolicy: {},
        rows: [],
        summary: { total: 0 },
      });
    }) as typeof fetch;

    await runProjectForecast("project-1", { query: "Analyse Millat" });
    await generateProjectAssumptions("project-1", { scenarios: [] });

    expect(requests[0].url).toEndWith("/api/projects/project-1/forecast/run");
    expect(JSON.parse(String(requests[0].init?.body))).toEqual({
      sourceGroup: "forecast",
      projectionYears: 5,
      query: "Analyse Millat",
    });
    expect(requests[1].url).toEndWith("/api/projects/project-1/assumptions/generate");
  });

  it("toggles admin mapping rules through the governance endpoint", async () => {
    installSession();
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = ((url: string | URL | Request, init?: RequestInit) => {
      requests.push({ url: String(url), init });
      return jsonResponse(mappingSummary());
    }) as typeof fetch;

    await toggleProjectMappingRule("project-1", "A1", false);

    expect(requests[0].url).toEndWith("/api/projects/project-1/mapping-rules/A1");
    expect(requests[0].init?.method).toBe("PATCH");
    expect(JSON.parse(String(requests[0].init?.body))).toEqual({ enabled: false });
  });

  it("reads archive metadata and downloads audit json", async () => {
    installSession();
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = ((url: string | URL | Request, init?: RequestInit) => {
      requests.push({ url: String(url), init });
      const path = String(url);
      if (path.endsWith("/api/projects/project-1/archive/latest")) {
        return jsonResponse({
          id: "archive-1",
          projectId: "project-1",
          version: 1,
          status: "created",
          checksumSha256: "f".repeat(64),
          createdAt: "2026-05-31T00:00:00Z",
          approvedBy: "cfo-1",
          auditJsonUrl: "/api/projects/project-1/archive/archive-1/audit.json",
          pdfAvailable: false,
        });
      }
      return jsonResponse({
        approvalSummary: { status: "approved" },
        sourceLineage: [],
        auditEventTimeline: [],
      });
    }) as typeof fetch;

    const archive = await getLatestModelArchive("project-1");
    const audit = await downloadArchiveAuditJson("project-1", archive.id);

    expect(archive.checksumSha256).toBe("f".repeat(64));
    expect((audit.approvalSummary as { status: string }).status).toBe("approved");
    expect(requests[0].url).toEndWith("/api/projects/project-1/archive/latest");
    expect(requests[1].url).toEndWith("/api/projects/project-1/archive/archive-1/audit.json");
  });

  it("runs the analysis request inbox actions", async () => {
    installSession();
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = ((url: string | URL | Request, init?: RequestInit) => {
      requests.push({ url: String(url), init });
      const path = String(url);
      const body = {
        id: "request-1",
        assignedAnalystEmail: DEFAULT_ANALYSIS_REQUEST_ANALYST_EMAIL,
        companyName: "Millat Tractors Limited",
        companySymbol: "MTL",
        sector: "Industrial Engineering",
        fiscalYear: "2025",
        template: "Millat - Template.xlsx",
        priority: "high",
        dueDate: "2026-06-15T00:00:00+00:00",
        note: "Prepare FY2025 review.",
        status: path.endsWith("convert-to-project") ? "converted" : path.endsWith("acknowledge") ? "acknowledged" : "pending",
        projectId: path.endsWith("convert-to-project") ? "project-1" : null,
        emailStatus: "failed",
        emailResult: { reason: "missing_resend_api_key" },
        createdAt: "2026-05-31T00:00:00Z",
        acknowledgedAt: null,
        convertedAt: null,
      };
      if (path.endsWith("/api/analysis-requests") && init?.method === "GET") {
        return jsonResponse([body]);
      }
      return jsonResponse(body, init?.method === "POST" && path.endsWith("/api/analysis-requests") ? 201 : 200);
    }) as typeof fetch;

    const created = await createAnalysisRequest({
      assignedAnalystEmail: "ignored@example.com",
      companyName: "Millat Tractors Limited",
      companySymbol: "MTL",
      sector: "Industrial Engineering",
      fiscalYear: "2025",
      priority: "high",
      dueDate: "2026-06-15T00:00:00+00:00",
      note: "Prepare FY2025 review.",
    });
    const listed = await listAnalysisRequests();
    const acknowledged = await acknowledgeAnalysisRequest(created.id);
    const converted = await convertAnalysisRequestToProject(created.id);

    expect(listed[0].id).toBe("request-1");
    expect(acknowledged.status).toBe("acknowledged");
    expect(converted.projectId).toBe("project-1");
    expect(requests[0].url).toEndWith("/api/analysis-requests");
    expect(JSON.parse(String(requests[0].init?.body))).toEqual({
      assignedAnalystEmail: DEFAULT_ANALYSIS_REQUEST_ANALYST_EMAIL,
      companyName: "Millat Tractors Limited",
      companySymbol: "MTL",
      sector: "Industrial Engineering",
      fiscalYear: "2025",
      priority: "high",
      dueDate: "2026-06-15T00:00:00+00:00",
      note: "Prepare FY2025 review.",
      template: "Millat - Template.xlsx",
    });
    expect(requests[2].url).toEndWith("/api/analysis-requests/request-1/acknowledge");
    expect(requests[3].url).toEndWith("/api/analysis-requests/request-1/convert-to-project");
  });
});

function installSession() {
  const storage = new Map<string, string>([
    ["sheet_sherlock_access_token", "access-token"],
    ["sheet_sherlock_refresh_token", "refresh-token"],
    ["sheet_sherlock_user", JSON.stringify({ id: "user-1", email: "analyst@example.com", name: "Analyst", role: "finance_analyst" })],
  ]);
  globalThis.window = {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
  } as unknown as Window & typeof globalThis;
}

function mappingSummary() {
  return {
    rulesHash: "a".repeat(64),
    rulesCount: 40,
    enabledRulesCount: 40,
    disabledRulesCount: 0,
    categoryCounts: { "Note Routing": 3 },
    criticalCount: 19,
    advisoryCount: 21,
    acknowledged: false,
    acknowledgedAt: null,
    rules: [],
  };
}

function jsonResponse(body: unknown, status = 200): Promise<Response> {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

function encodeChunk(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}
