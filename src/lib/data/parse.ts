import type {
  CaregiverField,
  CaregiverRecord,
  CellSource,
  ClientField,
  ClientRecord,
  DataIssue,
  Dataset,
  LabelRule,
  MoneyField,
  PhoneInfo,
  RawSheet,
  SheetMapping,
  SheetSnapshot,
  TextField,
} from "./types";
import {
  areaZone,
  collapse,
  describeNormalization,
  levenshtein,
  normalizeLabel,
  parseAmount,
  parseExperienceYears,
  parseInteger,
} from "./normalize";

// ---------- Column discovery ----------

const CLIENT_PATTERNS: Record<ClientField, RegExp> = {
  sl: /^(sl|s\.?\s?l\.?|sl\.?\s?no\.?|serial(\s?no)?|s\.?\s?no\.?|#)$/,
  customerId: /^(customer|client|patient)\s?(id|code|no\.?)$|^id$/,
  name: /^(client|customer|patient)\s?name$/,
  category: /^service\s?categor(y|ies)$/,
  area: /^(service\s?area|area|location|zone)$/,
  serviceType: /^(service\s?type|condition|care\s?type)$/,
  clientPay: /^client\s?(pay|payment|fee|charge)s?$/,
  caregiverPay: /^(caregiver|carer)\s?(pay|payment|salary|fee)s?$/,
};

const CAREGIVER_PATTERNS: Record<CaregiverField, RegExp> = {
  sl: CLIENT_PATTERNS.sl,
  name: /^(name|caregiver\s?name|full\s?name)$/,
  age: /^age(\s?\(years\))?$/,
  address: /^(present\s?address|address|current\s?address|location)$/,
  education: /^(education(al)?(\s?qualification)?|qualification)$/,
  experience: /^(work\s?experience|experience|years\s?of\s?experience)$/,
  mobile: /^(mobile|mobile\s?no\.?|phone|phone\s?no\.?|contact(\s?no\.?)?|cell)$/,
};

function headerKey(h: string): string {
  return h.toLowerCase().replace(/[_:]/g, " ").replace(/\s+/g, " ").trim();
}

function findHeaderRow(rows: string[][]): number | null {
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const filled = (rows[i] ?? []).filter((c) => c.trim() !== "").length;
    if (filled >= 3) return i;
  }
  return null;
}

function mapColumns<F extends string>(header: string[], patterns: Record<F, RegExp>) {
  const columns: Record<string, { index: number; header: string }> = {};
  const used = new Set<number>();
  for (const [field, re] of Object.entries(patterns) as [F, RegExp][]) {
    const idx = header.findIndex((h, i) => !used.has(i) && re.test(headerKey(h)));
    if (idx >= 0) {
      columns[field] = { index: idx, header: (header[idx] ?? "").trim() };
      used.add(idx);
    }
  }
  const unmapped = header
    .map((h, i) => ({ h: h.trim(), i }))
    .filter(({ h, i }) => h && !used.has(i))
    .map(({ h }) => h);
  return { columns, unmapped };
}

export function classifySheet(sheet: RawSheet): SheetMapping {
  const headerRow = findHeaderRow(sheet.rows);
  if (headerRow == null) {
    return { sheet: sheet.title, role: "unknown", headerRow: null, columns: {}, unmappedHeaders: [], dataRows: 0 };
  }
  const header = sheet.rows[headerRow] ?? [];
  const c = mapColumns(header, CLIENT_PATTERNS);
  const g = mapColumns(header, CAREGIVER_PATTERNS);
  const clientScore =
    Object.keys(c.columns).length + (c.columns["customerId"] ? 2 : 0) + (c.columns["name"] ? 2 : 0);
  const caregiverScore =
    Object.keys(g.columns).length + (g.columns["age"] ? 2 : 0) + (g.columns["experience"] ? 2 : 0);
  let role: SheetMapping["role"] = "unknown";
  if (clientScore >= 4 && (c.columns["customerId"] || c.columns["name"]) && clientScore >= caregiverScore) {
    role = "clients";
  } else if (caregiverScore >= 4 && g.columns["name"]) {
    role = "caregivers";
  }
  const picked = role === "clients" ? c : role === "caregivers" ? g : { columns: {}, unmapped: header.filter(Boolean) };
  return {
    sheet: sheet.title,
    role,
    headerRow,
    columns: picked.columns,
    unmappedHeaders: picked.unmapped,
    dataRows: 0,
  };
}

// ---------- Cell access with merge awareness ----------

class Grid {
  constructor(private sheet: RawSheet) {}

  private own(r: number, c: number): string {
    return this.sheet.rows[r]?.[c] ?? "";
  }

  mergeAt(r: number, c: number) {
    return this.sheet.merges.find(
      (m) => r >= m.startRow && r < m.endRow && c >= m.startCol && c < m.endCol,
    );
  }

  /** Value of a cell; blank cells inside a merged range take the merged value. */
  get(r: number, c: number): { raw: string | null; source: CellSource } {
    const own = this.own(r, c);
    if (own.trim() !== "") {
      const m = this.mergeAt(r, c);
      const isMergedFollower = m && (m.startRow !== r || m.startCol !== c);
      return { raw: own, source: isMergedFollower ? "merged" : "cell" };
    }
    const m = this.mergeAt(r, c);
    if (m && (m.startRow !== r || m.startCol !== c)) {
      const anchor = this.own(m.startRow, m.startCol);
      if (anchor.trim() !== "") return { raw: anchor, source: "merged" };
    }
    return { raw: own === "" ? null : own, source: "blank" };
  }

  rowHasOwnContent(r: number, cols: number[]): boolean {
    return cols.some((c) => this.own(r, c).trim() !== "");
  }
}

function textField(cell: { raw: string | null; source: CellSource }, normalise = true): TextField {
  const value = collapse(cell.raw);
  return {
    raw: cell.raw,
    value,
    group: value ? (normalise ? normalizeLabel(value) : value) : null,
    source: value ? cell.source : "blank",
  };
}

// ---------- Parse ----------

function issueId(...parts: (string | number)[]) {
  return parts.join(":");
}

export function parseSnapshot(snapshot: SheetSnapshot): Dataset {
  const mappings: SheetMapping[] = [];
  const clients: ClientRecord[] = [];
  const caregivers: CaregiverRecord[] = [];
  const issues: DataIssue[] = [];
  const notes: string[] = [];
  const clientColumns = new Set<ClientField>();
  const caregiverColumns = new Set<CaregiverField>();
  let sharedPaymentGroups = 0;
  let droppedZeros = 0;

  const sorted = [...snapshot.sheets].sort((a, b) => a.index - b.index);

  for (const sheet of sorted) {
    const mapping = classifySheet(sheet);
    mappings.push(mapping);
    if (mapping.role === "unknown" || mapping.headerRow == null) continue;
    const grid = new Grid(sheet);
    const col = (f: string) => mapping.columns[f]?.index;
    const mappedCols = Object.values(mapping.columns).map((c) => c.index);
    const knownHeaders = new Set(mappedCols);
    const header = sheet.rows[mapping.headerRow] ?? [];

    for (let r = mapping.headerRow + 1; r < sheet.rows.length; r++) {
      const allCols = header.map((_, i) => i);
      if (!grid.rowHasOwnContent(r, allCols.length ? allCols : mappedCols)) continue;
      const rowNumber = r + 1;
      const get = (f: string) => {
        const i = col(f);
        return i == null ? { raw: null, source: "blank" as CellSource } : grid.get(r, i);
      };
      const extra: Record<string, string> = {};
      header.forEach((h, i) => {
        if (!knownHeaders.has(i) && h.trim()) {
          const v = collapse(grid.get(r, i).raw);
          if (v) extra[h.trim()] = v;
        }
      });

      if (mapping.role === "clients") {
        Object.keys(mapping.columns).forEach((f) => clientColumns.add(f as ClientField));
        const sl = collapse(get("sl").raw);
        const customerId = collapse(get("customerId").raw);
        const name = textField(get("name"), false);
        const key = `${sheet.title}:${rowNumber}`;
        const label = customerId ?? (name.value ? `${name.value} (row ${rowNumber})` : `Row ${rowNumber}`);

        const money = (field: "clientPay" | "caregiverPay"): MoneyField => {
          const i = col(field);
          const cell = get(field);
          const parsed = parseAmount(cell.raw);
          const base: MoneyField =
            parsed.kind === "number"
              ? { raw: cell.raw, amount: parsed.value, status: parsed.value === 0 ? "zero" : "recorded", source: cell.source, shared: null }
              : parsed.kind === "invalid"
                ? { raw: cell.raw, amount: null, status: "invalid", source: cell.source, shared: null }
                : { raw: cell.raw, amount: null, status: "missing", source: "blank", shared: null };
          if (i != null && base.amount != null) {
            const m = grid.mergeAt(r, i);
            if (m && m.endRow - m.startRow > 1) {
              const rows: number[] = [];
              const slNumbers: string[] = [];
              for (let rr = m.startRow; rr < m.endRow; rr++) {
                rows.push(rr + 1);
                const s = col("sl") != null ? collapse(sheet.rows[rr]?.[col("sl")!]) : null;
                if (s) slNumbers.push(s);
              }
              base.shared = {
                groupId: `${sheet.title}:${m.startRow}:${m.startCol}`,
                rows,
                slNumbers,
                isAnchor: m.startRow === r,
                evenShare: base.amount / rows.length,
              };
              if (m.startRow === r && field === "caregiverPay") sharedPaymentGroups++;
            }
          }
          return base;
        };

        const rec: ClientRecord = {
          key,
          sheet: sheet.title,
          rowNumber,
          sl,
          customerId,
          name,
          category: textField(get("category")),
          area: textField(get("area")),
          areaZone: null,
          serviceType: textField(get("serviceType")),
          clientPay: money("clientPay"),
          caregiverPay: money("caregiverPay"),
          extra,
          complete: true,
          missingFields: [],
        };
        rec.areaZone = areaZone(rec.area.group);

        const push = (
          category: DataIssue["category"],
          severity: DataIssue["severity"],
          field: string,
          message: string,
        ) =>
          issues.push({
            id: issueId(key, category, field),
            severity,
            category,
            recordType: "client",
            recordKey: key,
            recordLabel: label,
            sheet: sheet.title,
            rowNumber,
            field,
            message,
          });

        const req: Array<[ClientField, boolean, DataIssue["category"], string]> = [
          ["customerId", !!customerId, "missing_id", "Customer ID"],
          ["name", !!name.value, "missing_name", "Client name"],
          ["category", !!rec.category.value, "missing_category", "Service category"],
          ["area", !!rec.area.value, "missing_area", "Service area"],
          ["serviceType", !!rec.serviceType.value, "missing_service_type", "Service type"],
        ];
        for (const [f, ok, cat, labelText] of req) {
          if (col(f) == null) continue;
          if (!ok) {
            rec.missingFields.push(labelText);
            push(cat, f === "customerId" || f === "name" ? "error" : "warning", labelText, `${labelText} is blank`);
          }
        }
        for (const [f, labelText, cat] of [
          ["clientPay", "Client pay", "missing_client_pay"],
          ["caregiverPay", "Caregiver payment", "missing_caregiver_pay"],
        ] as const) {
          if (col(f) == null) continue;
          const m = rec[f];
          if (m.status === "missing") {
            rec.missingFields.push(labelText);
            push(cat, "warning", labelText, `${labelText} is blank (not treated as 0)`);
          } else if (m.status === "invalid") {
            rec.missingFields.push(labelText);
            push("invalid_number", "error", labelText, `${labelText} “${collapse(m.raw)}” is not a valid amount`);
          }
        }
        rec.complete = rec.missingFields.length === 0;
        clients.push(rec);
      } else {
        Object.keys(mapping.columns).forEach((f) => caregiverColumns.add(f as CaregiverField));
        const sl = collapse(get("sl").raw);
        const name = textField(get("name"), false);
        const key = `${sheet.title}:${rowNumber}`;
        const label = name.value ? `${name.value} (SL ${sl ?? rowNumber})` : `Row ${rowNumber}`;
        const ageRaw = collapse(get("age").raw);
        const ageP = parseInteger(ageRaw);
        const expRaw = collapse(get("experience").raw);
        const expP = parseExperienceYears(expRaw);
        const mobileCol = col("mobile");
        const masked =
          mobileCol != null ? sheet.masked.find((m) => m.row === r && m.col === mobileCol) : undefined;
        const mobile: PhoneInfo | null = masked
          ? { masked: masked.masked, valid: masked.valid, droppedLeadingZero: masked.droppedLeadingZero, dupKey: masked.dupKey }
          : null;
        if (mobile?.droppedLeadingZero) droppedZeros++;

        const rec: CaregiverRecord = {
          key,
          sheet: sheet.title,
          rowNumber,
          sl,
          name,
          ageRaw,
          age: ageP.kind === "number" ? ageP.value : null,
          address: textField(get("address")),
          addressZone: null,
          education: textField(get("education")),
          experienceRaw: expRaw,
          experienceYears: expP.kind === "number" ? expP.value : null,
          mobile,
          extra,
          complete: true,
          missingFields: [],
        };
        rec.addressZone = areaZone(rec.address.group);

        const push = (
          category: DataIssue["category"],
          severity: DataIssue["severity"],
          field: string,
          message: string,
        ) =>
          issues.push({
            id: issueId(key, category, field),
            severity,
            category,
            recordType: "caregiver",
            recordKey: key,
            recordLabel: label,
            sheet: sheet.title,
            rowNumber,
            field,
            message,
          });

        if (col("name") != null && !name.value) {
          rec.missingFields.push("Name");
          push("missing_name", "error", "Name", "Name is blank");
        }
        const profile: Array<[CaregiverField, boolean, string]> = [
          ["age", !!ageRaw, "Age"],
          ["address", !!rec.address.value, "Present address"],
          ["education", !!rec.education.value, "Education"],
          ["experience", !!expRaw, "Work experience"],
          ["mobile", !!mobile, "Mobile"],
        ];
        for (const [f, ok, labelText] of profile) {
          if (col(f) == null) continue;
          if (!ok) {
            rec.missingFields.push(labelText);
            push("missing_profile", "warning", labelText, `${labelText} is blank`);
          }
        }
        if (ageRaw && ageP.kind === "invalid") {
          rec.missingFields.push("Age");
          push("invalid_number", "error", "Age", `Age “${ageRaw}” is not a number`);
        } else if (rec.age != null && (rec.age < 16 || rec.age > 80)) {
          push("invalid_number", "warning", "Age", `Age ${rec.age} is outside the expected 16–80 range`);
        }
        if (expRaw && expP.kind === "invalid") {
          rec.missingFields.push("Work experience");
          push("invalid_number", "error", "Work experience", `Experience “${expRaw}” could not be read as years`);
        } else if (rec.age != null && rec.experienceYears != null && rec.experienceYears > rec.age - 14) {
          push("invalid_number", "warning", "Work experience", `${rec.experienceYears} years of experience looks high for age ${rec.age}`);
        }
        if (mobile && !mobile.valid) {
          rec.missingFields.push("Mobile");
          push("invalid_phone", "warning", "Mobile", "Mobile number does not look like a valid 11-digit number");
        }
        rec.complete = rec.missingFields.length === 0;
        caregivers.push(rec);
      }
    }
    mapping.dataRows =
      mapping.role === "clients"
        ? clients.filter((c) => c.sheet === sheet.title).length
        : caregivers.filter((c) => c.sheet === sheet.title).length;
  }

  // ---------- Cross-record checks ----------
  const byId = new Map<string, ClientRecord[]>();
  for (const c of clients) {
    if (!c.customerId) continue;
    const list = byId.get(c.customerId) ?? [];
    list.push(c);
    byId.set(c.customerId, list);
  }
  for (const [id, list] of byId) {
    if (list.length < 2) continue;
    for (const c of list) {
      issues.push({
        id: issueId(c.key, "duplicate_id"),
        severity: "error",
        category: "duplicate_id",
        recordType: "client",
        recordKey: c.key,
        recordLabel: id,
        sheet: c.sheet,
        rowNumber: c.rowNumber,
        field: "Customer ID",
        message: `Customer ID ${id} appears ${list.length} times (rows ${list.map((x) => x.rowNumber).join(", ")})`,
      });
    }
  }

  const sig = (c: ClientRecord) =>
    [c.name.value, c.category.group, c.area.group, c.serviceType.group, c.clientPay.amount, c.caregiverPay.amount]
      .join("|")
      .toLowerCase();
  const bySig = new Map<string, ClientRecord[]>();
  for (const c of clients) {
    const k = sig(c);
    bySig.set(k, [...(bySig.get(k) ?? []), c]);
  }
  for (const list of bySig.values()) {
    if (list.length < 2) continue;
    for (const c of list) {
      issues.push({
        id: issueId(c.key, "duplicate_record"),
        severity: "warning",
        category: "duplicate_record",
        recordType: "client",
        recordKey: c.key,
        recordLabel: c.customerId ?? c.name.value ?? `Row ${c.rowNumber}`,
        sheet: c.sheet,
        rowNumber: c.rowNumber,
        field: "Whole row",
        message: `Identical details to rows ${list.filter((x) => x !== c).map((x) => x.rowNumber).join(", ")}`,
      });
    }
  }

  const nameGroups = <T extends { name: TextField }>(list: T[]) => {
    const m = new Map<string, T[]>();
    for (const x of list) {
      const n = x.name.value?.toLowerCase();
      if (!n) continue;
      m.set(n, [...(m.get(n) ?? []), x]);
    }
    return [...m.values()].filter((l) => l.length > 1);
  };
  for (const list of nameGroups(clients)) {
    for (const c of list) {
      issues.push({
        id: issueId(c.key, "possible_duplicate"),
        severity: "info",
        category: "possible_duplicate",
        recordType: "client",
        recordKey: c.key,
        recordLabel: c.customerId ?? `Row ${c.rowNumber}`,
        sheet: c.sheet,
        rowNumber: c.rowNumber,
        field: "Client name",
        message: `Same name as ${list
          .filter((x) => x !== c)
          .map((x) => x.customerId ?? `row ${x.rowNumber}`)
          .join(", ")} — check whether this is the same person`,
      });
    }
  }
  for (const list of nameGroups(caregivers)) {
    for (const c of list) {
      issues.push({
        id: issueId(c.key, "possible_duplicate"),
        severity: "info",
        category: "possible_duplicate",
        recordType: "caregiver",
        recordKey: c.key,
        recordLabel: `${c.name.value} (SL ${c.sl ?? c.rowNumber})`,
        sheet: c.sheet,
        rowNumber: c.rowNumber,
        field: "Name",
        message: `Same name as SL ${list
          .filter((x) => x !== c)
          .map((x) => x.sl ?? x.rowNumber)
          .join(", ")} — check whether this is the same person`,
      });
    }
  }
  const byPhone = new Map<string, CaregiverRecord[]>();
  for (const c of caregivers) {
    if (!c.mobile) continue;
    byPhone.set(c.mobile.dupKey, [...(byPhone.get(c.mobile.dupKey) ?? []), c]);
  }
  for (const list of byPhone.values()) {
    if (list.length < 2) continue;
    for (const c of list) {
      issues.push({
        id: issueId(c.key, "duplicate_phone"),
        severity: "warning",
        category: "duplicate_phone",
        recordType: "caregiver",
        recordKey: c.key,
        recordLabel: `${c.name.value ?? "Unnamed"} (SL ${c.sl ?? c.rowNumber})`,
        sheet: c.sheet,
        rowNumber: c.rowNumber,
        field: "Mobile",
        message: `Same mobile number as SL ${list
          .filter((x) => x !== c)
          .map((x) => x.sl ?? x.rowNumber)
          .join(", ")}`,
      });
    }
  }

  // ---------- Label rules & variants ----------
  const labelRules: LabelRule[] = [];
  const collectRules = <T>(
    list: T[],
    pick: (x: T) => TextField,
    field: LabelRule["field"],
  ) => {
    const m = new Map<string, { group: string; count: number }>();
    for (const x of list) {
      const t = pick(x);
      if (!t.raw || !t.group) continue;
      if (t.raw === t.group) continue;
      const e = m.get(t.raw) ?? { group: t.group, count: 0 };
      e.count++;
      m.set(t.raw, e);
    }
    for (const [raw, { group, count }] of m) {
      labelRules.push({ field, raw, group, count, reason: describeNormalization(raw, group) });
    }
  };
  collectRules(clients, (c) => c.serviceType, "Service type");
  collectRules(clients, (c) => c.category, "Service category");
  collectRules(clients, (c) => c.area, "Service area");
  collectRules(caregivers, (c) => c.address, "Address");
  collectRules(caregivers, (c) => c.education, "Education");

  // Labels used only once that look like a variant of a more common label.
  const variantCheck = <T extends { key: string; sheet: string; rowNumber: number }>(
    list: T[],
    pick: (x: T) => TextField,
    fieldName: string,
    recordType: "client" | "caregiver",
    labelOf: (x: T) => string,
  ) => {
    const counts = new Map<string, number>();
    for (const x of list) {
      const g = pick(x).group;
      if (g) counts.set(g, (counts.get(g) ?? 0) + 1);
    }
    const labels = [...counts.keys()];
    for (const x of list) {
      const g = pick(x).group;
      if (!g || (counts.get(g) ?? 0) > 1) continue;
      const near = labels.find(
        (o) =>
          o !== g &&
          (counts.get(o) ?? 0) > 1 &&
          o.replace(/-\d+$/, "") !== g.replace(/-\d+$/, "") &&
          levenshtein(o.toLowerCase(), g.toLowerCase()) <= 2,
      );
      if (near) {
        issues.push({
          id: issueId(x.key, "label_variant", fieldName),
          severity: "info",
          category: "label_variant",
          recordType,
          recordKey: x.key,
          recordLabel: labelOf(x),
          sheet: x.sheet,
          rowNumber: x.rowNumber,
          field: fieldName,
          message: `“${g}” is used once and looks similar to “${near}”`,
        });
      }
    }
  };
  const clientLabel = (c: ClientRecord) => c.customerId ?? `Row ${c.rowNumber}`;
  const cgLabel = (c: CaregiverRecord) => `${c.name.value ?? "Unnamed"} (SL ${c.sl ?? c.rowNumber})`;
  variantCheck(clients, (c) => c.serviceType, "Service type", "client", clientLabel);
  variantCheck(clients, (c) => c.area, "Service area", "client", clientLabel);
  variantCheck(caregivers, (c) => c.address, "Present address", "caregiver", cgLabel);

  // ---------- Notes ----------
  const mergedFills = clients.filter(
    (c) => c.category.source === "merged" || c.area.source === "merged",
  ).length;
  if (mergedFills > 0) {
    notes.push(
      `${mergedFills} client rows take their service category or area from a merged cell that spans several rows. Those values are applied to every row in the merged range.`,
    );
  }
  if (sharedPaymentGroups > 0) {
    notes.push(
      `${sharedPaymentGroups} caregiver payments are merged across several clients. Each merged amount is counted once in totals (as the spreadsheet itself would total it). For per-service or per-area breakdowns it is split evenly across the rows it covers.`,
    );
  }
  if (droppedZeros > 0) {
    notes.push(
      `${droppedZeros} mobile numbers are stored as numbers in the sheet, so the leading 0 is missing. The dashboard reads them as 11-digit numbers starting with 0.`,
    );
  }
  notes.push(
    "The sheet has no dates or timestamps, so the dashboard cannot show trends over time or when a record was added.",
  );

  return {
    title: snapshot.title,
    fetchedAt: snapshot.fetchedAt,
    clients,
    caregivers,
    mappings,
    issues,
    labelRules,
    notes,
    hasClientSheet: mappings.some((m) => m.role === "clients"),
    hasCaregiverSheet: mappings.some((m) => m.role === "caregivers"),
    clientColumns,
    caregiverColumns,
  };
}
