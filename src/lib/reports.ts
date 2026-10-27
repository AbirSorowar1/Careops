export const REPORT_IDS = ["executive", "services", "clients", "caregivers", "financial", "data-quality"] as const;
export type ReportId = (typeof REPORT_IDS)[number];
