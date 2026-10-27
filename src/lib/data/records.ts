import type { CaregiverRecord, ClientRecord, DataIssue } from "./types";
import { ageGroup, experienceGroup } from "./metrics";
import { toCsv } from "../export";

export interface ClientFilters {
  q?: string | undefined;
  type?: string | undefined;
  category?: string | undefined;
  area?: string | undefined;
  status?: "complete" | "incomplete" | undefined;
}

export function filterClients(list: ClientRecord[], f: ClientFilters) {
  const q = f.q?.trim().toLowerCase();
  return list.filter((c) => {
    if (q && !`${c.name.value ?? ""} ${c.customerId ?? ""}`.toLowerCase().includes(q)) return false;
    if (f.type && c.serviceType.group !== f.type) return false;
    if (f.category && c.category.group !== f.category) return false;
    if (f.area && c.area.group !== f.area) return false;
    if (f.status === "complete" && !c.complete) return false;
    if (f.status === "incomplete" && c.complete) return false;
    return true;
  });
}

export function clientCsv(rows: ClientRecord[], meta: string[]) {
  return toCsv(
    [
      "Sheet row",
      "SL No",
      "Customer ID",
      "Client name",
      "Service category",
      "Service area",
      "Service type",
      "Client pay",
      "Caregiver payment",
      "Caregiver payment shared across SL",
      "Missing fields",
    ],
    rows.map((c) => [
      c.rowNumber,
      c.sl,
      c.customerId,
      c.name.value,
      c.category.group,
      c.area.group,
      c.serviceType.group,
      c.clientPay.amount,
      c.caregiverPay.amount,
      c.caregiverPay.shared ? c.caregiverPay.shared.slNumbers.join(" ") : "",
      c.missingFields.join("; "),
    ]),
    meta,
  );
}

export interface CaregiverFilters {
  q?: string | undefined;
  age?: string | undefined;
  area?: string | undefined;
  education?: string | undefined;
  exp?: string | undefined;
}

export function filterCaregivers(list: CaregiverRecord[], f: CaregiverFilters) {
  const q = f.q?.trim().toLowerCase();
  return list.filter((c) => {
    if (q && !(c.name.value ?? "").toLowerCase().includes(q)) return false;
    if (f.age && ageGroup(c.age) !== f.age) return false;
    if (f.area && c.addressZone !== f.area) return false;
    if (f.education && c.education.group !== f.education) return false;
    if (f.exp && experienceGroup(c.experienceYears) !== f.exp) return false;
    return true;
  });
}

export function caregiverCsv(rows: CaregiverRecord[], meta: string[]) {
  return toCsv(
    ["Sheet row", "SL", "Name", "Age", "Present address", "Area", "Education", "Work experience (years)", "Mobile (masked)", "Missing / invalid"],
    rows.map((c) => [
      c.rowNumber,
      c.sl,
      c.name.value,
      c.age,
      c.address.value,
      c.addressZone,
      c.education.group,
      c.experienceYears,
      c.mobile?.masked,
      c.missingFields.join("; "),
    ]),
    meta,
  );
}

export function issuesCsv(rows: DataIssue[], meta: string[]) {
  return toCsv(
    ["Severity", "Issue", "Record type", "Record", "Worksheet", "Sheet row", "Field", "Details"],
    rows.map((i) => [i.severity, ISSUE_LABELS[i.category], i.recordType, i.recordLabel, i.sheet, i.rowNumber, i.field, i.message]),
    meta,
  );
}

export const ISSUE_LABELS: Record<DataIssue["category"], string> = {
  duplicate_id: "Duplicate ID",
  duplicate_record: "Duplicate record",
  possible_duplicate: "Possible duplicate (same name)",
  missing_id: "Missing ID",
  missing_name: "Missing name",
  missing_category: "Missing service category",
  missing_area: "Missing service area",
  missing_service_type: "Missing service type",
  missing_client_pay: "Missing client pay",
  missing_caregiver_pay: "Missing caregiver payment",
  missing_profile: "Missing caregiver profile info",
  invalid_number: "Invalid or inconsistent number",
  invalid_phone: "Invalid mobile number",
  duplicate_phone: "Duplicate mobile number",
  label_variant: "Unrecognised label variant",
};
