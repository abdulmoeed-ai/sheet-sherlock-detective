import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageShell, Card, Badge } from "@/components/PageShell";
import { Button } from "@/components/Button";
import { readSourceRegistry } from "@/lib/api/source-registry";
import { readAdminMappingRules } from "@/lib/api/projects";
import { queryKeys } from "@/lib/api/query-keys";
import { useToggleMappingRule } from "@/hooks/use-project-actions";
import { useSelectedProjectId } from "@/lib/project-store";
import { RefreshCw, AlertTriangle, CheckCircle2, Activity, Globe2 } from "lucide-react";

export const Route = createFileRoute("/sources")({
  head: () => ({
    meta: [
      { title: "Source Registry — Sheet Sherlock" },
      {
        name: "description",
        content: "Admin: source registry metadata and approved source domains.",
      },
    ],
  }),
  component: Sources,
});

type SourceRecord = Record<string, unknown>;

interface SourceRow extends SourceRecord {
  id?: string;
  name: string;
  category?: string;
  enabled?: boolean;
  allowedDomains: string[];
  groups: string[];
}

interface MappingRuleRow {
  code: string;
  title: string;
  category: string;
  severity: string;
  description: string;
  enabled: boolean;
  sourceReference?: string;
}

const PRIMARY_FIELDS = new Set([
  "id",
  "name",
  "category",
  "enabled",
  "allowedDomains",
  "allowed_domains",
  "groups",
]);

function statusBadge(enabled: boolean | undefined) {
  if (enabled === false) {
    return (
      <Badge tone="danger">
        <AlertTriangle className="mr-1 inline h-3 w-3" />
        DISABLED
      </Badge>
    );
  }
  return (
    <Badge tone="success">
      <CheckCircle2 className="mr-1 inline h-3 w-3" />
      ENABLED
    </Badge>
  );
}

function Sources() {
  const projectId = useSelectedProjectId();
  const toggleMappingRule = useToggleMappingRule(projectId ?? "");
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: queryKeys.sourceRegistry,
    queryFn: readSourceRegistry,
  });
  const mappingRules = useQuery({
    queryKey: projectId
      ? queryKeys.adminMappingRules(projectId)
      : ["projects", "none", "mapping-rules", "admin"],
    queryFn: () => readAdminMappingRules(projectId as string),
    enabled: !!projectId,
    retry: false,
  });

  const sources = (data?.sources ?? []).map(normalizeSource);
  const rules = (mappingRules.data?.rules ?? []).map(normalizeRule);
  const disabled = sources.filter((s) => s.enabled === false);
  const totalDomains = sources.reduce((count, source) => count + source.allowedDomains.length, 0);
  const disabledRules = rules.filter((rule) => !rule.enabled);

  return (
    <PageShell
      title="Source Registry"
      subtitle="Admin · backend-approved source metadata, domain allowlists, and forecast/ingestion source groups."
      hideProgress
      actions={
        <Button variant="secondary" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          Refresh registry
        </Button>
      }
    >
      {disabled.length > 0 && (
        <div
          className="mb-5 flex items-center gap-3 rounded-[10px] border px-5 py-3.5"
          style={{ background: "var(--color-warning-bg)", borderColor: "#FCD34D" }}
        >
          <Activity className="h-5 w-5" style={{ color: "var(--color-warning-fg)" }} />
          <div className="text-[13px] font-semibold" style={{ color: "var(--color-warning-fg)" }}>
            Source registry: {disabled.length} source(s) disabled in the backend allowlist.
          </div>
        </div>
      )}

      <div className="mb-5 grid grid-cols-4 gap-4">
        {[
          ["Total sources", sources.length.toString()],
          ["Enabled", sources.filter((s) => s.enabled !== false).length.toString()],
          ["Disabled", disabled.length.toString()],
          ["Allowed domains", totalDomains.toString()],
        ].map(([k, v]) => (
          <Card key={k}>
            <div className="text-[12px] uppercase tracking-wider text-[var(--color-text-secondary)]">
              {k}
            </div>
            <div className="mt-2 text-[24px] font-bold tnum">{v}</div>
          </Card>
        ))}
      </div>

      <Card>
        {isLoading ? <LoadingState /> : null}
        {isError ? (
          <ErrorState
            message={error instanceof Error ? error.message : "Unable to load source registry."}
          />
        ) : null}
        {!isLoading && !isError && sources.length === 0 ? <EmptyState /> : null}
        {!isLoading && !isError && sources.length > 0 ? <SourceTable sources={sources} /> : null}
      </Card>

      <Card className="mt-5">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[15px] font-semibold">Mapping rules</h2>
            <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
              Admin controls for backend extraction rule availability.
            </p>
          </div>
          {mappingRules.data ? (
            <div className="flex flex-wrap justify-end gap-2">
              <Badge tone="info">{mappingRules.data.enabledRulesCount} enabled</Badge>
              <Badge tone={disabledRules.length > 0 ? "warning" : "success"}>
                {disabledRules.length} disabled
              </Badge>
            </div>
          ) : null}
        </div>
        {!projectId ? (
          <div className="text-[13px] text-[var(--color-text-muted)]">
            Select a project to manage mapping rules.
          </div>
        ) : mappingRules.isLoading ? (
          <LoadingState />
        ) : mappingRules.isError ? (
          <ErrorState
            title="Mapping rules failed to load"
            message={
              mappingRules.error instanceof Error
                ? mappingRules.error.message
                : "Unable to load mapping rules."
            }
          />
        ) : rules.length === 0 ? (
          <EmptyState title="No mapping rules configured" />
        ) : (
          <MappingRulesTable
            rules={rules}
            pending={toggleMappingRule.isPending}
            onToggle={(rule) =>
              toggleMappingRule.mutate({ ruleCode: rule.code, enabled: !rule.enabled })
            }
          />
        )}
      </Card>
    </PageShell>
  );
}

function SourceTable({ sources }: { sources: SourceRow[] }) {
  return (
    <table className="w-full text-[13px]">
      <thead className="border-b text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">
        <tr>
          <th className="py-2 text-left">Source</th>
          <th className="text-left">Category</th>
          <th className="text-left">Status</th>
          <th className="text-left">Groups</th>
          <th className="text-left">Allowed domains</th>
          <th className="text-left">Metadata</th>
        </tr>
      </thead>
      <tbody>
        {sources.map((source) => (
          <tr key={source.id ?? source.name} className="border-b align-top last:border-0">
            <td className="py-3">
              <div className="font-semibold">{source.name}</div>
              {source.id ? (
                <div className="mt-1 font-mono text-[11px] text-[var(--color-text-muted)]">
                  {source.id}
                </div>
              ) : null}
            </td>
            <td className="py-3">{formatLabel(source.category ?? "uncategorized")}</td>
            <td className="py-3">{statusBadge(source.enabled)}</td>
            <td className="py-3">
              <TokenList items={source.groups} emptyLabel="No groups" />
            </td>
            <td className="py-3">
              <TokenList
                items={source.allowedDomains}
                emptyLabel="No domains"
                icon={<Globe2 className="h-3 w-3" />}
              />
            </td>
            <td className="py-3 text-[var(--color-text-muted)]">
              <Metadata source={source} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function LoadingState() {
  return (
    <div className="space-y-3 py-2">
      {[0, 1, 2, 3].map((item) => (
        <div key={item} className="h-11 animate-pulse rounded-md bg-[var(--color-tag-bg)]" />
      ))}
    </div>
  );
}

function ErrorState({
  message,
  title = "Source registry failed to load",
}: {
  message: string;
  title?: string;
}) {
  return (
    <div
      className="flex items-center gap-3 rounded-[10px] border px-5 py-4"
      style={{ borderColor: "#FCA5A5" }}
    >
      <AlertTriangle className="h-5 w-5 text-[var(--color-danger-fg)]" />
      <div>
        <div className="text-[13px] font-semibold text-[var(--color-danger-fg)]">{title}</div>
        <div className="mt-1 text-[12px] text-[var(--color-text-muted)]">{message}</div>
      </div>
    </div>
  );
}

function EmptyState({ title = "No sources configured" }: { title?: string }) {
  return (
    <div
      className="rounded-[10px] border border-dashed px-5 py-8 text-center"
      style={{ borderColor: "var(--color-border-default)" }}
    >
      <div className="text-[14px] font-semibold">{title}</div>
      <div className="mt-1 text-[12px] text-[var(--color-text-muted)]">
        The backend returned an empty source registry.
      </div>
    </div>
  );
}

function MappingRulesTable({
  rules,
  pending,
  onToggle,
}: {
  rules: MappingRuleRow[];
  pending: boolean;
  onToggle: (rule: MappingRuleRow) => void;
}) {
  return (
    <div className="max-h-[520px] overflow-auto">
      <table className="w-full text-[13px]">
        <thead className="border-b text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">
          <tr>
            <th className="py-2 text-left">Rule</th>
            <th className="text-left">Category</th>
            <th className="text-left">Severity</th>
            <th className="text-left">Status</th>
            <th className="text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {rules.map((rule) => (
            <tr key={rule.code} className="border-b align-top last:border-0">
              <td className="py-3">
                <div className="font-semibold">
                  {rule.code} · {rule.title}
                </div>
                <div className="mt-1 max-w-[620px] text-[12px] text-[var(--color-text-muted)]">
                  {rule.description}
                </div>
                {rule.sourceReference ? (
                  <div className="mt-1 font-mono text-[11px] text-[var(--color-text-muted)]">
                    {rule.sourceReference}
                  </div>
                ) : null}
              </td>
              <td className="py-3">{rule.category}</td>
              <td className="py-3">
                <Badge tone={rule.severity === "Critical" ? "danger" : "neutral"}>
                  {rule.severity}
                </Badge>
              </td>
              <td className="py-3">{statusBadge(rule.enabled)}</td>
              <td className="py-3 text-right">
                <Button
                  variant={rule.enabled ? "secondary" : "primary"}
                  onClick={() => onToggle(rule)}
                  disabled={pending}
                >
                  {rule.enabled ? "Disable" : "Enable"}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TokenList({
  items,
  emptyLabel,
  icon,
}: {
  items: string[];
  emptyLabel: string;
  icon?: React.ReactNode;
}) {
  if (items.length === 0)
    return <span className="text-[var(--color-text-muted)]">{emptyLabel}</span>;
  return (
    <div className="flex max-w-[320px] flex-wrap gap-1.5">
      {items.map((item) => (
        <span
          key={item}
          className="inline-flex items-center gap-1 rounded-md bg-[var(--color-tag-bg)] px-2 py-1 text-[11px] font-semibold text-[var(--color-text-secondary)]"
        >
          {icon}
          {item}
        </span>
      ))}
    </div>
  );
}

function Metadata({ source }: { source: SourceRow }) {
  const entries = Object.entries(source).filter(
    ([key, value]) => !PRIMARY_FIELDS.has(key) && value !== undefined && value !== null,
  );
  if (entries.length === 0) return <span>No extra metadata</span>;
  return (
    <div className="space-y-1">
      {entries.map(([key, value]) => (
        <div key={key}>
          <span className="font-semibold text-[var(--color-text-secondary)]">
            {formatLabel(key)}:
          </span>{" "}
          {formatValue(value)}
        </div>
      ))}
    </div>
  );
}

function normalizeSource(source: SourceRecord): SourceRow {
  return {
    ...source,
    id: stringValue(source.id),
    name: stringValue(source.name) ?? stringValue(source.id) ?? "Unnamed source",
    category: stringValue(source.category),
    enabled: typeof source.enabled === "boolean" ? source.enabled : undefined,
    allowedDomains: stringArray(source.allowedDomains ?? source.allowed_domains),
    groups: stringArray(source.groups),
  };
}

function normalizeRule(rule: SourceRecord): MappingRuleRow {
  return {
    code: stringValue(rule.code) ?? stringValue(rule.ruleCode) ?? "unknown",
    title: stringValue(rule.title) ?? stringValue(rule.name) ?? "Untitled rule",
    category: stringValue(rule.category) ?? "Uncategorized",
    severity: stringValue(rule.severity) ?? "Advisory",
    description: stringValue(rule.description) ?? "",
    enabled: booleanValue(rule.isEnabled ?? rule.enabled, true),
    sourceReference: stringValue(rule.sourceReference ?? rule.source_reference),
  };
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function stringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function booleanValue(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function formatLabel(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatValue(value: unknown): string {
  if (Array.isArray(value)) return value.map(formatValue).join(", ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string" || typeof value === "number") return String(value);
  return JSON.stringify(value);
}
