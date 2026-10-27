import { createServerFn } from "@tanstack/react-start";
import type { SnapshotResult } from "./data/types";
import { fetchSpreadsheetSnapshot, SheetsError } from "./sheets.server";

/** Reads the live spreadsheet. Read-only; phone numbers are masked server-side. */
export const getSheetSnapshot = createServerFn({ method: "GET" }).handler(
  async (): Promise<SnapshotResult> => {
    try {
      const snapshot = await fetchSpreadsheetSnapshot();
      return { ok: true, snapshot };
    } catch (err) {
      if (err instanceof SheetsError) {
        return { ok: false, error: { message: err.message, kind: err.kind, status: err.status } };
      }
      console.error("Unexpected spreadsheet sync error", err);
      return {
        ok: false,
        error: {
          message: "Could not reach Google Sheets. Check the network connection and try again.",
          kind: "upstream",
          status: 0,
        },
      };
    }
  },
);
