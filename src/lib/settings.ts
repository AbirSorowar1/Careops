import { useSyncExternalStore } from "react";

export interface DashboardSettings {
  /** Background sync interval in seconds; 0 = manual only. */
  pollSeconds: number;
  /** ISO 4217 currency code used to display payment amounts. */
  currency: string;
}

export const DEFAULT_SETTINGS: DashboardSettings = {
  pollSeconds: 60,
  currency: "BDT",
};

export const POLL_OPTIONS = [
  { value: 30, label: "Every 30 seconds" },
  { value: 60, label: "Every minute" },
  { value: 120, label: "Every 2 minutes" },
  { value: 300, label: "Every 5 minutes" },
  { value: 0, label: "Manual refresh only" },
];

export const CURRENCY_OPTIONS = [
  { value: "BDT", label: "Bangladeshi Taka (৳)" },
  { value: "USD", label: "US Dollar ($)" },
  { value: "INR", label: "Indian Rupee (₹)" },
  { value: "GBP", label: "British Pound (£)" },
  { value: "EUR", label: "Euro (€)" },
];

const KEY = "care-dashboard-settings-v1";
const listeners = new Set<() => void>();
let current: DashboardSettings = DEFAULT_SETTINGS;
let loaded = false;

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) current = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    current = DEFAULT_SETTINGS;
  }
}

export function updateSettings(patch: Partial<DashboardSettings>) {
  load();
  current = { ...current, ...patch };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* storage unavailable */
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useSettings(): DashboardSettings {
  return useSyncExternalStore(
    subscribe,
    () => {
      load();
      return current;
    },
    () => DEFAULT_SETTINGS,
  );
}
