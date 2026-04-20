# Apps Script — Script Properties

This doc lists the script properties the Apps Script backends read at runtime.
Setting them is **optional on day one** because every lookup has a hardcoded
fallback that matches the current behavior — but populating them lets you
rotate IDs / folders / approver lists without touching source code.

## How to set values

1. Open the Apps Script project in the GAS editor (`script.google.com`).
2. Click the gear icon on the left sidebar → **Project Settings**.
3. Scroll to **Script properties** → **Edit script properties** → **Add script
   property**.
4. Add each `key` / `value` pair from the tables below.
5. Click **Save script properties**. No redeploy needed for reads to pick up
   the new value, but trigger-level deployments may need a new version.

## Projects

### `VOUCHER_WORKFLOW_BACKEND.gs` — phieu_thu_chi

Maps to [VOUCHER_WORKFLOW_BACKEND.gs](VOUCHER_WORKFLOW_BACKEND.gs).

| Key | Type | Example / Default fallback | Used by |
| --- | --- | --- | --- |
| `MASTER_SPREADSHEET_ID` | string | `1ujmPbtEdkGLgEshfhvV8gRB6R0GLI31jsZM5rDOJS0g` | Top-level constants `TLCG_MASTER_DATA_SHEET_ID`, `USERS_SHEET_ID`, `VOUCHER_HISTORY_SHEET_ID` |
| `DRIVE_VOUCHER_FOLDER_ID` | string | `1RBBUUAQIrYTWeBONIgkMtELL0hxZhtqG` | `uploadFilesToDrive_()` parent folder |
| `IMPORT_APPROVERS` | JSON string | see example below | `IMPORT_APPROVERS` roster used by the VH_import bulk flow |

Example `IMPORT_APPROVERS` value (paste as a single JSON string, no line breaks
required but allowed inside the string):

```json
{
  "accountant": { "email": "nhanh.nguyen@tl-c.com.vn", "name": "Nhanh Nguyễn", "order": 1 },
  "legalRep":   { "email": "anh.le@mediainsider.vn",   "name": "Anh Lê",       "order": 2 },
  "treasurer":  { "email": "linh.le@tl-c.com.vn",       "name": "Linh Lê",      "order": 3 }
}
```

If `IMPORT_APPROVERS` is missing or not valid JSON, the backend falls back to
the hardcoded roster shown above.

### `PAYMENT_REQUEST_BACKEND.gs` — de_nghi_thanh_toan

Maps to [PAYMENT_REQUEST_BACKEND.gs](PAYMENT_REQUEST_BACKEND.gs).

| Key | Type | Example / Default fallback | Used by |
| --- | --- | --- | --- |
| `MASTER_SPREADSHEET_ID` | string | `1ujmPbtEdkGLgEshfhvV8gRB6R0GLI31jsZM5rDOJS0g` | Top-level constants `USERS_SHEET_ID` and `CONFIG.SPREADSHEET_ID` |

Note: this backend reads the **same** `MASTER_SPREADSHEET_ID` property as
`VOUCHER_WORKFLOW_BACKEND.gs`. If both scripts live in the same Apps Script
project, setting the property once covers both flows. If they are separate
projects, set it in each. The frontend for this flow (`de_nghi_thanh_toan.html`)
reuses the Vercel-side `DRIVE_VOUCHER_FOLDER_ID`, `GOOGLE_CLIENT_ID` and
`GOOGLE_API_KEY` via `/api/config` — no additional backend property is needed
for Drive uploads because the client performs them directly with GIS.

## Relationship to Vercel environment variables

The frontend-facing identifiers (`GOOGLE_CLIENT_ID`, `GOOGLE_API_KEY`,
`DRIVE_VOUCHER_FOLDER_ID`, `MASTER_SPREADSHEET_ID`) also live in Vercel env
vars so the browser can fetch them via `/api/config`. Keep the two sides in
sync:

- `MASTER_SPREADSHEET_ID` on Vercel == `MASTER_SPREADSHEET_ID` in GAS.
- `DRIVE_VOUCHER_FOLDER_ID` on Vercel == `DRIVE_VOUCHER_FOLDER_ID` in GAS.
- `GOOGLE_CLIENT_ID` / `GOOGLE_API_KEY` live only on Vercel (browser-only).
- `IMPORT_APPROVERS` lives only in GAS (server-only).

See [.env.example](.env.example) for the Vercel side.
