import type { MoneyField } from "./types";

const formatters = new Map<string, Intl.NumberFormat>();

export function formatMoney(amount: number | null | undefined, currency: string): string {
  if (amount == null) return "—";
  const key = currency;
  let f = formatters.get(key);
  if (!f) {
    try {
      f = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        currencyDisplay: "narrowSymbol",
        maximumFractionDigits: 0,
      });
    } catch {
      f = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
    }
    formatters.set(key, f);
  }
  return f.format(amount);
}

export function formatCompactMoney(amount: number | null | undefined, currency: string): string {
  if (amount == null) return "—";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(amount);
  } catch {
    return formatNumber(amount);
  }
}

export function formatNumber(n: number | null | undefined, digits = 0): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(n);
}

export function formatPercent(share: number, digits = 0): string {
  return `${(share * 100).toFixed(digits)}%`;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function relativeTime(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "never";
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  return `${Math.round(h / 24)} d ago`;
}

export function moneyLabel(m: MoneyField, currency: string): string {
  if (m.status === "missing") return "Not recorded";
  if (m.status === "invalid") return `Invalid (“${m.raw?.trim()}”)`;
  return formatMoney(m.amount, currency);
}
