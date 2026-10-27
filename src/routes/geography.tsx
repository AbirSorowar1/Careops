import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { DataGate } from "@/components/dashboard/states";
import { Notice, PageHeader, Panel } from "@/components/dashboard/page";
import { ComparisonChart, RankedBars, SERIES } from "@/components/dashboard/charts";
import { SearchInput } from "@/components/dashboard/filters";
import { DataTable, type Column } from "@/components/dashboard/data-table";
import { useDataset } from "@/hooks/use-dashboard-data";
import { countBy } from "@/lib/data/metrics";

export const Route = createFileRoute("/geography")({
  head: () => ({
    meta: [
      { title: "Geographic Analysis — CareOps Insight" },
      { name: "description", content: "Client service areas and caregiver locations compared area by area." },
      { property: "og:title", content: "Geographic Analysis — CareOps Insight" },
      { property: "og:description", content: "Client service areas and caregiver locations compared area by area." },
    ],
  }),
  component: () => (
    <DataGate>
      <GeographyPage />
    </DataGate>
  ),
});

interface AreaRow {
  area: string;
  clients: number;
  caregivers: number;
}

function GeographyPage() {
  const ds = useDataset();
  const navigate = useNavigate();
  const [grouped, setGrouped] = useState(true);
  const [q, setQ] = useState("");

  const clientArea = (c: (typeof ds.clients)[number]) => (grouped ? c.areaZone : c.area.group);
  const cgArea = (c: (typeof ds.caregivers)[number]) => (grouped ? c.addressZone : c.address.group);

  const clientAreas = useMemo(() => countBy(ds.clients, clientArea), [ds, grouped]);
  const cgAreas = useMemo(() => countBy(ds.caregivers, cgArea), [ds, grouped]);
  const table = useMemo(() => {
    const m = new Map<string, AreaRow>();
    for (const r of clientAreas) m.set(r.label, { area: r.label, clients: r.count, caregivers: 0 });
    for (const r of cgAreas) {
      const e = m.get(r.label) ?? { area: r.label, clients: 0, caregivers: 0 };
      e.caregivers = r.count;
      m.set(r.label, e);
    }
    return [...m.values()].sort((a, b) => b.clients + b.caregivers - (a.clients + a.caregivers));
  }, [clientAreas, cgAreas]);
  const filtered = table.filter((r) => r.area.toLowerCase().includes(q.trim().toLowerCase()));
  const chart = table.slice(0, 12).map((r) => ({ label: r.area, clients: r.clients, caregivers: r.caregivers }));
  const noClientArea = ds.clients.filter((c) => !c.area.value).length;
  const noCgArea = ds.caregivers.filter((c) => !c.address.value).length;

  const drillClients = (label: string) => navigate({ to: "/clients", search: { area: label } });

  const columns: Column<AreaRow>[] = [
    { key: "area", header: "Area", cell: (r) => <span className="font-medium">{r.area}</span>, sortValue: (r) => r.area },
    { key: "clients", header: "Client records", align: "right", cell: (r) => r.clients || "—", sortValue: (r) => r.clients },
    { key: "caregivers", header: "Caregivers living here", align: "right", cell: (r) => r.caregivers || "—", sortValue: (r) => r.caregivers },
  ];

  return (
    <>
      <PageHeader
        title="Geographic Analysis"
        description="Client service areas and caregiver home addresses, counted separately. The sheet does not link caregivers to clients, so these are not assignments."
        actions={
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 shadow-card">
            <Switch id="group-sectors" checked={grouped} onCheckedChange={setGrouped} />
            <Label htmlFor="group-sectors" className="text-xs">Group sectors (Mirpur-1, Mirpur-12 → Mirpur)</Label>
          </div>
        }
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Top areas by recorded clients" description={`${noClientArea ? `${noClientArea} client records have no area` : "From the Service Area column"}${grouped ? "" : " · click to see clients"}`}>
          <RankedBars data={clientAreas} max={10} onSelect={grouped ? undefined : drillClients} />
        </Panel>
        <Panel title="Caregivers by home area" description={noCgArea ? `${noCgArea} caregivers have no address` : "From the Present Address column"}>
          <RankedBars data={cgAreas} max={10} tone="teal" />
        </Panel>
      </div>
      <Panel className="mt-4" title="Clients and caregivers per area" description="Top 12 areas by combined count · separate counts, not assignments">
        <ComparisonChart
          data={chart}
          layout="horizontal"
          height={Math.max(300, chart.length * 40)}
          series={[
            { key: "clients", name: "Client records", color: SERIES[0] },
            { key: "caregivers", name: "Caregivers", color: SERIES[1] },
          ]}
          formatter={(v) => String(v)}
        />
      </Panel>
      <Panel className="mt-4" title="All areas" bodyClassName="p-0" actions={<SearchInput value={q} onChange={setQ} placeholder="Search areas" />}>
        <DataTable rows={filtered} columns={columns} rowKey={(r) => r.area} pageSize={12} resetKey={q + grouped} />
      </Panel>
      <div className="mt-4">
        <Notice>
          No map is shown: the addresses are neighbourhood names (e.g. “Kalachadpur, Nagda”), which can’t be placed on a map accurately. Spelling and spacing are standardised for grouping only.
        </Notice>
      </div>
    </>
  );
}
