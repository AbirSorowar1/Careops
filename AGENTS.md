<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules

- Spreadsheet data is downloaded read-only on the server as an XLSX export (`src/lib/sheets.server.ts`, wrapped by `getSheetSnapshot` in `src/lib/sheets.functions.ts`); the spreadsheet ID is fixed server-side so the public server function cannot be pointed at other sheets. The source sheet must allow link access; anyone with its link may be able to download unmasked source data.
- Phone-number columns are masked server-side before the snapshot leaves the server; duplicates are detected via an HMAC key (`PHONE_HASH_SECRET` can stabilize it across restarts) — never send raw phone numbers to the browser.
- All parsing, normalisation and metrics live in pure modules under `src/lib/data/` (covered by `dataset.test.ts`); pages only read the parsed `Dataset` from `useDashboard()`/`useDataset()` so every page shares one synced source of truth.
- Columns and worksheet roles are detected by header name (`classifySheet`), not position, so the sheet layout can change without code changes.
- Merged cells: text values fill every row in the merge; merged money values are counted once in totals and split evenly only in breakdowns.
- Blank or invalid numbers stay `null` with a status — never coerce to 0.
- Sync is client polling via React Query (interval from local settings) because Sheets has no push notifications for cell edits; data is fetched client-side only (no SSR loader).
- Routes under `/print/*` render without the app shell (switch in `__root.tsx`).
