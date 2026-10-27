import { describe, expect, it } from "vitest";
import { parseSnapshot } from "./parse";
import { summariseMoney, moneyBreakdown } from "./metrics";
import { normalizeLabel, parseAmount } from "./normalize";
import type { SheetSnapshot } from "./types";

const header = ["Sl No ", "Customer ID ", "Client Name", "Service Categories ", "Service Area ", "Service Type ", "Client Pay ", "Caregiver Payment "];

function snapshot(rows: string[][], merges: SheetSnapshot["sheets"][number]["merges"] = []): SheetSnapshot {
  return {
    spreadsheetId: "x",
    title: "Test",
    timeZone: null,
    fetchedAt: new Date(0).toISOString(),
    sheets: [
      { sheetId: 1, title: "Sheet1", index: 0, rows: [header, ...rows], merges, masked: [] },
      {
        sheetId: 2,
        title: "Sheet2",
        index: 1,
        rows: [[], ["SL", "Name", "Age", "Present Address ", "Education Qualification", "Work Experience ", "Mobile"], ["1", "Rafiqul Islam", "35", "Kuril ", "SSC", "5 Years ", "017•••••501"]],
        merges: [],
        masked: [{ row: 2, col: 6, masked: "017•••••501", valid: true, droppedLeadingZero: true, dupKey: "a" }],
      },
    ],
  };
}

describe("spreadsheet parsing", () => {
  it("finds the client and caregiver tabs from their headers", () => {
    const ds = parseSnapshot(snapshot([["1", "24001", "Anika", "12 Hours", "Mirpur", "Dimentia", "27,000", "20000"]]));
    expect(ds.mappings.find((m) => m.sheet === "Sheet1")?.role).toBe("clients");
    expect(ds.mappings.find((m) => m.sheet === "Sheet2")?.role).toBe("caregivers");
    expect(ds.clients).toHaveLength(1);
    expect(ds.caregivers).toHaveLength(1);
    expect(ds.caregivers[0]!.experienceYears).toBe(5);
  });

  it("keeps a blank payment as missing instead of turning it into 0", () => {
    const ds = parseSnapshot(snapshot([
      ["1", "24001", "A", "12 Hours", "Mirpur", "Cancer", "27,000", "20000"],
      ["2", "24002", "B", "12 Hours", "Mirpur", "Cancer", "4,000", ""],
      ["3", "24003", "C", "12 Hours", "Mirpur", "Cancer", "0", "0"],
    ]));
    const s = summariseMoney(ds.clients, (c) => c.caregiverPay);
    expect(ds.clients[1]!.caregiverPay.status).toBe("missing");
    expect(ds.clients[1]!.caregiverPay.amount).toBeNull();
    expect(ds.clients[2]!.caregiverPay.status).toBe("zero");
    expect(s.total).toBe(20000);
    expect(s.missingCount).toBe(1);
    expect(s.zeroCount).toBe(1);
  });

  it("counts a caregiver payment merged across several clients only once", () => {
    // Rows index 1..3 share one merged caregiver payment of 15,000.
    const ds = parseSnapshot(
      snapshot([
        ["29", "24029", "A", "Hospital Care", "MCWH", "Dailysis", "4,000", "15000"],
        ["30", "24030", "B", "", "", "Dailysis", "4,000", ""],
        ["31", "24031", "C", "", "", "Dailysis", "4,000", ""],
      ], [
        { startRow: 1, endRow: 4, startCol: 7, endCol: 8 },
        { startRow: 1, endRow: 4, startCol: 3, endCol: 4 },
        { startRow: 1, endRow: 4, startCol: 4, endCol: 5 },
      ]),
    );
    expect(summariseMoney(ds.clients, (c) => c.caregiverPay).total).toBe(15000);
    expect(summariseMoney(ds.clients, (c) => c.clientPay).total).toBe(12000);
    // Merged category and area apply to every row in the range.
    expect(ds.clients.every((c) => c.category.group === "Hospital Care")).toBe(true);
    expect(ds.clients.every((c) => c.area.group === "MCWH")).toBe(true);
    expect(ds.clients.every((c) => c.complete)).toBe(true);
    // Breakdowns split the shared amount evenly.
    expect(moneyBreakdown(ds.clients, (c) => c.serviceType.group)[0]!.caregiverPay).toBe(15000);
  });

  it("flags duplicate customer IDs", () => {
    const ds = parseSnapshot(snapshot([
      ["1", "24001", "A", "12 Hours", "Mirpur", "Cancer", "27,000", "20000"],
      ["2", "24001", "B", "12 Hours", "Gulshan", "Cancer", "27,000", "20000"],
    ]));
    expect(ds.issues.filter((i) => i.category === "duplicate_id")).toHaveLength(2);
  });

  it("drops a deleted row and ignores empty rows", () => {
    const ds = parseSnapshot(snapshot([
      ["1", "24001", "A", "12 Hours", "Mirpur", "Cancer", "27,000", "20000"],
      [],
      ["", "", "", "", "", "", "", ""],
    ]));
    expect(ds.clients).toHaveLength(1);
  });
});

describe("label normalisation", () => {
  it("groups obvious variants without changing the source", () => {
    expect(normalizeLabel("Dimentia ")).toBe("Dementia");
    expect(normalizeLabel("Dailysis ")).toBe("Dialysis");
    expect(normalizeLabel("Uttara- 3 ")).toBe("Uttara-3");
    expect(normalizeLabel("Uttara -4 ")).toBe("Uttara-4");
    expect(normalizeLabel("Geriatric Disease  ")).toBe("Geriatric Disease");
    expect(normalizeLabel("Dhanmandi ")).toBe("Dhanmondi");
  });

  it("parses amounts with thousands separators and rejects text", () => {
    expect(parseAmount("27,000")).toEqual({ kind: "number", value: 27000 });
    expect(parseAmount("")).toEqual({ kind: "blank" });
    expect(parseAmount("abc").kind).toBe("invalid");
  });
});
