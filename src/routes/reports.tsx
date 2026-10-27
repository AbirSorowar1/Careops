import { createFileRoute, Link } from "@tanstack/react-router";
import { Download, Printer, FileBarChart, Users, HeartHandshake, Wallet, ShieldCheck, Stethoscope, Lock } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataGate } from "@/components/dashboard/states";
import { Notice, PageHeader } from "@/components/dashboard/page";
import { useDashboard, useDataset } from "@/hooks/use-dashboard-data";
import { caregiverCsv, clientCsv, issuesCsv } from "@/lib/data/records";
import { countBy, moneyBreakdown, summariseMoney } from "@/lib/data/metrics";
import { downloadCsv, exportFilename, toCsv } from "@/lib/export";
import { formatDateTime } from "@/lib/data/format";
import type { ReportId } from "@/lib/reports";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Reports & Export — CareOps Insight" },
      { name: "description", content: "Download management reports and CSV exports from the latest synced data." },
      { property: "og:title", content: "Reports & Export — CareOps Insight" },
      { property: "og:description", content: "Download management reports and CSV exports from the latest synced data." },
    ],
  }),
  component: () => (
    <DataGate>
      <ReportsPage />
    </DataGate>
  ),
});

function ReportsPage() {
  const ds = useDataset();
  const { lastSuccessAt, settings } = useDashboard();
  const meta = (title: string) => [
    `${title} — ${ds.title}`,
    `Generated ${formatDateTime(new Date().toISOString())}; data last synced ${formatDateTime(lastSuccessAt)}`,
  ];

  const reports: Array<{ id: ReportId; title: string; description: string; icon: LucideIcon; csv: () => void; sensitive?: string }> = [
    {
      id: "executive",
      title: "Executive overview",
      description: "Headline counts, top services and areas, payment totals and data-quality summary.",
      icon: FileBarChart,
      csv: () => {
        const cp = summariseMoney(ds.clients, (c) => c.clientPay);
        const gp = summariseMoney(ds.clients, (c) => c.caregiverPay);
        downloadCsv(
          exportFilename("executive-summary"),
          toCsv(
            ["Metric", "Value"],
            [
              ["Total clients", ds.clients.length],
              ["Total caregivers", ds.caregivers.length],
              ["Complete client records", ds.clients.filter((c) => c.complete).length],
              ["Complete caregiver records", ds.caregivers.filter((c) => c.complete).length],
              ["Distinct service types", countBy(ds.clients, (c) => c.serviceType.group).length],
              ["Distinct service areas", countBy(ds.clients, (c) => c.area.group).length],
              [`Recorded client pay (${settings.currency})`, cp.total],
              [`Recorded caregiver payments (${settings.currency})`, gp.total],
              ["Records with errors or warnings", new Set(ds.issues.filter((i) => i.severity !== "info").map((i) => i.recordKey)).size],
            ],
            meta("Executive summary"),
          ),
        );
      },
      sensitive: "Includes payment totals",
    },
    {
      id: "services",
      title: "Service distribution",
      description: "Client records by service type, category and area with percentage shares.",
      icon: Stethoscope,
      csv: () => {
        const rows = [
          ...countBy(ds.clients, (c) => c.serviceType.group, { includeBlank: true }).map((r) => ["Service type", r.label, r.count, (r.share * 100).toFixed(1)]),
          ...countBy(ds.clients, (c) => c.category.group, { includeBlank: true }).map((r) => ["Service category", r.label, r.count, (r.share * 100).toFixed(1)]),
          ...countBy(ds.clients, (c) => c.area.group, { includeBlank: true }).map((r) => ["Service area", r.label, r.count, (r.share * 100).toFixed(1)]),
        ];
        downloadCsv(exportFilename("service-distribution"), toCsv(["Dimension", "Value", "Client records", "Share %"], rows, meta("Service distribution")));
      },
    },
    {
      id: "clients",
      title: "Client directory",
      description: "All client records with service details and payment amounts.",
      icon: Users,
      csv: () => downloadCsv(exportFilename("clients"), clientCsv(ds.clients, meta("Client directory"))),
      sensitive: "Contains client names and payments",
    },
    {
      id: "caregivers",
      title: "Caregiver directory",
      description: "All caregiver profiles. Mobile numbers stay masked.",
      icon: HeartHandshake,
      csv: () => downloadCsv(exportFilename("caregivers"), caregiverCsv(ds.caregivers, [...meta("Caregiver directory"), "Mobile numbers are masked."])),
      sensitive: "Contains caregiver names and addresses",
    },
    {
      id: "financial",
      title: "Financial summary",
      description: "Recorded client pay and caregiver payments by service type and area.",
      icon: Wallet,
      csv: () => {
        const rows = [
          ...moneyBreakdown(ds.clients, (c) => c.serviceType.group).map((r) => ["Service type", r.label, r.records, Math.round(r.clientPay), Math.round(r.caregiverPay)]),
          ...moneyBreakdown(ds.clients, (c) => c.area.group).map((r) => ["Service area", r.label, r.records, Math.round(r.clientPay), Math.round(r.caregiverPay)]),
        ];
        downloadCsv(
          exportFilename("financial-summary"),
          toCsv(["Dimension", "Value", "Client records", "Recorded client pay", "Recorded caregiver payments (shared split evenly)"], rows, [
            ...meta("Financial summary"),
            `Amounts in ${settings.currency}. Recorded amounts only; not a profit statement.`,
          ]),
        );
      },
      sensitive: "Contains payment data",
    },
    {
      id: "data-quality",
      title: "Data quality",
      description: "Every missing, invalid or duplicate value with its worksheet and row.",
      icon: ShieldCheck,
      csv: () => downloadCsv(exportFilename("data-quality"), issuesCsv(ds.issues, meta("Data quality report"))),
    },
  ];

  return (
    <>
      <PageHeader
        title="Reports & Export"
        description={`Every report uses the latest successful sync (${formatDateTime(lastSuccessAt)}). Use “Print / PDF” and choose “Save as PDF” in the print dialog for a PDF copy.`}
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {reports.map((r) => (
          <div key={r.id} className="surface flex flex-col p-5">
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
                <r.icon className="size-4" />
              </span>
              <div>
                <h2 className="text-[0.95rem] font-semibold">{r.title}</h2>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{r.description}</p>
              </div>
            </div>
            {r.sensitive && (
              <p className="mt-3 flex items-center gap-1.5 text-[0.7rem] text-warning-foreground">
                <Lock className="size-3" /> {r.sensitive} — share internally only
              </p>
            )}
            <div className="mt-auto flex gap-2 pt-5">
              <Button variant="brand" size="sm" asChild>
                <Link to="/print/$report" params={{ report: r.id }}>
                  <Printer /> Print / PDF
                </Link>
              </Button>
              <Button variant="subtle" size="sm" onClick={r.csv}>
                <Download /> CSV
              </Button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6 space-y-2">
        <Notice>Filtered exports are available on the Clients, Caregivers, Financial and Data Quality pages — they download exactly the rows currently shown.</Notice>
        <Notice tone="warning">
          This dashboard does not have staff sign-in yet, so anyone with its link can open these reports. Mobile numbers are always masked; add sign-in before sharing the link outside the management team.
        </Notice>
      </div>
    </>
  );
}
