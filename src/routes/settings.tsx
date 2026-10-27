import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink, CheckCircle2, AlertTriangle, ShieldCheck, Lock, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Notice, PageHeader, Panel } from "@/components/dashboard/page";
import { RefreshButton, SyncStatus } from "@/components/dashboard/sync-status";
import { useDashboard } from "@/hooks/use-dashboard-data";
import { CURRENCY_OPTIONS, POLL_OPTIONS, updateSettings } from "@/lib/settings";
import { formatDateTime } from "@/lib/data/format";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings & Data Connection — CareOps Insight" },
      { name: "description", content: "Google Sheets connection status, worksheet mapping and sync settings." },
      { property: "og:title", content: "Settings & Data Connection — CareOps Insight" },
      { property: "og:description", content: "Google Sheets connection status, worksheet mapping and sync settings." },
    ],
  }),
  component: SettingsPage,
});

const FIELD_LABELS: Record<string, string> = {
  sl: "SL number",
  customerId: "Customer ID",
  name: "Name",
  category: "Service category",
  area: "Service area",
  serviceType: "Service type",
  clientPay: "Client pay",
  caregiverPay: "Caregiver payment",
  age: "Age",
  address: "Present address",
  education: "Education",
  experience: "Work experience",
  mobile: "Mobile (masked)",
};

function SettingsPage() {
  const { dataset, snapshot, settings, lastSuccessAt, lastErrorAt, error, syncCount } = useDashboard();
  const sheetUrl = snapshot ? `https://docs.google.com/spreadsheets/d/${snapshot.spreadsheetId}/edit` : null;

  return (
    <>
      <PageHeader title="Settings & Data Connection" description="How the dashboard reads your spreadsheet and how often it checks for changes." actions={<RefreshButton />} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Google Sheets connection">
          <dl className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">Status</dt>
              <dd><SyncStatus compact /></dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">Spreadsheet</dt>
              <dd className="text-right font-medium">{snapshot?.title ?? "—"}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">Access</dt>
              <dd className="text-right">Read-only — the dashboard never edits the sheet</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">Last successful sync</dt>
              <dd className="text-right tabular">{formatDateTime(lastSuccessAt)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">Last failed sync</dt>
              <dd className="text-right tabular">{lastErrorAt ? formatDateTime(lastErrorAt) : "None"}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground">Syncs this session</dt>
              <dd className="text-right tabular">{syncCount}</dd>
            </div>
          </dl>
          {error && (
            <div className="mt-4">
              <Notice tone="warning">{error.message}</Notice>
            </div>
          )}
          {sheetUrl && (
            <Button variant="subtle" size="sm" className="mt-5" asChild>
              <a href={sheetUrl} target="_blank" rel="noreferrer">
                Open spreadsheet <ExternalLink />
              </a>
            </Button>
          )}
        </Panel>

        <Panel title="Sync & display">
          <div className="space-y-5">
            <div className="space-y-2">
              <Label>Automatic sync</Label>
              <Select value={String(settings.pollSeconds)} onValueChange={(v) => updateSettings({ pollSeconds: Number(v) })}>
                <SelectTrigger className="bg-card"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {POLL_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Also syncs when you return to this tab. Saved on this device only.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Currency</Label>
              <Select value={settings.currency} onValueChange={(v) => updateSettings({ currency: v })}>
                <SelectTrigger className="bg-card"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                The sheet’s payment cells have no currency symbol, so the currency is set here. Default: Bangladeshi Taka.
              </p>
            </div>
            <Notice>
              <span className="inline-flex items-center gap-1 font-medium"><Radio className="size-3" /> How “live” works:</span> Google Sheets does not send instant change notifications for cell edits, so the dashboard checks the sheet on the schedule above. Added, edited, cleared and deleted rows appear on the next check — not instantly.
            </Notice>
          </div>
        </Panel>
      </div>

      <Panel className="mt-4" title="Worksheet mapping" description="Tabs and columns detected from the header row. Columns are matched by name, so moving or adding columns is safe." bodyClassName="p-0">
        {dataset ? (
          <div className="divide-y divide-border">
            {dataset.mappings.map((m) => (
              <div key={m.sheet} className="p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{m.sheet}</h3>
                  {m.role === "unknown" ? (
                    <Badge variant="muted">Not used</Badge>
                  ) : (
                    <Badge variant={m.role === "clients" ? "info" : "teal"}>{m.role === "clients" ? "Client records" : "Caregiver records"}</Badge>
                  )}
                  {m.headerRow != null && <span className="text-xs text-muted-foreground">Header on row {m.headerRow + 1} · {m.dataRows} data rows</span>}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {Object.entries(m.columns).map(([field, col]) => (
                    <span key={field} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/50 px-2 py-1 text-xs">
                      <CheckCircle2 className="size-3 text-success" />
                      <span className="text-muted-foreground">“{col.header}”</span> → <span className="font-medium">{FIELD_LABELS[field] ?? field}</span>
                    </span>
                  ))}
                  {m.unmappedHeaders.map((h) => (
                    <span key={h} className="inline-flex items-center gap-1.5 rounded-md border border-warning/30 bg-warning-soft px-2 py-1 text-xs text-warning-foreground">
                      <AlertTriangle className="size-3" /> “{h}” shown as extra detail
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="p-5 text-sm text-muted-foreground">Waiting for the first successful sync…</p>
        )}
      </Panel>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title={<><ShieldCheck className="size-4 text-success" /> Security</>}>
          <ul className="space-y-2.5 text-sm text-muted-foreground">
            <li className="flex gap-2"><Lock className="mt-0.5 size-3.5 shrink-0 text-foreground" /> The workbook is downloaded server-side; no Lovable or Google API credentials are used.</li>
            <li className="flex gap-2"><Lock className="mt-0.5 size-3.5 shrink-0 text-foreground" /> Caregiver mobile numbers are masked on the server before data is sent to the browser.</li>
            <li className="flex gap-2"><Lock className="mt-0.5 size-3.5 shrink-0 text-foreground" /> The dashboard only downloads this fixed spreadsheet and never writes to it.</li>
            <li className="flex gap-2"><AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" /> The source spreadsheet must allow link access for sync to work. Anyone with its link may be able to download all sheet data, including unmasked phone numbers; restrict sharing if that is not acceptable.</li>
            <li className="flex gap-2"><AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" /> There is no staff sign-in yet: anyone with the dashboard link can view client names and payments.</li>
          </ul>
        </Panel>
        <Panel title="Not available from this spreadsheet">
          <ul className="list-disc space-y-1.5 pl-4 text-sm text-muted-foreground">
            <li>Date filters and trends — the sheet has no date columns.</li>
            <li>Client ↔ caregiver assignments — the sheet doesn’t link them.</li>
            <li>Profit — payment periods aren’t recorded.</li>
            <li>Map pins — addresses are neighbourhood names only.</li>
          </ul>
        </Panel>
      </div>
    </>
  );
}
