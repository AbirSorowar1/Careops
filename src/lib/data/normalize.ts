// Pure helpers for cleaning values for *analysis only*. Source data is never changed.

export function collapse(value: string | null | undefined): string | null {
  if (value == null) return null;
  const v = value.replace(/\s+/g, " ").trim();
  return v === "" ? null : v;
}

/**
 * Obvious spelling variants seen in operational data. Keys are lower-case.
 * Every applied rule is listed on the Data Quality page.
 */
export const SPELLING_FIXES: Record<string, string> = {
  dimentia: "Dementia",
  dementia: "Dementia",
  dailysis: "Dialysis",
  dialysis: "Dialysis",
  dhanmandi: "Dhanmondi",
  shnatinagar: "Shantinagar",
  uttra: "Uttara",
  tejgao: "Tejgaon",
};

const SMALL_WORDS = new Set(["and", "for", "of", "in", "the", "at", "on"]);

function capitaliseWords(s: string): string {
  return s
    .split(" ")
    .map((w, i) => {
      if (!w) return w;
      if (i > 0 && SMALL_WORDS.has(w.toLowerCase())) return w.toLowerCase();
      if (/^[a-z]/.test(w)) return w.charAt(0).toUpperCase() + w.slice(1);
      return w;
    })
    .join(" ");
}

/** Normalised grouping label, e.g. "Uttara- 3 " → "Uttara-3", "Dimentia " → "Dementia". */
export function normalizeLabel(value: string | null | undefined): string | null {
  let v = collapse(value);
  if (!v) return null;
  v = v
    .replace(/\s*-\s*/g, "-")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .replace(/[,;.\s]+$/g, "")
    .trim();
  if (!v) return null;
  const fixed = SPELLING_FIXES[v.toLowerCase()];
  if (fixed) return fixed;
  // Apply fixes to individual words as well ("Dhanmandi DOHS" → "Dhanmondi DOHS").
  v = v
    .split(" ")
    .map((w) => SPELLING_FIXES[w.toLowerCase()] ?? w)
    .join(" ");
  return capitaliseWords(v);
}

/** Broader area used for geographic roll-ups: last comma part, sector number removed. */
export function areaZone(label: string | null): string | null {
  if (!label) return null;
  const parts = label.split(",").map((p) => p.trim()).filter(Boolean);
  const last = parts[parts.length - 1] ?? label;
  return last.replace(/-\d+[A-Za-z]?$/, "").trim() || null;
}

export function describeNormalization(raw: string, group: string): string {
  const collapsed = collapse(raw) ?? "";
  if (collapsed === group) return "Extra spaces removed";
  const lowerFix = SPELLING_FIXES[collapsed.toLowerCase().replace(/\s*-\s*/g, "-")];
  if (lowerFix && lowerFix === group) return "Spelling variant";
  if (collapsed.replace(/\s*-\s*/g, "-") === group) return "Spacing around “-” standardised";
  if (collapsed.toLowerCase() === group.toLowerCase()) return "Capitalisation standardised";
  return "Spelling / format standardised";
}

export type ParsedNumber =
  | { kind: "blank" }
  | { kind: "number"; value: number }
  | { kind: "invalid"; raw: string };

const BLANK_TOKENS = new Set(["", "-", "—", "n/a", "na", "null", "none"]);

/** Parses "27,000", "৳ 27,000", "Tk. 5000". Blank stays blank — never becomes 0. */
export function parseAmount(raw: string | null | undefined): ParsedNumber {
  const v = collapse(raw);
  if (v == null || BLANK_TOKENS.has(v.toLowerCase())) return { kind: "blank" };
  const cleaned = v.replace(/(৳|bdt|tk\.?|taka|\$|usd|,|\s)/gi, "");
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return { kind: "invalid", raw: v };
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return { kind: "invalid", raw: v };
  return { kind: "number", value: n };
}

export function parseInteger(raw: string | null | undefined): ParsedNumber {
  const v = collapse(raw);
  if (v == null) return { kind: "blank" };
  if (!/^\d+(\.0+)?$/.test(v)) return { kind: "invalid", raw: v };
  return { kind: "number", value: Number(v) };
}

/** "5 Years", "1 Years", "6 months", "2.5 yrs" → years. */
export function parseExperienceYears(raw: string | null | undefined): ParsedNumber {
  const v = collapse(raw);
  if (v == null) return { kind: "blank" };
  const m = v.match(/^(\d+(?:\.\d+)?)\s*(years?|yrs?|y|months?|mos?|m)?\.?$/i);
  if (!m) return { kind: "invalid", raw: v };
  const n = Number(m[1]);
  const unit = (m[2] ?? "years").toLowerCase();
  return { kind: "number", value: unit.startsWith("m") ? Math.round((n / 12) * 10) / 10 : n };
}

export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp: number[] = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0]!;
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j]!;
      dp[j] = Math.min(dp[j]! + 1, dp[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[n]!;
}
