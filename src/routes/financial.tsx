import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { z } from "zod";
import { Wallet, HandCoins, Calculator, AlertTriangle, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataGate, MissingSheetNotice } from "@/components/dashboard/states";
import { KpiCard, Notice, PageHeader, Panel } from "@/components/dashboard/page";
import { FilterBar, FilterSelect } from "@/components/dashboard/filters";
import { ComparisonChart, SERIES } from "@/components/dashboard/charts";
import { DataTable, type Column } from "@/components/dashboard/data-table";
import { MoneyValue, TextValue } from "@/components/dashboard/values";
import { ClientDrawer } from "@/components/dashboard/record-drawers";
import { useDashboard, useDataset } from "@/hooks/use-dashboard-data";
import { distinct, moneyBreakdown, summariseMoney } from "@/lib/data/metrics";
import { filterClients } from "@/lib/data/records";
import type { ClientRecord } from "@/lib/data/types";
import { formatCompactMoney, formatDateTime, formatMoney, formatNumber } from "@/lib/data/format";
import { downloadCsv, exportFilename, toCsv } from "@/lib/export";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const searchSchema = z.object({
  type: z.string().optional().catch(undefined),
  category: z.string().optional().catch(undefined),
  area: z.string().optional().catch(undefined),
});

export const Route = createFileRoute("/financial")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Financial Overview — CareOps Insight" },
      { name: "description", content: "Recorded client pay and caregiver payments by service type and area." },
      { property: "og:title", content: "Financial Overview — CareOps Insight" },
      { property: "og:description", content: "Recorded client pay and caregiver payments by service type and area." },
    ],
  }),
  component: () => (
    <DataGate>
      <FinancialPage />
    </DataGate>
  ),
});

function FinancialPage() {
  const ds = useDataset();
  const { settings, lastSuccessAt } = useDashboard();
  const cur = settings.currency;
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/financial" });
  const set = (patch: Partial<z.infer<typeof searchSchema>>) => navigate({ search: (p) => ({ ...p, ...patch }), replace: true });
  const [dim, setDim] = useState<"type" | "area" | "category">("type");
  const [selected, setSelected] = useState<ClientRecord | null>(null);

  const rows = useMemo(() => filterClients(ds.clients, search), [ds, search]);
  const options = useMemo(
    () => ({
      types: distinct(ds.clients, (c) => c.serviceType.group),
      categories: distinct(ds.clients, (c) => c.category.group),
      areas: distinct(ds.clients, (c) => c.area.group),
    }),
    [ds],
  );
  const cp = useMemo(() => summariseMoney(rows, (c) => c.clientPay), [rows]);
  const gp = useMemo(() => summariseMoney(rows, (c) => c.caregiverPay), [rows]);
  const breakdown = useMemo(() => {
    const pick =
      dim === "type" ? (c: ClientRecord) => c.serviceType.group : dim === "area" ? (c: ClientRecord) => c.area.group : (c: ClientRecord) => c.category.group;
    return moneyBreakdown(rows, pick);
  }, [rows, dim]);

  const hasClientPay = ds.clientColumns.has("clientPay");
  const hasCgPay = ds.clientColumns.has("caregiverPay");
  if (!ds.hasClientSheet) return <MissingSheetNotice what="client" />;
  if (!hasClientPay && !hasCgPay) {
    return (
      <>
        <PageHeader title="Financial Overview" />
        <Notice tone="warning">No payment columns were found in the client worksheet.</Notice>
      </>
    );
  }

  const missingPayments = rows.filter((c) => c.clientPay.status === "missing" || c.clientPay.status === "invalid" || c.caregiverPay.status === "missing" || c.caregiverPay.status === "invalid").length;
  const fullCoverage = cp.missingCount + cp.invalidCount === 0 && gp.missingCount + gp.invalidCount === 0;
  const chartData = breakdown.slice(0, 12).map((r) => ({ label: r.label, client: Math.round(r.clientPay), caregiver: Math.round(r.caregiverPay) }));

  const columns: Column<ClientRecord>[] = [
    { key: "id", header: "Customer ID", cell: (c) => <span className="font-mono text-xs">{c.customerId ?? "—"}</span>, sortValue: (c) => c.customerId },
    { key: "name", header: "Client", cell: (c) => <span className="font-medium">{c.name.value ?? "—"}</span>, sortValue: (c) => c.name.value },
    { key: "type", header: "Service type", cell: (c) => <TextValue field={c.serviceType} />, sortValue: (c) => c.serviceType.group, hideBelow: "md" },
    { key: "area", header: "Area", cell: (c) => <span className="block max-w-[12rem] truncate"><TextValue field={c.area} /></span>, sortValue: (c) => c.area.group, hideBelow: "lg" },
    { key: "cp", header: "Client pay", align: "right", cell: (c) => <MoneyValue field={c.clientPay} currency={cur} />, sortValue: (c) => c.clientPay.amount },
    { key: "gp", header: "Caregiver payment", align: "right", cell: (c) => <MoneyValue field={c.caregiverPay} currency={cur} />, sortValue: (c) => c.caregiverPay.amount },
  ];

  const exportCsv = () =>
    downloadCsv(
      exportFilename("financial-summary"),
      toCsv(
        [dim === "type" ? "Service type" : dim === "area" ? "Service area" : "Service category", "Client records", "Recorded client pay", "Recorded caregiver payments (shared amounts split evenly)", "Rows missing client pay", "Rows missing caregiver payment"],
        breakdown.map((r) => [r.label, r.records, Math.round(r.clientPay), Math.round(r.caregiverPay), r.clientPayMissing, r.caregiverPayMissing]),
        [
          `Financial summary — ${ds.title}`,
          `Generated ${formatDateTime(new Date().toISOString())}; data last synced ${formatDateTime(lastSuccessAt)}`,
          `Amounts in ${cur}. Recorded amounts only; blanks are not counted as zero. Not a profit statement.`,
          `Totals: client pay ${cp.total}; caregiver payments ${gp.total} (merged amounts counted once)`,
        ],
      ),
    );

  return (
    <>
      <PageHeader
        title="Financial Overview"
        description={`Recorded payment amounts in ${cur}. The sheet does not state the period these amounts cover, so totals are sums of recorded values — not revenue or profit.`}
        actions={
          <Button variant="subtle" size="sm" onClick={exportCsv}>
            <Download /> Export summary (CSV)
          </Button>
        }
      />
      <Panel bodyClassName="p-0" className="mb-4">
        <FilterBar active={!!(search.type || search.category || search.area)} onReset={() => navigate({ search: {}, replace: true })} count={rows.length} total={ds.clients.length} noun="client records">
          <FilterSelect label="Service types" value={search.type} options={options.types} onChange={(type) => set({ type })} />
          <FilterSelect label="Categories" value={search.category} options={options.categories} onChange={(category) => set({ category })} />
          <FilterSelect label="Areas" value={search.area} options={options.areas} onChange={(area) => set({ area })} />
        </FilterBar>
      </Panel>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {hasClientPay && (
          <KpiCard label="Total recorded client pay" value={formatCompactMoney(cp.total, cur)} icon={Wallet} hint={`${formatMoney(cp.total, cur)} · ${cp.recordedCount} of ${rows.length} records`} />
        )}
        {hasCgPay && (
          <KpiCard label="Total recorded caregiver payments" value={formatCompactMoney(gp.total, cur)} icon={HandCoins} tone="teal" hint={`${formatMoney(gp.total, cur)} · ${gp.amountCount} amounts covering ${gp.recordedCount} records`} />
        )}
        <KpiCard
          label="Average recorded payment"
          value={formatMoney(cp.average, cur)}
          icon={Calculator}
          tone="navy"
          hint={`Client pay per record. Caregiver: ${formatMoney(gp.average, cur)} per recorded amount`}
        />
        <KpiCard
          label="Records with missing payment values"
          value={formatNumber(missingPayments)}
          icon={AlertTriangle}
          tone={missingPayments ? "warning" : "success"}
          hint={missingPayments ? "Blank or invalid cells — excluded, not counted as zero" : "Every filtered record has both amounts"}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Panel
          title="Client pay vs caregiver payments"
          description="Recorded amounts per group"
          info="Merged caregiver payments are split evenly across the rows they cover for this chart only. Totals elsewhere count each merged amount once."
          actions={
            <Tabs value={dim} onValueChange={(v) => setDim(v as typeof dim)}>
              <TabsList className="h-8">
                <TabsTrigger value="type" className="text-xs">Service type</TabsTrigger>
                <TabsTrigger value="area" className="text-xs">Area</TabsTrigger>
                <TabsTrigger value="category" className="text-xs">Category</TabsTrigger>
              </TabsList>
            </Tabs>
          }
        >
          <ComparisonChart
            data={chartData}
            layout="horizontal"
            height={Math.max(260, chartData.length * 42)}
            series={[
              { key: "client", name: "Client pay", color: SERIES[0] },
              { key: "caregiver", name: "Caregiver payment", color: SERIES[1] },
            ]}
            formatter={(v) => formatCompactMoney(v, cur)}
            onSelect={(label) => set(dim === "type" ? { type: label } : dim === "area" ? { area: label } : { category: label })}
          />
        </Panel>
        <Panel title="Recorded difference" description="Client pay minus caregiver payments">
          <p className="font-display text-3xl font-bold tabular">{formatMoney(cp.total - gp.total, cur)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatMoney(cp.total, cur)} − {formatMoney(gp.total, cur)}
          </p>
          <div className="mt-4 space-y-2 text-xs leading-relaxed text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">How it’s calculated:</span> the sum of every recorded client pay value minus the sum of every recorded caregiver payment (each merged amount counted once).
            </p>
            <p>
              <span className="font-medium text-foreground">Limitations:</span> the sheet doesn’t say which period (day, month, contract) each amount covers, and client pay and caregiver payments may not refer to the same period. This is <span className="font-medium text-foreground">not a profit figure</span>.
            </p>
            <p>{fullCoverage ? "Both payment fields are filled for every filtered record." : `Coverage differs: ${cp.missingCount + cp.invalidCount} client pay and ${gp.missingCount + gp.invalidCount} caregiver payment values are missing or invalid.`}</p>
          </div>
        </Panel>
      </div>

      <Panel className="mt-4" title="Breakdown table" bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-xs text-muted-foreground">
                <th className="px-4 py-2.5 text-left font-semibold">{dim === "type" ? "Service type" : dim === "area" ? "Service area" : "Category"}</th>
                <th className="px-4 py-2.5 text-right font-semibold">Records</th>
                <th className="px-4 py-2.5 text-right font-semibold">Client pay</th>
                <th className="px-4 py-2.5 text-right font-semibold">Avg client pay</th>
                <th className="px-4 py-2.5 text-right font-semibold">Caregiver payments</th>
                <th className="px-4 py-2.5 text-right font-semibold">Missing values</th>
              </tr>
            </thead>
            <tbody>
              {breakdown.map((r) => (
                <tr key={r.label} className="border-b border-border last:border-0">
                  <td className="max-w-[16rem] truncate px-4 py-2 font-medium" title={r.label}>{r.label}</td>
                  <td className="px-4 py-2 text-right tabular">{r.records}</td>
                  <td className="px-4 py-2 text-right tabular">{formatMoney(r.clientPay, cur)}</td>
                  <td className="px-4 py-2 text-right tabular text-muted-foreground">
                    {r.records - r.clientPayMissing ? formatMoney(r.clientPay / (r.records - r.clientPayMissing), cur) : "—"}
                  </td>
                  <td className="px-4 py-2 text-right tabular">{formatMoney(r.caregiverPay, cur)}</td>
                  <td className="px-4 py-2 text-right tabular">{r.clientPayMissing + r.caregiverPayMissing || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel className="mt-4" title="Record-level payments" description="Click a row for details" bodyClassName="p-0">
        <DataTable rows={rows} columns={columns} rowKey={(c) => c.key} onRowClick={setSelected} initialSort={{ key: "cp", dir: "desc" }} resetKey={JSON.stringify(search)} pageSize={10} />
      </Panel>
      <ClientDrawer client={selected} onClose={() => setSelected(null)} />
    </>
  );
}
