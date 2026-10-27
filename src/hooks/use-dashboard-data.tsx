import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { getSheetSnapshot } from "@/lib/sheets.functions";
import { parseSnapshot } from "@/lib/data/parse";
import type { ClientRecord, CaregiverRecord, Dataset, SheetSnapshot, SyncErrorKind } from "@/lib/data/types";
import { useSettings, type DashboardSettings } from "@/lib/settings";

export class SyncError extends Error {
  constructor(
    message: string,
    public kind: SyncErrorKind,
    public status: number,
  ) {
    super(message);
  }
}

export interface ChangeEntry {
  id: string;
  at: string;
  kind: "added" | "removed" | "changed";
  recordType: "client" | "caregiver";
  label: string;
  detail?: string;
}

export type SyncState = "connecting" | "live" | "syncing" | "error" | "offline" | "stale";

interface DashboardContextValue {
  dataset: Dataset | null;
  snapshot: SheetSnapshot | null;
  settings: DashboardSettings;
  syncState: SyncState;
  isFetching: boolean;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  error: SyncError | null;
  refresh: () => Promise<void>;
  changes: ChangeEntry[];
  syncCount: number;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

export const SNAPSHOT_QUERY_KEY = ["sheet-snapshot"] as const;

function clientId(c: ClientRecord) {
  return c.customerId ? `id:${c.customerId}` : `row:${c.rowNumber}`;
}
function caregiverId(c: CaregiverRecord) {
  return `${c.sl ?? ""}|${(c.name.value ?? "").toLowerCase()}`;
}
function clientSig(c: ClientRecord) {
  return JSON.stringify([c.name.value, c.category.value, c.area.value, c.serviceType.value, c.clientPay.raw, c.caregiverPay.raw]);
}
function caregiverSig(c: CaregiverRecord) {
  return JSON.stringify([c.ageRaw, c.address.value, c.education.value, c.experienceRaw, c.mobile?.dupKey]);
}

function diff(prev: Dataset, next: Dataset): ChangeEntry[] {
  const at = next.fetchedAt;
  const out: ChangeEntry[] = [];
  const compare = <T,>(
    a: T[],
    b: T[],
    id: (x: T) => string,
    sig: (x: T) => string,
    label: (x: T) => string,
    recordType: "client" | "caregiver",
  ) => {
    const am = new Map(a.map((x) => [id(x), x]));
    const bm = new Map(b.map((x) => [id(x), x]));
    for (const [k, x] of bm) {
      const old = am.get(k);
      if (!old) out.push({ id: `${at}:${recordType}:add:${k}`, at, kind: "added", recordType, label: label(x) });
      else if (sig(old) !== sig(x)) out.push({ id: `${at}:${recordType}:chg:${k}`, at, kind: "changed", recordType, label: label(x) });
    }
    for (const [k, x] of am) {
      if (!bm.has(k)) out.push({ id: `${at}:${recordType}:del:${k}`, at, kind: "removed", recordType, label: label(x) });
    }
  };
  compare(prev.clients, next.clients, clientId, clientSig, (c) => `${c.name.value ?? "Unnamed"} · ${c.customerId ?? `row ${c.rowNumber}`}`, "client");
  compare(prev.caregivers, next.caregivers, caregiverId, caregiverSig, (c) => `${c.name.value ?? "Unnamed"} · SL ${c.sl ?? c.rowNumber}`, "caregiver");
  return out;
}

export function DashboardDataProvider({ children }: { children: ReactNode }) {
  const settings = useSettings();
  const fetchSnapshot = useServerFn(getSheetSnapshot);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: SNAPSHOT_QUERY_KEY,
    queryFn: async () => {
      const res = await fetchSnapshot();
      if (!res.ok) throw new SyncError(res.error.message, res.error.kind, res.error.status);
      return res.snapshot;
    },
    refetchInterval: settings.pollSeconds > 0 ? settings.pollSeconds * 1000 : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: 5_000,
    retry: (count, err) => {
      if (err instanceof SyncError && (err.kind === "auth" || err.kind === "not_found" || err.kind === "config")) return false;
      return count < 2;
    },
    retryDelay: (attempt, err) =>
      err instanceof SyncError && err.kind === "rate_limit" ? 30_000 : Math.min(2000 * 2 ** attempt, 15_000),
  });

  const snapshot = query.data ?? null;
  const dataset = useMemo(() => (snapshot ? parseSnapshot(snapshot) : null), [snapshot]);

  const prevRef = useRef<Dataset | null>(null);
  const [changes, setChanges] = useState<ChangeEntry[]>([]);
  const [syncCount, setSyncCount] = useState(0);
  useEffect(() => {
    if (!dataset) return;
    const prev = prevRef.current;
    if (prev && prev.fetchedAt !== dataset.fetchedAt) {
      const d = diff(prev, dataset);
      if (d.length) setChanges((c) => [...d, ...c].slice(0, 100));
    }
    if (!prev || prev.fetchedAt !== dataset.fetchedAt) setSyncCount((n) => n + 1);
    prevRef.current = dataset;
  }, [dataset]);

  // Tick so "stale" can be detected even when nothing else re-renders.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  const error = query.error instanceof SyncError ? query.error : query.error ? new SyncError(String(query.error.message), "upstream", 0) : null;
  const lastSuccessAt = snapshot?.fetchedAt ?? null;
  const lastErrorAt = query.errorUpdatedAt ? new Date(query.errorUpdatedAt).toISOString() : null;
  const errorIsCurrent = !!error && query.errorUpdatedAt >= query.dataUpdatedAt;

  let syncState: SyncState;
  if (!snapshot) syncState = error ? "offline" : "connecting";
  else if (errorIsCurrent) syncState = "error";
  else if (query.isFetching) syncState = "syncing";
  else if (
    settings.pollSeconds > 0 &&
    lastSuccessAt &&
    now - new Date(lastSuccessAt).getTime() > Math.max(settings.pollSeconds * 3, 180) * 1000
  )
    syncState = "stale";
  else syncState = "live";

  const refresh = useCallback(async () => {
    await queryClient.refetchQueries({ queryKey: SNAPSHOT_QUERY_KEY, exact: true });
  }, [queryClient]);

  const value: DashboardContextValue = {
    dataset,
    snapshot,
    settings,
    syncState,
    isFetching: query.isFetching,
    lastSuccessAt,
    lastErrorAt: errorIsCurrent ? lastErrorAt : null,
    error: errorIsCurrent ? error : null,
    refresh,
    changes,
    syncCount,
  };

  return <DashboardContext.Provider value={value}>{children}</DashboardContext.Provider>;
}

export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error("useDashboard must be used inside DashboardDataProvider");
  return ctx;
}

/** For pages that render only once data has loaded (inside <DataGate>). */
export function useDataset(): Dataset {
  const { dataset } = useDashboard();
  if (!dataset) throw new Error("Dataset not loaded");
  return dataset;
}
