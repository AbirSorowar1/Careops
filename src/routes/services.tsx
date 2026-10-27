import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { z } from "zod";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataGate, MissingSheetNotice } from "@/components/dashboard/states";
import { Notice, PageHeader, Panel } from "@/components/dashboard/page";
import { FilterBar, FilterSelect } from "@/components/dashboard/filters";
import { DonutChart, RankedBars } from "@/components/dashboard/charts";
import { useDataset } from "@/hooks/use-dashboard-data";
import { countBy, distinct } from "@/lib/data/metrics";
import { filterClients } from "@/lib/data/records";
import { formatPercent } from "@/lib/data/format";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  type: z.string().optional().catch(undefined),
  category: z.string().optional().catch(undefined),
  area: z.string().optional().catch(undefined),
});

export const Route = createFileRoute("/services")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Services & Demand Analysis — CareOps Insight" },
      { name: "description", content: "Service type, category and area distribution of recorded clients." },
      { property: "og:title", content: "Services & Demand Analysis — CareOps Insight" },
      { property: "og:description", content: "Service type, category and area distribution of recorded clients." },
    ],
  }),
  component: () => (
    <DataGate>
      <ServicesPage />
    </DataGate>
  ),
});

function ServicesPage() {
  const ds = useDataset();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/services" });
  const set = (patch: Partial<z.infer<typeof searchSchema>>) => navigate({ search: (p) => ({ ...p, ...patch }), replace: true });

  const rows = useMemo(() => filterClients(ds.clients, search), [ds, search]);
  const options = useMemo(
    () => ({
      types: distinct(ds.clients, (c) => c.serviceType.group),
      categories: distinct(ds.clients, (c) => c.category.group),
      areas: distinct(ds.clients, (c) => c.area.group),
    }),
    [ds],
  );
  const types = useMemo(() => countBy(rows, (c) => c.serviceType.group, { includeBlank: true }), [rows]);
  const cats = useMemo(() => countBy(rows, (c) => c.category.group, { includeBlank: true }), [rows]);
  const areas = useMemo(() => countBy(rows, (c) => c.area.group, { includeBlank: true }), [rows]);

  // Service mix by area (top areas × all types)
  const matrix = useMemo(() => {
    const topAreas = countBy(rows, (c) => c.area.group).slice(0, 8).map((a) => a.label);
    const typeLabels = countBy(rows, (c) => c.serviceType.group).map((t) => t.label);
    const cells = topAreas.map((area) => ({
      area,
      counts: typeLabels.map((t) => rows.filter((c) => c.area.group === area && c.serviceType.group === t).length),
    }));
    const max = Math.max(1, ...cells.flatMap((c) => c.counts));
    return { topAreas, typeLabels, cells, max };
  }, [rows]);

  if (!ds.hasClientSheet) return <MissingSheetNotice what="client" />;

  const drill = (patch: Partial<z.infer<typeof searchSchema>>) =>
    navigate({ to: "/clients", search: { ...search, ...patch } });

  return (
    <>
      <PageHeader
        title="Services & Demand Analysis"
        description="How recorded client records are spread across service types, categories and areas. Counts are client records in the sheet — the sheet does not say whether a service is currently active."
        actions={
          <Button variant="subtle" size="sm" onClick={() => navigate({ to: "/clients", search })}>
            View {rows.length} clients <ArrowRight />
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

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Service type distribution" description="Click to filter this page">
          <DonutChart data={types} centerLabel="records" maxSlices={8} onSelect={(type) => set({ type })} />
        </Panel>
        <Panel title="Service category distribution" description="Click to filter this page">
          <DonutChart data={cats} centerLabel="records" onSelect={(category) => set({ category })} />
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Most common service types" description="Ranked · click to open the client list">
          <RankedBars data={types} onSelect={(type) => drill({ type })} />
        </Panel>
        <Panel title="Service area distribution" description="Ranked · click to open the client list">
          <RankedBars data={areas} tone="teal" onSelect={(area) => drill({ area })} />
        </Panel>
      </div>

      <Panel className="mt-4" title="Service mix by area" description="Client records per service type in the top areas · click a cell to see the records" bodyClassName="p-0">
        {matrix.cells.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Area</th>
                  {matrix.typeLabels.map((t) => (
                    <th key={t} className="whitespace-nowrap px-3 py-2.5 text-center text-xs font-semibold text-muted-foreground">{t}</th>
                  ))}
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground">Total</th>
                </tr>
              </thead>
              <tbody>
                {matrix.cells.map((row) => (
                  <tr key={row.area} className="border-b border-border last:border-0">
                    <td className="max-w-[16rem] truncate px-4 py-2 font-medium" title={row.area}>{row.area}</td>
                    {row.counts.map((n, i) => (
                      <td key={i} className="px-1.5 py-1.5 text-center">
                        {n > 0 ? (
                          <button
                            type="button"
                            onClick={() => drill({ area: row.area, type: matrix.typeLabels[i] })}
                            className={cn("w-full rounded-md py-1.5 text-xs font-semibold tabular transition-opacity hover:opacity-80", n / matrix.max > 0.5 ? "bg-brand text-primary-foreground" : n / matrix.max > 0.2 ? "bg-brand/40 text-foreground" : "bg-brand-soft text-brand")}
                          >
                            {n}
                          </button>
                        ) : (
                          <span className="text-xs text-muted-foreground/50">·</span>
                        )}
                      </td>
                    ))}
                    <td className="px-4 py-2 text-right font-semibold tabular">{row.counts.reduce((a, b) => a + b, 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="p-6 text-sm text-muted-foreground">No records match the filters.</p>
        )}
      </Panel>

      <Panel className="mt-4" title="Percentage share" description="Share of filtered client records" bodyClassName="p-0">
        <div className="grid divide-y divide-border md:grid-cols-3 md:divide-x md:divide-y-0">
          {[
            { title: "Service type", data: types },
            { title: "Category", data: cats },
            { title: "Area", data: areas },
          ].map((g) => (
            <div key={g.title} className="p-5">
              <p className="eyebrow mb-3">{g.title}</p>
              <ul className="space-y-1.5 text-sm">
                {g.data.map((r) => (
                  <li key={r.label} className="flex justify-between gap-3">
                    <span className="truncate" title={r.label}>{r.label}</span>
                    <span className="shrink-0 text-muted-foreground tabular">
                      {r.count} · <span className="font-medium text-foreground">{formatPercent(r.share, 1)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Panel>

      {ds.labelRules.some((r) => r.field === "Service type" || r.field === "Service area") && (
        <div className="mt-4">
          <Notice>
            Labels are grouped after removing extra spaces and fixing obvious spelling variants (for example “Dimentia” → “Dementia”, “Dailysis” → “Dialysis”). The original spreadsheet values are not changed. See every rule on the Data Quality page.
          </Notice>
        </div>
      )}
    </>
  );
}
