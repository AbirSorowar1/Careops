import { useEffect, useState } from "react";
import { RefreshCw, AlertTriangle, CircleDot, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useDashboard, type SyncState } from "@/hooks/use-dashboard-data";
import { formatDateTime, relativeTime } from "@/lib/data/format";
import { cn } from "@/lib/utils";

const STATE_META: Record<SyncState, { label: string; dot: string; text: string }> = {
  connecting: { label: "Connecting", dot: "bg-muted-foreground", text: "text-muted-foreground" },
  live: { label: "Connected", dot: "bg-success", text: "text-success" },
  syncing: { label: "Syncing", dot: "bg-brand", text: "text-brand" },
  stale: { label: "Out of date", dot: "bg-warning", text: "text-warning-foreground" },
  error: { label: "Sync failed", dot: "bg-danger", text: "text-danger" },
  offline: { label: "Not connected", dot: "bg-danger", text: "text-danger" },
};

function useNow(intervalMs = 10_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function SyncStatus({ compact = false }: { compact?: boolean }) {
  const { syncState, lastSuccessAt, settings } = useDashboard();
  const now = useNow();
  const meta = STATE_META[syncState];
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs shadow-card">
          <span className="relative flex size-2">
            {(syncState === "live" || syncState === "syncing") && (
              <span className={cn("absolute inline-flex size-full animate-ping rounded-full opacity-50", meta.dot)} />
            )}
            <span className={cn("relative inline-flex size-2 rounded-full", meta.dot)} />
          </span>
          <span className={cn("font-medium", meta.text)}>{meta.label}</span>
          {!compact && (
            <span className="hidden text-muted-foreground tabular lg:inline">
              · Synced {relativeTime(lastSuccessAt, now)}
            </span>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs">
        <p>Last successful sync: {formatDateTime(lastSuccessAt)}</p>
        <p className="opacity-80">
          {settings.pollSeconds > 0
            ? `Checks Google Sheets every ${settings.pollSeconds >= 60 ? `${settings.pollSeconds / 60} min` : `${settings.pollSeconds}s`} while this tab is open.`
            : "Automatic sync is off — use Refresh."}
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

export function RefreshButton({ label = true }: { label?: boolean }) {
  const { refresh, isFetching } = useDashboard();
  return (
    <Button variant="subtle" size="sm" onClick={() => void refresh()} disabled={isFetching} aria-label="Refresh data">
      <RefreshCw className={cn(isFetching && "animate-spin")} />
      {label && <span className="hidden sm:inline">{isFetching ? "Refreshing" : "Refresh data"}</span>}
    </Button>
  );
}

export function SyncBanner() {
  const { error, lastSuccessAt, syncState, refresh } = useDashboard();
  if (syncState === "error" && error) {
    return (
      <div className="no-print flex flex-wrap items-center gap-3 border-b border-border bg-danger-soft px-4 py-2.5 text-sm text-danger md:px-8">
        <AlertTriangle className="size-4 shrink-0" />
        <span className="font-medium">{error.message}</span>
        <span className="text-foreground/70">
          Showing data from the last successful sync ({formatDateTime(lastSuccessAt)}).
        </span>
        <Button variant="link" size="sm" className="h-auto p-0 text-danger" onClick={() => void refresh()}>
          Try again
        </Button>
      </div>
    );
  }
  if (syncState === "stale") {
    return (
      <div className="no-print flex items-center gap-3 border-b border-border bg-warning-soft px-4 py-2.5 text-sm text-warning-foreground md:px-8">
        <CircleDot className="size-4 shrink-0" />
        Data has not synced since {formatDateTime(lastSuccessAt)}. Background sync pauses while the tab is hidden.
        <Button variant="link" size="sm" className="h-auto p-0 text-warning-foreground" onClick={() => void refresh()}>
          Sync now
        </Button>
      </div>
    );
  }
  return null;
}

export function OfflineIcon() {
  return <WifiOff className="size-5" />;
}
