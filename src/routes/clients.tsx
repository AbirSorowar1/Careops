import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { z } from "zod";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataGate, MissingSheetNotice } from "@/components/dashboard/states";
import { PageHeader, Panel } from "@/components/dashboard/page";
import { DataTable, type Column } from "@/components/dashboard/data-table";
import { FilterBar, FilterSelect, SearchInput } from "@/components/dashboard/filters";
import { ClientDrawer } from "@/components/dashboard/record-drawers";
import { CompletenessBadge, MoneyValue, TextValue } from "@/components/dashboard/values";
import { useDashboard, useDataset } from "@/hooks/use-dashboard-data";
import { distinct, summariseMoney } from "@/lib/data/metrics";
import type { ClientRecord } from "@/lib/data/types";
import { downloadCsv, exportFilename } from "@/lib/export";
import { clientCsv, filterClients } from "@/lib/data/records";
import { formatDateTime, formatMoney } from "@/lib/data/format";

const searchSchema = z.object({
  q: z.string().optional().catch(undefined),
  type: z.string().optional().catch(undefined),
  category: z.string().optional().catch(undefined),
  area: z.string().optional().catch(undefined),
  status: z.enum(["complete", "incomplete"]).optional().catch(undefined),
  id: z.string().optional().catch(undefined),
});

export const Route = createFileRoute("/clients")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Client Management — CareOps Insight" },
      { name: "description", content: "Searchable client directory with service, area and payment details." },
      { property: "og:title", content: "Client Management — CareOps Insight" },
      { property: "og:description", content: "Searchable client directory with service, area and payment details." },
    ],
  }),
  component: () => (
    <DataGate>
      <ClientsPage />
    </DataGate>
  ),
});

function ClientsPage() {
  const ds = useDataset();
  const { settings, lastSuccessAt } = useDashboard();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/clients" });
  const cur = settings.currency;

  const set = (patch: Partial<z.infer<typeof searchSchema>>) =>
    navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true });

  const options = useMemo(
    () => ({
      types: distinct(ds.clients, (c) => c.serviceType.group),
      categories: distinct(ds.clients, (c) => c.category.group),
      areas: distinct(ds.clients, (c) => c.area.group),
    }),
    [ds],
  );

  const rows = useMemo(() => filterClients(ds.clients, search), [ds, search]);
  const selected = search.id ? ds.clients.find((c) => c.key === search.id) ?? null : null;
  const active = !!(search.q || search.type || search.category || search.area || search.status);
  const cp = summariseMoney(rows, (c) => c.clientPay);
  const gp = summariseMoney(rows, (c) => c.caregiverPay);

  if (!ds.hasClientSheet) return <MissingSheetNotice what="client" />;

  const columns: Column<ClientRecord>[] = [
    { key: "id", header: "Customer ID", cell: (c) => <span className="font-mono text-xs">{c.customerId ?? "—"}</span>, sortValue: (c) => c.customerId },
    { key: "name", header: "Client name", cell: (c) => <span className="font-medium">{c.name.value ?? "—"}</span>, sortValue: (c) => c.name.value },
    { key: "category", header: "Category", cell: (c) => <TextValue field={c.category} />, sortValue: (c) => c.category.group, hideBelow: "lg" },
    { key: "area", header: "Service area", cell: (c) => <span className="block max-w-[14rem] truncate"><TextValue field={c.area} /></span>, sortValue: (c) => c.area.group, hideBelow: "md" },
    { key: "type", header: "Service type", cell: (c) => <TextValue field={c.serviceType} />, sortValue: (c) => c.serviceType.group, hideBelow: "sm" },
    { key: "pay", header: "Client pay", align: "right", cell: (c) => <MoneyValue field={c.clientPay} currency={cur} />, sortValue: (c) => c.clientPay.amount },
    { key: "cg", header: "Caregiver payment", align: "right", cell: (c) => <MoneyValue field={c.caregiverPay} currency={cur} />, sortValue: (c) => c.caregiverPay.amount, hideBelow: "md" },
    { key: "status", header: "Record", cell: (c) => <CompletenessBadge complete={c.complete} missing={c.missingFields} />, sortValue: (c) => (c.complete ? 1 : 0), hideBelow: "lg" },
  ];

  const exportRows = () =>
    downloadCsv(
      exportFilename("clients"),
      clientCsv(rows, [
        `Client directory — ${ds.title}`,
        `Generated ${formatDateTime(new Date().toISOString())}; data last synced ${formatDateTime(lastSuccessAt)}`,
        `Filters: ${[search.q && `search "${search.q}"`, search.type, search.category, search.area, search.status].filter(Boolean).join(", ") || "none"}`,
        `Amounts in ${cur}. Blank = not recorded in sheet.`,
      ]),
    );

  return (
    <>
      <PageHeader
        title="Client Management"
        description="Every client row from the spreadsheet. Click a row to see full details and any data issues."
        actions={
          <Button variant="subtle" size="sm" onClick={exportRows} disabled={!rows.length}>
            <Download /> Export {rows.length} rows (CSV)
          </Button>
        }
      />
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <div className="surface px-4 py-3">
          <p className="text-xs text-muted-foreground">Clients shown</p>
          <p className="font-display text-xl font-bold tabular">{rows.length}</p>
        </div>
        <div className="surface px-4 py-3">
          <p className="text-xs text-muted-foreground">Recorded client pay (shown)</p>
          <p className="font-display text-xl font-bold tabular">{formatMoney(cp.total, cur)}</p>
        </div>
        <div className="surface px-4 py-3">
          <p className="text-xs text-muted-foreground">Recorded caregiver payments (shown)</p>
          <p className="font-display text-xl font-bold tabular">{formatMoney(gp.total, cur)}</p>
        </div>
      </div>
      <Panel bodyClassName="p-0">
        <FilterBar
          active={active}
          onReset={() => navigate({ search: {}, replace: true })}
          count={rows.length}
          total={ds.clients.length}
          noun="clients"
        >
          <SearchInput value={search.q ?? ""} onChange={(q) => set({ q: q || undefined })} placeholder="Search name or customer ID" />
          <FilterSelect label="Service types" value={search.type} options={options.types} onChange={(type) => set({ type })} />
          <FilterSelect label="Categories" value={search.category} options={options.categories} onChange={(category) => set({ category })} />
          <FilterSelect label="Areas" value={search.area} options={options.areas} onChange={(area) => set({ area })} />
          <FilterSelect
            label="Records"
            value={search.status === "complete" ? "Complete" : search.status === "incomplete" ? "Incomplete" : undefined}
            options={["Complete", "Incomplete"]}
            onChange={(v) => set({ status: v === "Complete" ? "complete" : v === "Incomplete" ? "incomplete" : undefined })}
            className="sm:w-[150px]"
          />
        </FilterBar>
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(c) => c.key}
          onRowClick={(c) => set({ id: c.key })}
          initialSort={{ key: "id", dir: "asc" }}
          resetKey={JSON.stringify({ ...search, id: undefined })}
          rowClassName={(c) => (c.complete ? undefined : "bg-warning-soft/40")}
          emptyDescription="Try clearing the search or filters."
        />
      </Panel>
      <ClientDrawer client={selected} onClose={() => set({ id: undefined })} />
    </>
  );
}
