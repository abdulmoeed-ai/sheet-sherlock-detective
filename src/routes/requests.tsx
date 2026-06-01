import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { loadSession } from "@/lib/auth-session";
import {
  createAnalysisRequest,
  DEFAULT_ANALYSIS_REQUEST_ANALYST_EMAIL,
  listAnalysisRequests,
  type AnalysisRequestResponse,
} from "@/lib/api/projects";

export const Route = createFileRoute("/requests")({
  head: () => ({
    meta: [
      { title: "Requests — Sheet Sherlock" },
      { name: "description", content: "Create and manage analysis request handoffs." },
    ],
  }),
  component: RequestsPage,
});

function RequestsPage() {
  const session = loadSession();
  const role = session?.user.role;
  const canCreate = role === "finance_manager" || role === "admin";
  const [requests, setRequests] = useState<AnalysisRequestResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [form, setForm] = useState({
    companyName: "Millat Tractors Limited",
    companySymbol: "MTL",
    sector: "Industrial Engineering",
    fiscalYear: "FY2025",
    assignedAnalystEmail: DEFAULT_ANALYSIS_REQUEST_ANALYST_EMAIL,
    note: "",
  });

  async function refreshRequests() {
    setLoading(true);
    setError(null);
    try {
      setRequests(await listAnalysisRequests());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load requests.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshRequests();
  }, []);

  async function submitRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      const created = await createAnalysisRequest({
        assignedAnalystEmail: form.assignedAnalystEmail,
        companyName: form.companyName,
        companySymbol: form.companySymbol,
        sector: form.sector,
        fiscalYear: form.fiscalYear,
        priority: "high",
        note: form.note,
      });
      setCreatedId(created.id);
      await refreshRequests();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create request.");
    }
  }

  return (
    <PageShell
      title="Analysis Requests"
      subtitle="Finance Manager request initiation and analyst inbox"
    >
      <div data-testid="requests-page" className="grid gap-5 xl:grid-cols-[420px_1fr]">
        {canCreate ? (
          <section className="rounded-lg border bg-white p-5" style={{ borderColor: "var(--color-border-default)" }}>
            <h2 className="text-[15px] font-semibold text-text-primary">Create request</h2>
            <form className="mt-4 space-y-3" onSubmit={submitRequest} data-testid="request-form">
              <Field label="Company">
                <Input
                  data-testid="request-company-name"
                  value={form.companyName}
                  onChange={(event) => setForm((next) => ({ ...next, companyName: event.target.value }))}
                  required
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Ticker">
                  <Input
                    data-testid="request-company-symbol"
                    value={form.companySymbol}
                    onChange={(event) => setForm((next) => ({ ...next, companySymbol: event.target.value }))}
                  />
                </Field>
                <Field label="Period">
                  <Input
                    data-testid="request-fiscal-year"
                    value={form.fiscalYear}
                    onChange={(event) => setForm((next) => ({ ...next, fiscalYear: event.target.value }))}
                  />
                </Field>
              </div>
              <Field label="Sector">
                <Input
                  data-testid="request-sector"
                  value={form.sector}
                  onChange={(event) => setForm((next) => ({ ...next, sector: event.target.value }))}
                />
              </Field>
              <Field label="Assigned analyst email">
                <Input
                  data-testid="request-analyst-email"
                  type="email"
                  value={form.assignedAnalystEmail}
                  readOnly
                  required
                />
              </Field>
              <Field label="Note">
                <Textarea
                  data-testid="request-note"
                  value={form.note}
                  onChange={(event) => setForm((next) => ({ ...next, note: event.target.value }))}
                  rows={4}
                />
              </Field>
              <Button data-testid="request-create-submit" type="submit" className="w-full">
                Create request
              </Button>
              {createdId ? (
                <div className="rounded-md bg-[var(--color-success-bg)] px-3 py-2 text-[12px] text-[var(--color-success-fg)]">
                  Created request <span data-testid="request-created-id">{createdId}</span>
                </div>
              ) : null}
            </form>
          </section>
        ) : null}

        <section className="rounded-lg border bg-white p-5" style={{ borderColor: "var(--color-border-default)" }}>
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-semibold text-text-primary">
              {role === "finance_analyst" ? "Analyst inbox" : "Request queue"}
            </h2>
            <Button type="button" variant="outline" onClick={() => void refreshRequests()}>
              Refresh
            </Button>
          </div>
          {error ? (
            <div className="mt-3 rounded-md border border-danger/30 bg-danger-bg px-3 py-2 text-sm text-danger-fg">{error}</div>
          ) : null}
          <div data-testid="request-inbox" className="mt-4 overflow-hidden rounded-md border" style={{ borderColor: "var(--color-border-default)" }}>
            {loading ? (
              <div className="px-4 py-6 text-sm text-text-muted">Loading requests...</div>
            ) : requests.length === 0 ? (
              <div className="px-4 py-6 text-sm text-text-muted">No requests yet.</div>
            ) : (
              <div className="divide-y divide-border-default">
                {requests.map((request) => (
                  <Link
                    key={request.id}
                    to="/requests/$requestId"
                    params={{ requestId: request.id }}
                    data-testid="request-row"
                    className="grid w-full grid-cols-[1fr_auto] gap-4 px-4 py-3 text-left hover:bg-table-header"
                  >
                    <span>
                      <span className="block text-[13px] font-semibold text-text-primary">
                        {request.companyName} {request.companySymbol ? `(${request.companySymbol})` : ""}
                      </span>
                      <span className="mt-1 block text-[12px] text-text-muted">
                        {request.sector ?? "Sector pending"} · {request.fiscalYear ?? "Period pending"} · {request.assignedAnalystEmail}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="rounded-md bg-tag-bg px-2 py-1 text-[11px] font-semibold text-brand">
                        {request.status}
                      </span>
                      <span className="mt-1 block text-[11px] text-text-muted">{request.emailStatus}</span>
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
      <div className="mt-5">
        <Outlet />
      </div>
    </PageShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[12px] font-semibold text-text-secondary">{label}</span>
      {children}
    </label>
  );
}
