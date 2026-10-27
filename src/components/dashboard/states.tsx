import type { ReactNode } from "react";
import { AlertTriangle, Inbox, Loader2, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboard } from "@/hooks/use-dashboard-data";

export function EmptyState({ title, description, icon }: { title: string; description?: string | undefined; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      <div className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {icon ?? <Inbox className="size-5" />}
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="max-w-sm text-xs text-muted-foreground">{description}</p>}
    </div>
  );
}

export function LoadingState() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading the latest data from Google Sheets…
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </div>
  );
}

export function ConnectionErrorState() {
  const { error, refresh, isFetching } = useDashboard();
  return (
    <div className="surface mx-auto mt-10 max-w-lg p-8 text-center">
      <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-danger-soft text-danger">
        <WifiOff className="size-6" />
      </div>
      <h2 className="mt-4 text-lg font-semibold">Couldn’t load the spreadsheet</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {error?.message ?? "The dashboard could not reach Google Sheets."}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        No data is shown because nothing has been synced successfully yet.
      </p>
      <Button className="mt-6" variant="brand" onClick={() => void refresh()} disabled={isFetching}>
        {isFetching ? "Retrying…" : "Try again"}
      </Button>
    </div>
  );
}

/** Renders children only once a successful sync exists. */
export function DataGate({ children }: { children: ReactNode }) {
  const { dataset, syncState } = useDashboard();
  if (!dataset) {
    return syncState === "offline" ? <ConnectionErrorState /> : <LoadingState />;
  }
  return <>{children}</>;
}

export function MissingSheetNotice({ what }: { what: "client" | "caregiver" }) {
  return (
    <div className="surface p-6">
      <EmptyState
        icon={<AlertTriangle className="size-5" />}
        title={`No ${what} worksheet found`}
        description={`None of the spreadsheet tabs has headers that look like ${what} records. Check the column headers on the Settings page.`}
      />
    </div>
  );
}
