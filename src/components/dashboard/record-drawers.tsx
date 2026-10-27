import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import type { CaregiverRecord, ClientRecord, DataIssue } from "@/lib/data/types";
import { useDashboard } from "@/hooks/use-dashboard-data";
import { MoneyValue, Missing, TextValue } from "./values";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-3 border-b border-border py-2.5 text-sm last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-foreground">{children}</dd>
    </div>
  );
}

function Issues({ issues }: { issues: DataIssue[] }) {
  if (!issues.length) return <p className="text-sm text-success">No data-quality issues for this record.</p>;
  return (
    <ul className="space-y-2">
      {issues.map((i) => (
        <li key={i.id} className="flex gap-2 text-sm">
          <Badge variant={i.severity === "error" ? "danger" : i.severity === "warning" ? "warning" : "info"} className="h-fit">
            {i.severity}
          </Badge>
          <span className="text-foreground">{i.message}</span>
        </li>
      ))}
    </ul>
  );
}

export function ClientDrawer({ client, onClose }: { client: ClientRecord | null; onClose: () => void }) {
  const { dataset, settings } = useDashboard();
  const issues = client ? (dataset?.issues ?? []).filter((i) => i.recordKey === client.key) : [];
  return (
    <Sheet open={!!client} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {client && (
          <>
            <SheetHeader className="text-left">
              <p className="eyebrow">Client · {client.customerId ?? "No ID"}</p>
              <SheetTitle className="font-display text-xl">{client.name.value ?? "Unnamed client"}</SheetTitle>
              <SheetDescription>
                {client.sheet}, row {client.rowNumber}
              </SheetDescription>
            </SheetHeader>
            <div className="mt-6 space-y-6">
              <dl>
                <Row label="SL No">{client.sl ?? <Missing />}</Row>
                <Row label="Customer ID">{client.customerId ?? <Missing />}</Row>
                <Row label="Service category"><TextValue field={client.category} /></Row>
                <Row label="Service area"><TextValue field={client.area} /></Row>
                <Row label="Service type"><TextValue field={client.serviceType} /></Row>
                <Row label="Client pay"><MoneyValue field={client.clientPay} currency={settings.currency} /></Row>
                <Row label="Caregiver payment"><MoneyValue field={client.caregiverPay} currency={settings.currency} /></Row>
                {Object.entries(client.extra).map(([k, v]) => (
                  <Row key={k} label={k}>{v}</Row>
                ))}
              </dl>
              {(client.serviceType.raw !== client.serviceType.group || client.area.raw !== client.area.group) && (
                <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
                  <p className="mb-1 font-medium text-foreground">Original sheet values</p>
                  <p>Service type: “{client.serviceType.raw ?? ""}”</p>
                  <p>Service area: “{client.area.raw ?? ""}”</p>
                  <p>Category: “{client.category.raw ?? ""}”</p>
                </div>
              )}
              <div>
                <h3 className="mb-2 text-sm font-semibold">Data quality</h3>
                <Issues issues={issues} />
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

export function CaregiverDrawer({ caregiver, onClose }: { caregiver: CaregiverRecord | null; onClose: () => void }) {
  const { dataset } = useDashboard();
  const issues = caregiver ? (dataset?.issues ?? []).filter((i) => i.recordKey === caregiver.key) : [];
  return (
    <Sheet open={!!caregiver} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {caregiver && (
          <>
            <SheetHeader className="text-left">
              <p className="eyebrow">Caregiver · SL {caregiver.sl ?? "—"}</p>
              <SheetTitle className="font-display text-xl">{caregiver.name.value ?? "Unnamed caregiver"}</SheetTitle>
              <SheetDescription>
                {caregiver.sheet}, row {caregiver.rowNumber}
              </SheetDescription>
            </SheetHeader>
            <div className="mt-6 space-y-6">
              <dl>
                <Row label="Age">{caregiver.age ?? (caregiver.ageRaw ? `Invalid (“${caregiver.ageRaw}”)` : <Missing />)}</Row>
                <Row label="Present address"><TextValue field={caregiver.address} /></Row>
                <Row label="Education"><TextValue field={caregiver.education} /></Row>
                <Row label="Work experience">
                  {caregiver.experienceYears != null
                    ? `${caregiver.experienceYears} year${caregiver.experienceYears === 1 ? "" : "s"}`
                    : caregiver.experienceRaw ?? <Missing />}
                </Row>
                <Row label="Mobile">
                  {caregiver.mobile ? (
                    <span className="inline-flex items-center gap-2 font-mono text-xs">
                      {caregiver.mobile.masked}
                      <Lock className="size-3 text-muted-foreground" />
                    </span>
                  ) : (
                    <Missing />
                  )}
                </Row>
                {Object.entries(caregiver.extra).map(([k, v]) => (
                  <Row key={k} label={k}>{v}</Row>
                ))}
              </dl>
              <p className="flex gap-2 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
                <Lock className="mt-0.5 size-3 shrink-0" />
                Mobile numbers are masked before they leave the server. Full numbers stay in the Google Sheet.
              </p>
              <div>
                <h3 className="mb-2 text-sm font-semibold">Data quality</h3>
                <Issues issues={issues} />
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
