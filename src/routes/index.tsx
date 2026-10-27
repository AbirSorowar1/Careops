import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Users,
  HeartHandshake,
  ClipboardCheck,
  UserCheck,
  Stethoscope,
  MapPin,
  Wallet,
  HandCoins,
  AlertTriangle,
  Printer,
  ArrowRight,
  Lightbulb,
  History,
} from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataGate } from "@/components/dashboard/states";
import { KpiCard, PageHeader, Panel, Notice } from "@/components/dashboard/page";
import { ColumnChart, ComparisonChart, CompletenessBar, DonutChart, RankedBars, SERIES } from "@/components/dashboard/charts";
import { useDashboard, useDataset } from "@/hooks/use-dashboard-data";
import {
  AGE_GROUP_ORDER,
  EXPERIENCE_ORDER,
  ageGroup,
  countBy,
  experienceGroup,
  moneyBreakdown,
  orderRows,
  summariseMoney,
} from "@/lib/data/metrics";
import { buildInsights } from "@/lib/data/insights";
import { formatCompactMoney, formatMoney, formatNumber, formatPercent, formatTime } from "@/lib/data/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Executive Overview — CareOps Insight" },
      { name: "description", content: "Headline client, caregiver, service and payment figures from the live spreadsheet." },
      { property: "og:title", content: "Executive Overview — CareOps Insight" },
      { property: "og:description", content: "Headline client, caregiver, service and payment figures from the live spreadsheet." },
    ],
  }),
  component: OverviewPage,
});

function OverviewPage() {
  return (
    <DataGate>
      <Overview />
    </DataGate>
  );
}

function Overview() {
  const ds = useDataset();
  const { settings, changes, lastSuccessAt } = useDashboard();
  const navigate = useNavigate();
  const cur = settings.currency;
  const { clients, caregivers } = ds;

  const m = useMemo(() => {
    const types = countBy(clients, (c) => c.serviceType.group);
    const areas = countBy(clients, (c) => c.area.group);
    const cats = countBy(clients, (c) => c.category.group);
    const ages = orderRows(countBy(caregivers, (c) => ageGroup(c.age)), AGE_GROUP_ORDER);
    const exp = orderRows(countBy(caregivers, (c) => experienceGroup(c.experienceYears)), EXPERIENCE_ORDER);
    const cp = summariseMoney(clients, (c) => c.clientPay);
    const gp = summariseMoney(clients, (c) => c.caregiverPay);
    const byCat = moneyBreakdown(clients, (c) => c.category.group).map((r) => ({
      label: r.label,
      client: r.clientPay,
      caregiver: r.caregiverPay,
    }));
    const recordsWithIssues = new Set(
      ds.issues.filter((i) => i.severity !== "info").map((i) => i.recordKey),
    ).size;
    return { types, areas, cats, ages, exp, cp, gp, byCat, recordsWithIssues };
  }, [ds, clients, caregivers]);

  const insights = useMemo(() => buildInsights(ds, cur), [ds, cur]);
  const clientComplete = clients.filter((c) => c.complete).length;
  const cgComplete = caregivers.filter((c) => c.complete).length;
  const hasClientPay = ds.clientColumns.has("clientPay");
  const hasCgPay = ds.clientColumns.has("caregiverPay");

  return (
    <>
      <PageHeader
        title="Executive Overview"
        description={
          <>
            Live summary of <span className="font-medium text-foreground">{ds.title}</span>. Every figure is calculated
            from the latest successful sync at {formatTime(lastSuccessAt)}.
          </>
        }
        actions={
          <>
            <Button variant="subtle" size="sm" asChild>
              <Link to="/print/$report" params={{ report: "executive" }}>
                <Printer /> Print summary
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard label="Total clients" value={formatNumber(clients.length)} icon={Users} hint={`Rows in the “${ds.mappings.find((x) => x.role === "clients")?.sheet ?? "—"}” tab`} />
        <KpiCard label="Total caregivers" value={formatNumber(caregivers.length)} icon={HeartHandshake} tone="teal" hint={`Rows in the “${ds.mappings.find((x) => x.role === "caregivers")?.sheet ?? "—"}” tab`} />
        <KpiCard
          label="Complete client records"
          value={<>{formatNumber(clientComplete)}<span className="ml-1 text-base font-medium text-muted-foreground">/ {clients.length}</span></>}
          icon={ClipboardCheck}
          tone="success"
          hint={clients.length ? `${formatPercent(clientComplete / clients.length)} have every mapped field filled` : undefined}
        />
        <KpiCard
          label="Complete caregiver records"
          value={<>{formatNumber(cgComplete)}<span className="ml-1 text-base font-medium text-muted-foreground">/ {caregivers.length}</span></>}
          icon={UserCheck}
          tone={cgComplete === caregivers.length ? "success" : "warning"}
          hint={caregivers.length ? `${formatPercent(cgComplete / caregivers.length)} have age, address, education, experience and a valid mobile` : undefined}
        />
        <KpiCard label="Service types" value={m.types.length} icon={Stethoscope} tone="navy" hint={m.types.slice(0, 3).map((t) => t.label).join(", ")} />
        <KpiCard label="Service areas" value={m.areas.length} icon={MapPin} tone="navy" hint="Distinct areas after spelling and spacing clean-up" />
        {hasClientPay && (
          <KpiCard
            label="Recorded client payments"
            value={formatCompactMoney(m.cp.total, cur)}
            icon={Wallet}
            hint={`${formatMoney(m.cp.total, cur)} across ${m.cp.recordedCount} records${m.cp.missingCount ? ` · ${m.cp.missingCount} blank` : ""}`}
          />
        )}
        {hasCgPay && (
          <KpiCard
            label="Recorded caregiver payments"
            value={formatCompactMoney(m.gp.total, cur)}
            icon={HandCoins}
            tone="teal"
            hint={`${formatMoney(m.gp.total, cur)} from ${m.gp.amountCount} amounts (merged cells counted once)`}
          />
        )}
        <KpiCard
          label="Records with missing or invalid info"
          value={formatNumber(m.recordsWithIssues)}
          icon={AlertTriangle}
          tone={m.recordsWithIssues ? "warning" : "success"}
          hint="Clients and caregivers combined"
          footer={
            <Link to="/data-quality" className="no-print inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline">
              Review records <ArrowRight className="size-3" />
            </Link>
          }
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Panel title="Clients by service type" description="Click a slice to see those clients" info="Labels with obvious spelling variants (e.g. “Dimentia”) are grouped. Original values are kept in the sheet.">
          <DonutChart data={m.types} centerLabel="clients" onSelect={(type) => navigate({ to: "/clients", search: { type } })} />
        </Panel>
        <Panel title="Clients by service area" description="Ranked by recorded client count">
          <RankedBars data={m.areas} max={8} onSelect={(area) => navigate({ to: "/clients", search: { area } })} />
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel title="Service categories" description="Client records per category">
          <ColumnChart data={m.cats} color={SERIES[2]} valueLabel="Clients" onSelect={(category) => navigate({ to: "/clients", search: { category } })} />
        </Panel>
        <Panel title="Caregivers by age group" description={ds.caregiverColumns.has("age") ? "From the Age column" : "No age column found"}>
          <ColumnChart data={m.ages} color={SERIES[1]} valueLabel="Caregivers" onSelect={(age) => navigate({ to: "/caregivers", search: { age } })} />
        </Panel>
        <Panel title="Caregiver work experience" description="Years recorded in the sheet">
          <ColumnChart data={m.exp} color={SERIES[0]} valueLabel="Caregivers" onSelect={(exp) => navigate({ to: "/caregivers", search: { exp } })} />
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        {hasClientPay && hasCgPay && (
          <Panel
            title="Recorded client pay vs caregiver payments"
            description="By service category"
            info="Merged caregiver payments are split evenly across the client rows they cover for this breakdown. The sheet does not say which period amounts refer to, so this is not a profit figure."
          >
            <ComparisonChart
              data={m.byCat}
              series={[
                { key: "client", name: "Client pay", color: SERIES[0] },
                { key: "caregiver", name: "Caregiver payment", color: SERIES[1] },
              ]}
              formatter={(v) => formatCompactMoney(v, cur)}
              onSelect={(category) => navigate({ to: "/financial", search: { category } })}
            />
          </Panel>
        )}
        <Panel title="Data completeness" description="Records with every mapped field filled and valid">
          <div className="space-y-6">
            <div>
              <p className="mb-2 text-sm font-medium">Clients</p>
              <CompletenessBar
                segments={[
                  { label: "Complete", value: clientComplete, tone: "success" },
                  { label: "Incomplete", value: clients.length - clientComplete, tone: "warning" },
                ]}
              />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Caregivers</p>
              <CompletenessBar
                segments={[
                  { label: "Complete", value: cgComplete, tone: "success" },
                  { label: "Incomplete", value: caregivers.length - cgComplete, tone: "warning" },
                ]}
              />
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-muted px-3 py-2.5">
                <p className="text-xs text-muted-foreground">Top service type</p>
                <p className="font-semibold">{m.types[0]?.label ?? "—"}</p>
              </div>
              <div className="rounded-lg bg-muted px-3 py-2.5">
                <p className="text-xs text-muted-foreground">Top service area</p>
                <p className="truncate font-semibold" title={m.areas[0]?.label}>{m.areas[0]?.label ?? "—"}</p>
              </div>
            </div>
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Panel title={<><Lightbulb className="size-4 text-brand" /> Key insights</>} description="Calculated from the current data; updates on every sync">
          <ul className="divide-y divide-border">
            {insights.map((i) => (
              <li key={i.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", i.tone === "warning" ? "bg-warning" : i.tone === "success" ? "bg-success" : "bg-brand")} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{i.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{i.body}</p>
                </div>
                {i.link && (
                  <Button variant="ghost" size="sm" className="no-print h-7 shrink-0 text-xs" onClick={() => navigate({ to: i.link!.to, search: i.link!.search ?? {} })}>
                    View <ArrowRight className="size-3" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </Panel>
        <RecentActivity />
      </div>

      {ds.notes.length > 0 && (
        <div className="mt-4 space-y-2">
          {ds.notes.slice(0, 2).map((n) => (
            <Notice key={n}>{n}</Notice>
          ))}
        </div>
      )}
    </>
  );
}

function RecentActivity() {
  const ds = useDataset();
  const { changes } = useDashboard();
  const latest = [...ds.clients].sort((a, b) => b.rowNumber - a.rowNumber).slice(0, 6);
  return (
    <Panel
      title={<><History className="size-4 text-teal" /> {changes.length ? "Changes detected" : "Recently retrieved records"}</>}
      description={
        changes.length
          ? "Differences found between syncs while this page has been open"
          : "The sheet has no timestamps, so these are simply the last client rows in the sheet"
      }
    >
      {changes.length ? (
        <ul className="space-y-2.5">
          {changes.slice(0, 8).map((c) => (
            <li key={c.id} className="flex items-center gap-2.5 text-sm">
              <Badge variant={c.kind === "added" ? "success" : c.kind === "removed" ? "danger" : "info"} className="w-[4.5rem] justify-center">
                {c.kind}
              </Badge>
              <span className="min-w-0 flex-1 truncate">{c.label}</span>
              <span className="text-xs text-muted-foreground tabular">{formatTime(c.at)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="space-y-2.5">
          {latest.map((c) => (
            <li key={c.key}>
              <Link to="/clients" search={{ id: c.key }} className="flex items-center gap-3 rounded-md text-sm hover:text-brand">
                <span className="w-12 text-xs text-muted-foreground tabular">Row {c.rowNumber}</span>
                <span className="min-w-0 flex-1 truncate font-medium">{c.name.value ?? "Unnamed"}</span>
                <span className="text-xs text-muted-foreground">{c.serviceType.group ?? "—"}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
