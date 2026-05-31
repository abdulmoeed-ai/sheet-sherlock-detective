import { afterEach, describe, expect, it } from "bun:test";
import {
  acknowledgeMappingRules,
  createProjectForCycle,
  getMappingRules,
  startProjectExtraction,
  submitProjectForManagerReview,
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
    await uploadProjectDocument(project.id, new File(["%PDF-1.4"], "Millat - 2025.pdf", { type: "application/pdf" }));
    const summary = await getMappingRules(project.id);
    await acknowledgeMappingRules(project.id, summary);
    const job = await startProjectExtraction(project.id);

    expect(job.id).toBe("job-1");
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
