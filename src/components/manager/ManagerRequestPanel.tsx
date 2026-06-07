import { useMemo, useState, type FormEvent } from "react";
import { ClipboardList, Loader2 } from "lucide-react";
import { Badge, Card } from "@/components/PageShell";
import { Button } from "@/components/Button";
import { Combobox } from "@/components/Combobox";
import { ApiError } from "@/lib/api/errors";
import type { AnalysisRequestCreateInput } from "@/lib/api/analysis-requests";
import type { AnalysisRequestResponse } from "@/lib/api/types";
import { useAnalysisRequests, useCreateAnalysisRequest } from "@/hooks/use-analysis-requests";
import { useAnalysts, usePsxCompanies } from "@/hooks/use-users";
import { templateForSector } from "@/lib/sector-template";

const blankRequest: AnalysisRequestCreateInput = {
  assignedAnalystEmail: "",
  companyName: "",
  companySymbol: "",
  sector: "",
  fiscalYear: "",
  template: "Millat - Template.xlsx",
  priority: "normal",
  dueDate: "",
  note: "",
};

export function ManagerRequestPanel() {
  const requests = useAnalysisRequests();
  const createRequest = useCreateAnalysisRequest();
  const analysts = useAnalysts();
  const psxCompanies = usePsxCompanies();
  const [draft, setDraft] = useState<AnalysisRequestCreateInput>(blankRequest);
  const error =
    createRequest.error instanceof ApiError
      ? createRequest.error.message
      : createRequest.error instanceof Error
        ? createRequest.error.message
        : null;

  const analystOptions = useMemo(
    () =>
      (analysts.data ?? []).map((analyst) => ({
        value: analyst.email,
        label: `${analyst.name} (${analyst.email})`,
      })),
    [analysts.data],
  );

  const companyOptions = useMemo(
    () =>
      (psxCompanies.data ?? [])
        .filter((company) => !draft.sector || company.sector === draft.sector)
        .map((company) => ({
          value: company.symbol,
          label: `${company.name} (${company.symbol})`,
        })),
    [draft.sector, psxCompanies.data],
  );

  const sectorOptions = useMemo(
    () =>
      [...new Set((psxCompanies.data ?? []).map((company) => company.sector))]
        .filter(Boolean)
        .sort()
        .map((sector) => ({ value: sector, label: sector })),
    [psxCompanies.data],
  );

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await createRequest.mutateAsync({
      ...draft,
      companySymbol: draft.companySymbol || null,
      sector: draft.sector || null,
      fiscalYear: draft.fiscalYear || null,
      dueDate: draft.dueDate || null,
      note: draft.note || null,
      template: templateForSector(draft.sector),
    });
    setDraft(blankRequest);
  };

  const handleCompanySelect = (symbol: string) => {
    const company = psxCompanies.data?.find((item) => item.symbol === symbol);
    if (!company) return;
    setDraft({
      ...draft,
      companyName: company.name,
      companySymbol: company.symbol,
      sector: company.sector,
      template: templateForSector(company.sector),
    });
  };

  const handleSectorSelect = (sector: string) => {
    setDraft({
      ...draft,
      sector,
      companyName: "",
      companySymbol: "",
      template: templateForSector(sector),
    });
  };

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(360px,0.8fr)]">
      <Card>
        <div className="mb-4 flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-[var(--color-brand)]" />
          <h2 className="text-[16px] font-semibold">Create Analysis Request</h2>
          <Badge tone="info">Manager</Badge>
        </div>
        <form onSubmit={submit} className="grid grid-cols-2 gap-3">
          <Combobox
            label="Sector"
            options={sectorOptions}
            value={draft.sector ?? ""}
            onChange={handleSectorSelect}
            placeholder={psxCompanies.isLoading ? "Loading..." : "Select sector..."}
            disabled={psxCompanies.isLoading}
            required
          />
          <Combobox
            label="Company"
            options={companyOptions}
            value={draft.companySymbol ?? ""}
            onChange={handleCompanySelect}
            placeholder={!draft.sector ? "Select sector first..." : "Search company..."}
            disabled={psxCompanies.isLoading || !draft.sector}
            required
          />
          <Combobox
            label="Analyst To Assign"
            options={analystOptions}
            value={draft.assignedAnalystEmail}
            onChange={(value) => setDraft({ ...draft, assignedAnalystEmail: value })}
            placeholder={analysts.isLoading ? "Loading..." : "Select analyst..."}
            disabled={analysts.isLoading}
            required
          />
          <label>
            <span className="mb-1 block text-[12px] font-semibold text-[var(--color-text-secondary)]">
              Fiscal year
            </span>
            <select
              value={draft.fiscalYear ?? ""}
              onChange={(event) => setDraft({ ...draft, fiscalYear: event.target.value })}
              className="h-10 w-full rounded-md border px-3 text-[13px]"
              style={{ borderColor: "var(--color-border-strong)" }}
            >
              <option value="">Optional</option>
              {["FY2024", "FY2025", "FY2026"].map((fy) => (
                <option key={fy} value={fy}>
                  {fy}
                </option>
              ))}
            </select>
          </label>
          <label className="col-span-2">
            <span className="mb-1 block text-[12px] font-semibold text-[var(--color-text-secondary)]">
              Comments / Notes
            </span>
            <textarea
              value={draft.note ?? ""}
              onChange={(event) => setDraft({ ...draft, note: event.target.value })}
              placeholder="Add context for the analyst..."
              className="min-h-[76px] w-full rounded-md border px-3 py-2 text-[13px]"
              style={{ borderColor: "var(--color-border-strong)" }}
            />
          </label>
          {error ? (
            <div className="col-span-2 rounded-md bg-[var(--color-danger-bg)] px-3 py-2 text-[12px] text-[var(--color-danger-fg)]">
              {error}
            </div>
          ) : null}
          <div className="col-span-2 flex justify-end">
            <Button
              type="submit"
              disabled={
                createRequest.isPending ||
                !draft.sector ||
                !draft.companyName ||
                !draft.assignedAnalystEmail
              }
            >
              {createRequest.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Assign Request
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-[16px] font-semibold">Request Tracker</h2>
          <Badge tone="neutral">{requests.data?.length ?? 0}</Badge>
        </div>
        {requests.isLoading ? (
          <div className="text-[13px] text-[var(--color-text-muted)]">Loading requests...</div>
        ) : (requests.data ?? []).length === 0 ? (
          <div
            className="rounded-md border px-4 py-5 text-[13px] text-[var(--color-text-secondary)]"
            style={{ borderColor: "var(--color-border-default)" }}
          >
            No analysis requests have been assigned yet.
          </div>
        ) : (
          <div className="space-y-2">
            {(requests.data ?? []).slice(0, 4).map((request) => (
              <RequestTrackerRow key={request.id} request={request} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function RequestTrackerRow({ request }: { request: AnalysisRequestResponse }) {
  return (
    <div
      className="rounded-md border px-3 py-2"
      style={{ borderColor: "var(--color-border-default)" }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold">{request.companyName}</div>
          <div className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">
            {request.assignedAnalystEmail} · {request.fiscalYear ?? "Current period"}
          </div>
        </div>
        <Badge tone={requestStatusTone(request.status)}>{requestStatusLabel(request.status)}</Badge>
      </div>
    </div>
  );
}

function requestStatusLabel(status: string): string {
  if (status === "acknowledged") return "Accepted by analyst";
  if (status === "converted") return "Converted to workbook";
  return "Pending analyst acceptance";
}

function requestStatusTone(status: string): "info" | "warning" | "success" {
  if (status === "acknowledged") return "warning";
  if (status === "converted") return "success";
  return "info";
}
