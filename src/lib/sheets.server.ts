// Server-only: downloads the shared Google Sheets workbook and masks phone numbers.
import * as XLSX from "xlsx";
import type { RawSheet, SheetSnapshot, MaskedCell } from "./data/types";

/** The spreadsheet that powers the dashboard. Fixed server-side on purpose. */
export const SPREADSHEET_ID = "1s0d4DbLbxXw5A65UrUKJlBcUYClGiw3rrB2vGN3Rbpw";
const EXPORT_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=xlsx`;
// Keep phone duplicate keys unpredictable without requiring a connector secret.
// Set PHONE_HASH_SECRET in deployment for stable keys across server restarts.
const PHONE_HASH_SECRET =
  process.env["PHONE_HASH_SECRET"] ??
  Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, "0")).join("");

export class SheetsError extends Error {
  constructor(
    message: string,
    public status: number,
    public kind: "auth" | "rate_limit" | "not_found" | "upstream" | "config",
  ) {
    super(message);
  }
}

// Short in-process cache so many open dashboards don't each hit Google's quota.
let cache: { at: number; snapshot: SheetSnapshot } | null = null;
const CACHE_MS = 10_000;

const PHONE_HEADER = /(mobile|phone|contact\s*no|cell)/i;

async function hmacKey(secret: string, value: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(value));
  return Array.from(new Uint8Array(sig).slice(0, 8))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function maskPhone(digits: string): string {
  if (digits.length < 6) return "•".repeat(digits.length);
  return `${digits.slice(0, 3)}${"•".repeat(Math.max(digits.length - 6, 3))}${digits.slice(-3)}`;
}

/** Bangladeshi mobile numbers are 11 digits (01XXXXXXXXX). Sheets often drops the leading 0. */
function normalisePhoneDigits(raw: string): { digits: string; droppedZero: boolean } {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("880")) digits = "0" + digits.slice(3);
  if (digits.length === 10 && digits.startsWith("1")) return { digits: "0" + digits, droppedZero: true };
  return { digits, droppedZero: false };
}

/**
 * Personal phone numbers never leave the server in full. Each phone cell is
 * replaced with a masked value plus validity flags and an opaque key used only
 * to detect duplicates.
 */
async function redactPhones(sheet: RawSheet, secret: string): Promise<RawSheet> {
  const headerRowIdx = sheet.rows.findIndex((r) => r.filter((c) => c.trim() !== "").length >= 3);
  if (headerRowIdx < 0) return sheet;
  const header = sheet.rows[headerRowIdx] ?? [];
  const phoneCols = header.map((h, i) => (PHONE_HEADER.test(h) ? i : -1)).filter((i) => i >= 0);
  if (phoneCols.length === 0) return sheet;

  const masked: MaskedCell[] = [];
  const rows = sheet.rows.map((r) => [...r]);
  for (let ri = headerRowIdx + 1; ri < rows.length; ri++) {
    for (const ci of phoneCols) {
      const row = rows[ri];
      if (!row) continue;
      const raw = (row[ci] ?? "").trim();
      if (!raw) continue;
      const { digits, droppedZero } = normalisePhoneDigits(raw);
      const valid = /^01[3-9]\d{8}$/.test(digits);
      masked.push({
        row: ri,
        col: ci,
        masked: maskPhone(digits),
        valid,
        droppedLeadingZero: droppedZero,
        dupKey: await hmacKey(secret, digits),
      });
      row[ci] = maskPhone(digits);
    }
  }
  return { ...sheet, rows, masked };
}

export async function fetchSpreadsheetSnapshot(): Promise<SheetSnapshot> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.snapshot;

  const res = await fetch(EXPORT_URL);

  if (!res.ok) {
    console.error(`Google Sheets workbook download failed [${res.status}]`);
    const kind =
      res.status === 401 || res.status === 403
        ? "auth"
        : res.status === 429
          ? "rate_limit"
          : res.status === 404
            ? "not_found"
            : "upstream";
    const message =
      kind === "auth"
        ? "Google Sheets denied access. Enable link viewing for this spreadsheet or use an authenticated connection."
        : kind === "rate_limit"
          ? "Google Sheets rate limit reached. The dashboard will retry shortly."
          : kind === "not_found"
            ? "The spreadsheet could not be found. Check the fixed spreadsheet ID and sharing settings."
            : `Google Sheets returned an error (${res.status}).`;
    throw new SheetsError(message, res.status, kind);
  }

  const workbook = XLSX.read(new Uint8Array(await res.arrayBuffer()), { type: "array" });
  const sheets: RawSheet[] = [];
  for (const [index, title] of workbook.SheetNames.entries()) {
    const worksheet = workbook.Sheets[title];
    if (!worksheet) continue;
    const values = XLSX.utils.sheet_to_json<(string | number | boolean | Date)[]>(worksheet, {
      header: 1,
      raw: false,
      defval: "",
      blankrows: true,
    });
    const rows = values.map((row) => row.map((value) => String(value ?? "")));
    const raw: RawSheet = {
      sheetId: index,
      title,
      index,
      rows,
      merges: (worksheet["!merges"] ?? []).map((merge) => ({
        startRow: merge.s.r,
        endRow: merge.e.r + 1,
        startCol: merge.s.c,
        endCol: merge.e.c + 1,
      })),
      masked: [],
    };
    sheets.push(await redactPhones(raw, PHONE_HASH_SECRET));
  }

  const snapshot: SheetSnapshot = {
    spreadsheetId: SPREADSHEET_ID,
    title: "Google Sheets",
    timeZone: null,
    fetchedAt: new Date().toISOString(),
    sheets,
  };
  cache = { at: Date.now(), snapshot };
  return snapshot;
}
