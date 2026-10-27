import type { CaregiverRecord, ClientRecord, MoneyField } from "./types";

export interface CountRow {
  label: string;
  count: number;
  share: number;
}

export const UNSPECIFIED = "Not recorded";

export function countBy<T>(
  list: T[],
  pick: (x: T) => string | null | undefined,
  opts: { includeBlank?: boolean } = {},
): CountRow[] {
  const m = new Map<string, number>();
  let total = 0;
  for (const x of list) {
    const k = pick(x) ?? (opts.includeBlank ? UNSPECIFIED : null);
    if (k == null) continue;
    m.set(k, (m.get(k) ?? 0) + 1);
    total++;
  }
  return [...m.entries()]
    .map(([label, count]) => ({ label, count, share: total ? count / total : 0 }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export interface MoneySummary {
  /** Sum of recorded amounts (merged/shared amounts counted once). */
  total: number;
  /** Records with a usable amount (including zero). */
  recordedCount: number;
  zeroCount: number;
  missingCount: number;
  invalidCount: number;
  /** Number of distinct amounts that make up the total. */
  amountCount: number;
  average: number | null;
}

/**
 * Sums a money field without double-counting merged cells and without
 * treating blanks as zero.
 */
export function summariseMoney(list: ClientRecord[], pick: (c: ClientRecord) => MoneyField): MoneySummary {
  let total = 0;
  let recordedCount = 0;
  let zeroCount = 0;
  let missingCount = 0;
  let invalidCount = 0;
  let amountCount = 0;
  const seenGroups = new Set<string>();
  for (const c of list) {
    const m = pick(c);
    if (m.status === "missing") {
      missingCount++;
      continue;
    }
    if (m.status === "invalid") {
      invalidCount++;
      continue;
    }
    recordedCount++;
    if (m.status === "zero") zeroCount++;
    if (m.shared) {
      if (seenGroups.has(m.shared.groupId)) continue;
      seenGroups.add(m.shared.groupId);
    }
    total += m.amount ?? 0;
    amountCount++;
  }
  return {
    total,
    recordedCount,
    zeroCount,
    missingCount,
    invalidCount,
    amountCount,
    average: amountCount ? total / amountCount : null,
  };
}

/** Per-record value used in breakdowns: shared amounts are split evenly. */
export function allocatedAmount(m: MoneyField): number | null {
  if (m.amount == null) return null;
  if (m.shared) return m.shared.evenShare;
  return m.amount;
}

export interface MoneyBreakdownRow {
  label: string;
  clientPay: number;
  caregiverPay: number;
  records: number;
  clientPayMissing: number;
  caregiverPayMissing: number;
}

export function moneyBreakdown(
  list: ClientRecord[],
  pick: (c: ClientRecord) => string | null,
): MoneyBreakdownRow[] {
  const m = new Map<string, MoneyBreakdownRow>();
  for (const c of list) {
    const label = pick(c) ?? UNSPECIFIED;
    const row =
      m.get(label) ??
      { label, clientPay: 0, caregiverPay: 0, records: 0, clientPayMissing: 0, caregiverPayMissing: 0 };
    row.records++;
    const cp = allocatedAmount(c.clientPay);
    const gp = allocatedAmount(c.caregiverPay);
    if (cp == null) row.clientPayMissing++;
    else row.clientPay += cp;
    if (gp == null) row.caregiverPayMissing++;
    else row.caregiverPay += gp;
    m.set(label, row);
  }
  return [...m.values()].sort((a, b) => b.clientPay - a.clientPay);
}

export function ageGroup(age: number | null): string | null {
  if (age == null) return null;
  if (age < 20) return "Under 20";
  if (age < 25) return "20–24";
  if (age < 30) return "25–29";
  if (age < 35) return "30–34";
  if (age < 40) return "35–39";
  return "40+";
}

export const AGE_GROUP_ORDER = ["Under 20", "20–24", "25–29", "30–34", "35–39", "40+"];

export function experienceGroup(years: number | null): string | null {
  if (years == null) return null;
  if (years < 1) return "Under 1 yr";
  if (years >= 6) return "6+ yrs";
  const y = Math.floor(years);
  return `${y} yr${y === 1 ? "" : "s"}`;
}

export const EXPERIENCE_ORDER = ["Under 1 yr", "1 yr", "2 yrs", "3 yrs", "4 yrs", "5 yrs", "6+ yrs"];

export function orderRows(rows: CountRow[], order: string[]): CountRow[] {
  return order.map((label) => rows.find((r) => r.label === label) ?? { label, count: 0, share: 0 }).filter(
    (r, i, arr) => r.count > 0 || (i > 0 && i < arr.length - 1),
  );
}

export function average(nums: (number | null)[]): number | null {
  const v = nums.filter((n): n is number => n != null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

export function median(nums: (number | null)[]): number | null {
  const v = nums.filter((n): n is number => n != null).sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid]! : (v[mid - 1]! + v[mid]!) / 2;
}

export function caregiverCompleteness(list: CaregiverRecord[]) {
  return {
    complete: list.filter((c) => c.complete).length,
    incomplete: list.filter((c) => !c.complete).length,
  };
}

export function distinct<T>(list: T[], pick: (x: T) => string | null): string[] {
  return [...new Set(list.map(pick).filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b));
}
