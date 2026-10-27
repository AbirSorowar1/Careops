import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { z } from "zod";
import { Download, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataGate, MissingSheetNotice } from "@/components/dashboard/states";
import { PageHeader, Panel } from "@/components/dashboard/page";
import { DataTable, type Column } from "@/components/dashboard/data-table";
import { FilterBar, FilterSelect, SearchInput } from "@/components/dashboard/filters";
import { CaregiverDrawer } from "@/components/dashboard/record-drawers";
import { CompletenessBadge, Missing, TextValue } from "@/components/dashboard/values";
import { RankedBars } from "@/components/dashboard/charts";
import { useDashboard, useDataset } from "@/hooks/use-dashboard-data";
import { AGE_GROUP_ORDER, EXPERIENCE_ORDER, ageGroup, average, countBy, distinct, experienceGroup, median } from "@/lib/data/metrics";
import type { CaregiverRecord } from "@/lib/data/types";
import { downloadCsv, exportFilename } from "@/lib/export";
import { caregiverCsv, filterCaregivers } from "@/lib/data/records";
import { formatDateTime, formatNumber } from "@/lib/data/format";

const searchSchema = z.object({
  q: z.string().optional().catch(undefined),
  age: z.string().optional().catch(undefined),
  area: z.string().optional().catch(undefined),
  education: z.string().optional().catch(undefined),
  exp: z.string().optional().catch(undefined),
  id: z.string().optional().catch(undefined),
});

export const Route = createFileRoute("/caregivers")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Caregiver Management — CareOps Insight" },
      { name: "description", content: "Caregiver workforce directory with age, education, experience and area." },
      { property: "og:title", content: "Caregiver Management — CareOps Insight" },
      { property: "og:description", content: "Caregiver workforce directory with age, education, experience and area." },
    ],
  }),
  component: () => (
    <DataGate>
      <CaregiversPage />
    </DataGate>
  ),
});

function CaregiversPage() {
  const ds = useDataset();
  const { lastSuccessAt } = useDashboard();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/caregivers" });
  const set = (patch: Partial<z.infer<typeof searchSchema>>) =>
    navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true });

  const options = useMemo(
    () => ({
      ages: AGE_GROUP_ORDER.filter((a) => ds.caregivers.some((c) => ageGroup(c.age) === a)),
      areas: distinct(ds.caregivers, (c) => c.addressZone),
      education: distinct(ds.caregivers, (c) => c.education.group),
      exp: EXPERIENCE_ORDER.filter((e) => ds.caregivers.some((c) => experienceGroup(c.experienceYears) === e)),
    }),
    [ds],
  );
  const rows = useMemo(() => filterCaregivers(ds.caregivers, search), [ds, search]);
  const selected = search.id ? ds.caregivers.find((c) => c.key === search.id) ?? null : null;
  const active = !!(search.q || search.age || search.area || search.education || search.exp);
  const edu = useMemo(() => countBy(rows, (c) => c.education.group), [rows]);

  if (!ds.hasCaregiverSheet) return <MissingSheetNotice what="caregiver" />;

  const columns: Column<CaregiverRecord>[] = [
    { key: "sl", header: "SL", cell: (c) => <span className="text-muted-foreground tabular">{c.sl ?? "—"}</span>, sortValue: (c) => (c.sl ? Number(c.sl) : null) },
    { key: "name", header: "Name", cell: (c) => <span className="font-medium">{c.name.value ?? "—"}</span>, sortValue: (c) => c.name.value },
    { key: "age", header: "Age", align: "right", cell: (c) => (c.age != null ? c.age : c.ageRaw ? <Badge variant="danger">Invalid</Badge> : <Missing />), sortValue: (c) => c.age },
    { key: "address", header: "Present address", cell: (c) => <TextValue field={c.address} />, sortValue: (c) => c.address.group, hideBelow: "md" },
    { key: "edu", header: "Education", cell: (c) => <TextValue field={c.education} />, sortValue: (c) => c.education.group, hideBelow: "sm" },
    {
      key: "exp",
      header: "Experience",
      align: "right",
      cell: (c) => (c.experienceYears != null ? `${c.experienceYears} yr${c.experienceYears === 1 ? "" : "s"}` : <Missing />),
      sortValue: (c) => c.experienceYears,
    },
    {
      key: "mobile",
      header: "Mobile",
      cell: (c) =>
        c.mobile ? (
          <span className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
            {c.mobile.masked}
            {!c.mobile.valid && <Badge variant="warning">Check</Badge>}
          </span>
        ) : (
          <Missing />
        ),
      hideBelow: "lg",
    },
    { key: "status", header: "Record", cell: (c) => <CompletenessBadge complete={c.complete} missing={c.missingFields} />, sortValue: (c) => (c.complete ? 1 : 0), hideBelow: "lg" },
  ];

  const exportRows = () =>
    downloadCsv(
      exportFilename("caregivers"),
      caregiverCsv(rows, [
        `Caregiver directory — ${ds.title}`,
        `Generated ${formatDateTime(new Date().toISOString())}; data last synced ${formatDateTime(lastSuccessAt)}`,
        "Mobile numbers are masked. Full numbers are only in the source spreadsheet.",
      ]),
    );

  return (
    <>
      <PageHeader
        title="Caregiver Management"
        description="The caregiver workforce as recorded in the spreadsheet. Clients and caregivers are listed separately because the sheet does not record who is assigned to whom."
        actions={
          <Button variant="subtle" size="sm" onClick={exportRows} disabled={!rows.length}>
            <Download /> Export {rows.length} rows (CSV)
          </Button>
        }
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="surface px-4 py-3">
          <p className="text-xs text-muted-foreground">Caregivers shown</p>
          <p className="font-display text-xl font-bold tabular">{rows.length}</p>
        </div>
        <div className="surface px-4 py-3">
          <p className="text-xs text-muted-foreground">Average age</p>
          <p className="font-display text-xl font-bold tabular">{formatNumber(average(rows.map((r) => r.age)), 1)}</p>
        </div>
        <div className="surface px-4 py-3">
          <p className="text-xs text-muted-foreground">Median experience</p>
          <p className="font-display text-xl font-bold tabular">
            {formatNumber(median(rows.map((r) => r.experienceYears)), 1)} <span className="text-sm font-medium text-muted-foreground">yrs</span>
          </p>
        </div>
        <div className="surface px-4 py-3">
          <p className="text-xs text-muted-foreground">Complete profiles</p>
          <p className="font-display text-xl font-bold tabular">
            {rows.filter((r) => r.complete).length} <span className="text-sm font-medium text-muted-foreground">/ {rows.length}</span>
          </p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
        <Panel bodyClassName="p-0">
          <FilterBar active={active} onReset={() => navigate({ search: {}, replace: true })} count={rows.length} total={ds.caregivers.length} noun="caregivers">
            <SearchInput value={search.q ?? ""} onChange={(q) => set({ q: q || undefined })} placeholder="Search caregiver name" />
            <FilterSelect label="Ages" value={search.age} options={options.ages} onChange={(age) => set({ age })} className="sm:w-[130px]" />
            <FilterSelect label="Areas" value={search.area} options={options.areas} onChange={(area) => set({ area })} className="sm:w-[150px]" />
            <FilterSelect label="Education" value={search.education} options={options.education} onChange={(education) => set({ education })} className="sm:w-[150px]" />
            <FilterSelect label="Experience" value={search.exp} options={options.exp} onChange={(exp) => set({ exp })} className="sm:w-[140px]" />
          </FilterBar>
          <DataTable
            rows={rows}
            columns={columns}
            rowKey={(c) => c.key}
            onRowClick={(c) => set({ id: c.key })}
            initialSort={{ key: "sl", dir: "asc" }}
            resetKey={JSON.stringify({ ...search, id: undefined })}
            rowClassName={(c) => (c.complete ? undefined : "bg-warning-soft/40")}
          />
        </Panel>
        <div className="space-y-4">
          <Panel title="Education (shown)">
            <RankedBars data={edu} tone="teal" onSelect={(education) => set({ education })} />
          </Panel>
          <p className="flex gap-2 px-1 text-xs text-muted-foreground">
            <Lock className="mt-0.5 size-3 shrink-0" />
            Mobile numbers are masked on the server and never sent to the browser in full.
          </p>
        </div>
      </div>
      <CaregiverDrawer caregiver={selected} onClose={() => set({ id: undefined })} />
    </>
  );
}
