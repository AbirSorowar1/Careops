// ---------- Raw snapshot (server → client) ----------

export interface MergeRange {
  /** 0-based, end exclusive (same as the Sheets API). */
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
}

export interface MaskedCell {
  row: number;
  col: number;
  masked: string;
  valid: boolean;
  droppedLeadingZero: boolean;
  /** Opaque server-side key — equal keys mean equal numbers. */
  dupKey: string;
}

export interface RawSheet {
  sheetId: number;
  title: string;
  index: number;
  rows: string[][];
  merges: MergeRange[];
  masked: MaskedCell[];
}

export interface SheetSnapshot {
  spreadsheetId: string;
  title: string;
  timeZone: string | null;
  fetchedAt: string;
  sheets: RawSheet[];
}

export type SyncErrorKind = "auth" | "rate_limit" | "not_found" | "upstream" | "config";

export type SnapshotResult =
  | { ok: true; snapshot: SheetSnapshot }
  | { ok: false; error: { message: string; kind: SyncErrorKind; status: number } };

// ---------- Parsed dataset ----------

export type CellSource = "cell" | "merged" | "blank";

export interface TextField {
  /** Value exactly as it appears in the sheet (for merged cells: the merged cell's value). */
  raw: string | null;
  /** Whitespace-collapsed value, null when blank. */
  value: string | null;
  /** Normalised label used for grouping in charts and filters. */
  group: string | null;
  source: CellSource;
}

export type MoneyStatus = "recorded" | "zero" | "missing" | "invalid";

export interface MoneyField {
  raw: string | null;
  /** Parsed amount. null when missing or invalid — never silently 0. */
  amount: number | null;
  status: MoneyStatus;
  source: CellSource;
  /** Present when the amount comes from a cell merged across several records. */
  shared: null | {
    groupId: string;
    /** Sheet row numbers (1-based) covered by the merged cell. */
    rows: number[];
    slNumbers: string[];
    isAnchor: boolean;
    /** Amount divided evenly — used only for per-category breakdowns. */
    evenShare: number | null;
  };
}

export type IssueSeverity = "error" | "warning" | "info";

export type IssueCategory =
  | "duplicate_id"
  | "duplicate_record"
  | "possible_duplicate"
  | "missing_id"
  | "missing_name"
  | "missing_category"
  | "missing_area"
  | "missing_service_type"
  | "missing_client_pay"
  | "missing_caregiver_pay"
  | "missing_profile"
  | "invalid_number"
  | "invalid_phone"
  | "duplicate_phone"
  | "label_variant";

export interface DataIssue {
  id: string;
  severity: IssueSeverity;
  category: IssueCategory;
  recordType: "client" | "caregiver";
  recordKey: string;
  recordLabel: string;
  sheet: string;
  rowNumber: number;
  field: string;
  message: string;
}

export interface ClientRecord {
  key: string;
  sheet: string;
  rowNumber: number;
  sl: string | null;
  customerId: string | null;
  name: TextField;
  category: TextField;
  area: TextField;
  /** Area with sector numbers removed, e.g. "Uttara-4" → "Uttara". */
  areaZone: string | null;
  serviceType: TextField;
  clientPay: MoneyField;
  caregiverPay: MoneyField;
  extra: Record<string, string>;
  complete: boolean;
  missingFields: string[];
}

export interface PhoneInfo {
  masked: string;
  valid: boolean;
  droppedLeadingZero: boolean;
  dupKey: string;
}

export interface CaregiverRecord {
  key: string;
  sheet: string;
  rowNumber: number;
  sl: string | null;
  name: TextField;
  ageRaw: string | null;
  age: number | null;
  address: TextField;
  addressZone: string | null;
  education: TextField;
  experienceRaw: string | null;
  experienceYears: number | null;
  mobile: PhoneInfo | null;
  extra: Record<string, string>;
  complete: boolean;
  missingFields: string[];
}

export type ClientField =
  | "sl"
  | "customerId"
  | "name"
  | "category"
  | "area"
  | "serviceType"
  | "clientPay"
  | "caregiverPay";

export type CaregiverField =
  | "sl"
  | "name"
  | "age"
  | "address"
  | "education"
  | "experience"
  | "mobile";

export interface SheetMapping {
  sheet: string;
  role: "clients" | "caregivers" | "unknown";
  headerRow: number | null;
  /** field → { column index, header text } */
  columns: Record<string, { index: number; header: string }>;
  unmappedHeaders: string[];
  dataRows: number;
}

export interface LabelRule {
  field: "Service type" | "Service category" | "Service area" | "Address" | "Education";
  raw: string;
  group: string;
  count: number;
  reason: string;
}

export interface Dataset {
  title: string;
  fetchedAt: string;
  clients: ClientRecord[];
  caregivers: CaregiverRecord[];
  mappings: SheetMapping[];
  issues: DataIssue[];
  labelRules: LabelRule[];
  notes: string[];
  hasClientSheet: boolean;
  hasCaregiverSheet: boolean;
  clientColumns: Set<ClientField>;
  caregiverColumns: Set<CaregiverField>;
}
