import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { z } from "zod";
import { Download, Database, Copy, AlertTriangle, FileWarning, UserX, Tags } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataGate } from "@/components/dashboard/states";
import { KpiCard, Notice, PageHeader, Panel } from "@/components/dashboard/page";
import { FilterBar, FilterSelect, SearchInput } from "@/components/dashboard/filters";
import { DataTable, type Column } from "@/components/dashboard/data-table";
import { useDashboard, useDataset } from "@/hooks/use-dashboard-data";
import { ISSUE_LABELS, issuesCsv } from "@/lib/data/records";
import type { DataIssue, LabelRule } from "@/lib/data/types";
import { downloadCsv, exportFilename } from "@/lib/export";
import { formatDateTime } from "@/lib/data/format";

const searchSchema = z.object({
  q: z.string().optional().catch(undefined),
  type: z.enum(["client", "caregiver"]).optional().catch(undefined),
  issue: z.string().optional().catch(undefined),
  severity: z.enum(["error", "warning", "info"]).optional().catch(undefined),
});

export const Route = createFileRoute("/data-quality")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Data Quality & Records — CareOps Insight" },
      { name: "description", content: "Missing values, duplicates and inconsistent labels found in the spreadsheet." },
      { property: "og:title", content: "Data Quality & Records — CareOps Insight" },
      { property: "og:description", content: "Missing values, duplicates and inconsistent labels found in the spreadsheet." },
    ],
  }),
  component: () => (
    <DataGate>
      <DataQualityPage />
    </DataGate>
  ),
});

const SEVERITY_LABEL = { error: "Error", warning: "Warning", info: "Review" } as const;

function DataQualityPage() {
  const ds = useDataset();
  const { lastSuccessAt } = useDashboard();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/data-quality" });
  const set = (patch: Partial<z.infer<typeof searchSchema>>) => navigate({ search: (p) => ({ ...p, ...patch }), replace: true });

  const issues = useMemo(() => {
    const q = search.q?.trim().toLowerCase();
    return ds.issues.filter((i) => {
      if (search.type && i.recordType !== search.type) return false;
      if (search.severity && i.severity !== search.severity) return false;
      if (search.issue && ISSUE_LABELS[i.category] !== search.issue) return false;
      if (q && !`${i.recordLabel} ${i.message} ${i.field}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [ds, search]);

  const count = (cats: DataIssue["category"][]) => ds.issues.filter((i) => cats.includes(i.category)).length;
  const reviewRecords = new Set(ds.issues.filter((i) => i.severity !== "info").map((i) => i.recordKey)).size;
  const issueOptions = [...new Set(ds.issues.map((i) => ISSUE_LABELS[i.category]))].sort();

  const columns: Column<DataIssue>[] = [
    {
      key: "sev",
      header: "Severity",
      cell: (i) => <Badge variant={i.severity === "error" ? "danger" : i.severity === "warning" ? "warning" : "info"}>{SEVERITY_LABEL[i.severity]}</Badge>,
      sortValue: (i) => ({ error: 0, warning: 1, info: 2 })[i.severity],
    },
    { key: "issue", header: "Issue", cell: (i) => ISSUE_LABELS[i.category], sortValue: (i) => ISSUE_LABELS[i.category], hideBelow: "md" },
    { key: "record", header: "Record", cell: (i) => <span className="font-medium">{i.recordLabel}</span>, sortValue: (i) => i.recordLabel },
    { key: "where", header: "Worksheet", cell: (i) => <span className="text-xs text-muted-foreground">{i.sheet} · row {i.rowNumber}</span>, sortValue: (i) => `${i.sheet}-${String(i.rowNumber).padStart(5, "0")}`, hideBelow: "lg" },
    { key: "msg", header: "Details", cell: (i) => <span className="text-muted-foreground">{i.message}</span> },
  ];

  const ruleColumns: Column<LabelRule>[] = [
    { key: "field", header: "Field", cell: (r) => r.field, sortValue: (r) => r.field },
    { key: "raw", header: "Original value", cell: (r) => <code className="rounded bg-muted px-1.5 py-0.5 text-xs">“{r.raw}”</code>, sortValue: (r) => r.raw },
    { key: "group", header: "Grouped as", cell: (r) => <span className="font-medium">{r.group}</span>, sortValue: (r) => r.group },
    { key: "reason", header: "Rule", cell: (r) => <span className="text-xs text-muted-foreground">{r.reason}</span>, hideBelow: "md" },
    { key: "count", header: "Rows", align: "right", cell: (r) => r.count, sortValue: (r) => r.count },
  ];

  const exportIssues = () =>
    downloadCsv(
      exportFilename("data-quality"),
      issuesCsv(issues, [
        `Data quality report — ${ds.title}`,
        `Generated ${formatDateTime(new Date().toISOString())}; data last synced ${formatDateTime(lastSuccessAt)}`,
      ]),
    );

  const goRecord = (i: DataIssue) =>
    i.recordType === "client" ? navigate({ to: "/clients", search: { id: i.recordKey } }) : navigate({ to: "/caregivers", search: { id: i.recordKey } });

  return (
    <>
      <PageHeader
        title="Data Quality & Records"
        description="Problems found in the source spreadsheet. Nothing is changed in the sheet — fix values there and the dashboard updates on the next sync."
        actions={
          <Button variant="subtle" size="sm" onClick={exportIssues} disabled={!issues.length}>
            <Download /> Export {issues.length} issues (CSV)
          </Button>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total source records" value={ds.clients.length + ds.caregivers.length} icon={Database} tone="navy" hint={`${ds.clients.length} clients · ${ds.caregivers.length} caregivers`} />
        <KpiCard label="Records needing review" value={reviewRecords} icon={AlertTriangle} tone={reviewRecords ? "warning" : "success"} hint="Have at least one error or warning" />
        <KpiCard label="Duplicate IDs / records" value={count(["duplicate_id", "duplicate_record", "duplicate_phone"])} icon={Copy} tone={count(["duplicate_id", "duplicate_record", "duplicate_phone"]) ? "danger" : "success"} hint={`${count(["possible_duplicate"])} more share a name with another record`} />
        <KpiCard label="Invalid or inconsistent numbers" value={count(["invalid_number", "invalid_phone"])} icon={FileWarning} tone={count(["invalid_number", "invalid_phone"]) ? "danger" : "success"} hint="Payments, ages, experience, mobile numbers" />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Missing service category", n: count(["missing_category"]), icon: Tags },
          { label: "Missing service area", n: count(["missing_area"]), icon: Tags },
          { label: "Missing caregiver payment", n: count(["missing_caregiver_pay"]), icon: Tags },
          { label: "Missing caregiver profile info", n: count(["missing_profile"]), icon: UserX },
          { label: "Unrecognised label variants", n: count(["label_variant"]), icon: Tags },
        ].map((x) => (
          <button
            key={x.label}
            type="button"
            onClick={() => set({ issue: x.label === "Unrecognised label variants" ? ISSUE_LABELS.label_variant : x.label === "Missing caregiver profile info" ? ISSUE_LABELS.missing_profile : x.label })}
            className="surface flex items-center justify-between gap-3 px-4 py-3 text-left transition-shadow hover:shadow-raised"
          >
            <span className="text-xs text-muted-foreground">{x.label}</span>
            <span className={x.n ? "font-display text-lg font-bold text-warning-foreground tabular" : "font-display text-lg font-bold text-success tabular"}>{x.n}</span>
          </button>
        ))}
      </div>

      {ds.notes.length > 0 && (
        <div className="mt-4 space-y-2">
          {ds.notes.map((n) => (
            <Notice key={n}>{n}</Notice>
          ))}
        </div>
      )}

      <Panel className="mt-4" title="Records requiring review" bodyClassName="p-0">
        <FilterBar active={!!(search.q || search.type || search.issue || search.severity)} onReset={() => navigate({ search: {}, replace: true })} count={issues.length} total={ds.issues.length} noun="issues">
          <SearchInput value={search.q ?? ""} onChange={(q) => set({ q: q || undefined })} placeholder="Search record or detail" />
          <FilterSelect label="Record types" value={search.type === "client" ? "Clients" : search.type === "caregiver" ? "Caregivers" : undefined} options={["Clients", "Caregivers"]} onChange={(v) => set({ type: v === "Clients" ? "client" : v === "Caregivers" ? "caregiver" : undefined })} className="sm:w-[150px]" />
          <FilterSelect label="Issues" value={search.issue} options={issueOptions} onChange={(issue) => set({ issue })} className="sm:w-[220px]" />
          <FilterSelect label="Severities" value={search.severity ? SEVERITY_LABEL[search.severity] : undefined} options={["Error", "Warning", "Review"]} onChange={(v) => set({ severity: v === "Error" ? "error" : v === "Warning" ? "warning" : v === "Review" ? "info" : undefined })} className="sm:w-[140px]" />
        </FilterBar>
        <DataTable
          rows={issues}
          columns={columns}
          rowKey={(i) => i.id}
          onRowClick={goRecord}
          initialSort={{ key: "sev", dir: "asc" }}
          resetKey={JSON.stringify(search)}
          emptyTitle={ds.issues.length ? "No issues match the filters" : "No data issues found"}
        />
      </Panel>

      <Panel className="mt-4" title="Label grouping rules" description="How original values are grouped for charts and filters. The spreadsheet itself is not changed." bodyClassName="p-0">
        <DataTable rows={ds.labelRules} columns={ruleColumns} rowKey={(r) => `${r.field}|${r.raw}`} pageSize={10} initialSort={{ key: "field", dir: "asc" }} emptyTitle="No values needed grouping" />
      </Panel>
    </>
  );
}
