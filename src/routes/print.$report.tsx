import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataGate } from "@/components/dashboard/states";
import { RankedBars } from "@/components/dashboard/charts";
import { useDashboard, useDataset } from "@/hooks/use-dashboard-data";
import { countBy, moneyBreakdown, summariseMoney, ageGroup, AGE_GROUP_ORDER, orderRows } from "@/lib/data/metrics";
import { ISSUE_LABELS } from "@/lib/data/records";
import { formatDateTime, formatMoney, formatPercent } from "@/lib/data/format";
import { REPORT_IDS, type ReportId } from "@/lib/reports";


const TITLES: Record<ReportId, string> = {
  executive: "Executive Overview",
  services: "Service Distribution Report",
  clients: "Client Directory",
  caregivers: "Caregiver Directory",
  financial: "Financial Summary",
  "data-quality": "Data Quality Report",
};

export const Route = createFileRoute("/print/$report")({
  params: {
    parse: (p) => {
      if (!(REPORT_IDS as readonly string[]).includes(p.report)) throw notFound();
      return { report: p.report as ReportId };
    },
    stringify: (p) => ({ report: p.report }),
  },
  head: ({ params }) => {
    const title = `${TITLES[params.report as ReportId] ?? "Report"} — CareOps Insight`;
    return {
      meta: [
        { title },
        { name: "description", content: "Printable management report generated from the live spreadsheet." },
        { property: "og:title", content: title },
        { property: "og:description", content: "Printable management report generated from the live spreadsheet." },
      ],
    };
  },
  component: PrintRoute,
});

function PrintRoute() {
  return (
    <div className="min-h-screen bg-background py-8 print:bg-card print:py-0">
      <DataGate>
        <PrintReport />
      </DataGate>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8 break-inside-avoid">
      <h2 className="mb-3 border-b border-border pb-2 text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function SimpleTable({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-border text-left text-muted-foreground">
          {head.map((h, i) => (
            <th key={h} className={`py-1.5 pr-3 font-semibold ${i > 0 ? "text-right" : ""}`}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b border-border/60 last:border-0">
            {r.map((c, j) => (
              <td key={j} className={`py-1.5 pr-3 ${j > 0 ? "text-right tabular" : ""}`}>{c}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PrintReport() {
  const { report } = Route.useParams();
  const ds = useDataset();
  const { lastSuccessAt, settings } = useDashboard();
  const cur = settings.currency;
  const cp = summariseMoney(ds.clients, (c) => c.clientPay);
  const gp = summariseMoney(ds.clients, (c) => c.caregiverPay);
  const types = countBy(ds.clients, (c) => c.serviceType.group, { includeBlank: true });
  const cats = countBy(ds.clients, (c) => c.category.group, { includeBlank: true });
  const areas = countBy(ds.clients, (c) => c.area.group, { includeBlank: true });
  const review = ds.issues.filter((i) => i.severity !== "info");

  return (
    <article className="surface mx-auto max-w-[900px] p-10 print:max-w-none print:border-0 print:p-0">
      <div className="no-print mb-8 flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/reports">
            <ArrowLeft /> Back to reports
          </Link>
        </Button>
        <Button variant="brand" size="sm" onClick={() => window.print()}>
          <Printer /> Print / Save as PDF
        </Button>
      </div>
      <header className="flex items-start justify-between gap-6 border-b-2 border-navy pb-5">
        <div>
          <p className="eyebrow">CareOps Insight</p>
          <h1 className="mt-1 text-2xl font-bold">{TITLES[report]}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Source: {ds.title} (Google Sheets)</p>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <p>Generated {formatDateTime(new Date().toISOString())}</p>
          <p>Data last synced {formatDateTime(lastSuccessAt)}</p>
          <p className="mt-1 font-medium text-foreground">Internal — confidential</p>
        </div>
      </header>

      {report === "executive" && (
        <>
          <div className="mt-6 grid grid-cols-3 gap-3">
            {[
              ["Total clients", ds.clients.length],
              ["Total caregivers", ds.caregivers.length],
              ["Service types", countBy(ds.clients, (c) => c.serviceType.group).length],
              ["Recorded client pay", formatMoney(cp.total, cur)],
              ["Recorded caregiver payments", formatMoney(gp.total, cur)],
              ["Records needing review", new Set(review.map((i) => i.recordKey)).size],
            ].map(([l, v]) => (
              <div key={String(l)} className="rounded-lg border border-border p-3">
                <p className="text-[0.7rem] text-muted-foreground">{l}</p>
                <p className="font-display text-xl font-bold tabular">{v}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-8">
            <Section title="Clients by service type">
              <RankedBars data={types} max={10} />
            </Section>
            <Section title="Clients by service area">
              <RankedBars data={areas} max={10} tone="teal" />
            </Section>
          </div>
          <div className="grid grid-cols-2 gap-8">
            <Section title="Service categories">
              <SimpleTable head={["Category", "Clients", "Share"]} rows={cats.map((r) => [r.label, r.count, formatPercent(r.share)])} />
            </Section>
            <Section title="Caregivers by age group">
              <SimpleTable head={["Age group", "Caregivers"]} rows={orderRows(countBy(ds.caregivers, (c) => ageGroup(c.age)), AGE_GROUP_ORDER).map((r) => [r.label, r.count])} />
            </Section>
          </div>
          <Section title="Notes">
            <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
              {ds.notes.map((n) => <li key={n}>{n}</li>)}
              <li>Payment totals are sums of recorded amounts in {cur}; they are not revenue or profit.</li>
            </ul>
          </Section>
        </>
      )}

      {report === "services" && (
        <>
          <Section title="By service type">
            <SimpleTable head={["Service type", "Client records", "Share"]} rows={types.map((r) => [r.label, r.count, formatPercent(r.share, 1)])} />
          </Section>
          <Section title="By service category">
            <SimpleTable head={["Category", "Client records", "Share"]} rows={cats.map((r) => [r.label, r.count, formatPercent(r.share, 1)])} />
          </Section>
          <Section title="By service area">
            <SimpleTable head={["Area", "Client records", "Share"]} rows={areas.map((r) => [r.label, r.count, formatPercent(r.share, 1)])} />
          </Section>
        </>
      )}

      {report === "clients" && (
        <Section title={`${ds.clients.length} client records`}>
          <SimpleTable
            head={["Client (ID)", "Category", "Area", "Service type", "Client pay", "Caregiver pay"]}
            rows={ds.clients.map((c) => [
              `${c.name.value ?? "—"} (${c.customerId ?? "—"})`,
              c.category.group ?? "—",
              c.area.group ?? "—",
              c.serviceType.group ?? "—",
              c.clientPay.amount != null ? formatMoney(c.clientPay.amount, cur) : "Not recorded",
              c.caregiverPay.amount != null ? `${formatMoney(c.caregiverPay.amount, cur)}${c.caregiverPay.shared ? ` (shared ×${c.caregiverPay.shared.rows.length})` : ""}` : "Not recorded",
            ])}
          />
        </Section>
      )}

      {report === "caregivers" && (
        <Section title={`${ds.caregivers.length} caregivers`}>
          <SimpleTable
            head={["SL · Name", "Age", "Address", "Education", "Experience", "Mobile"]}
            rows={ds.caregivers.map((c) => [
              `${c.sl ?? "—"} · ${c.name.value ?? "—"}`,
              c.age ?? "—",
              c.address.group ?? "—",
              c.education.group ?? "—",
              c.experienceYears != null ? `${c.experienceYears} yrs` : "—",
              c.mobile?.masked ?? "—",
            ])}
          />
        </Section>
      )}

      {report === "financial" && (
        <>
          <div className="mt-6 grid grid-cols-3 gap-3 text-sm">
            <div className="rounded-lg border border-border p-3"><p className="text-[0.7rem] text-muted-foreground">Recorded client pay</p><p className="font-display text-lg font-bold">{formatMoney(cp.total, cur)}</p></div>
            <div className="rounded-lg border border-border p-3"><p className="text-[0.7rem] text-muted-foreground">Recorded caregiver payments</p><p className="font-display text-lg font-bold">{formatMoney(gp.total, cur)}</p></div>
            <div className="rounded-lg border border-border p-3"><p className="text-[0.7rem] text-muted-foreground">Missing payment values</p><p className="font-display text-lg font-bold">{cp.missingCount + cp.invalidCount + gp.missingCount + gp.invalidCount}</p></div>
          </div>
          <Section title="By service type">
            <SimpleTable head={["Service type", "Records", "Client pay", "Caregiver payments"]} rows={moneyBreakdown(ds.clients, (c) => c.serviceType.group).map((r) => [r.label, r.records, formatMoney(r.clientPay, cur), formatMoney(r.caregiverPay, cur)])} />
          </Section>
          <Section title="By service area">
            <SimpleTable head={["Area", "Records", "Client pay", "Caregiver payments"]} rows={moneyBreakdown(ds.clients, (c) => c.area.group).map((r) => [r.label, r.records, formatMoney(r.clientPay, cur), formatMoney(r.caregiverPay, cur)])} />
          </Section>
          <p className="mt-6 text-xs text-muted-foreground">
            Merged caregiver payments are counted once in totals and split evenly across their rows in the breakdowns. The sheet does not state the period amounts cover; the difference between the two totals ({formatMoney(cp.total - gp.total, cur)}) is not a profit figure.
          </p>
        </>
      )}

      {report === "data-quality" && (
        <>
          <Section title="Summary">
            <SimpleTable
              head={["Issue", "Count"]}
              rows={Object.entries(
                ds.issues.reduce<Record<string, number>>((acc, i) => {
                  acc[ISSUE_LABELS[i.category]] = (acc[ISSUE_LABELS[i.category]] ?? 0) + 1;
                  return acc;
                }, {}),
              ).map(([k, v]) => [k, v])}
            />
          </Section>
          <Section title={`${ds.issues.length} issues`}>
            <SimpleTable head={["Record", "Sheet · row", "Issue", "Details"]} rows={ds.issues.map((i) => [i.recordLabel, `${i.sheet} · ${i.rowNumber}`, ISSUE_LABELS[i.category], i.message])} />
          </Section>
        </>
      )}
    </article>
  );
}
