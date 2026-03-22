# Phiếu Thu/Chi — Complete System Workflow

## Overview

A financial voucher (Receipt/Payment) management system for TLCGroup. Built as a single-page app (`phieu_thu_chi.html`) backed by Google Apps Script (`VOUCHER_WORKFLOW_BACKEND.gs`). Employees create vouchers through a 5-step form; vouchers then go through a sequential 3-tier approval chain via email.

---

## Architecture

```
phieu_thu_chi.html (SPA frontend)
        ↕  HTTPS POST/GET
VOUCHER_WORKFLOW_BACKEND.gs  (Google Apps Script Web App)
        ↕
Google Sheets (ID: 1ujmPbtEdkGLgEshfhvV8gRB6R0GLI31jsZM5rDOJS0g)
  ├── Voucher_History   ← all voucher records + approval history
  ├── Master Employee   ← employee directory + auth
  └── Master Company    ← company info + 3 approvers per company
        ↕
Google Drive (Folder: 1RBBUUAQIrYTWeBONIgkMtELL0hxZhtqG)
  └── Attachment uploads per voucher
        ↕
Gmail (GmailApp)
  └── Approval/notification emails
```

---

## Google Sheets Structure

### `Voucher_History` Sheet

| Col | Field | Notes |
|-----|-------|-------|
| A | VoucherNumber | Format: TL-YYYYMM-#### |
| B | VoucherType | Thu / Chi |
| C | Company | Company name |
| D | Employee | Requestor name |
| E | Amount | Total amount |
| F | Status | Pending / Approved / Rejected |
| G | Action | Submit / Approved / Rejected |
| H | By | Email of actor |
| I | Note | JSON meta: `Meta: {...}` (see Meta Structure below) |
| J | Attachments | Drive folder URL |
| K | RequestorEmail | Requestor email |
| L | ApproverEmail | Approver email |
| M | Timestamp | DD/MM/YYYY HH:MM |

Each voucher generates **multiple rows**: 1 Submit row + 1 row per approval/rejection action.

### `Master Employee` Sheet

| Col | Field |
|-----|-------|
| A | Họ và tên (Name) |
| B | Chức vụ (Position) |
| C | Phòng ban (Department) |
| D | Công ty (Company) |
| E | Email |
| F | Điện thoại (Phone) |
| G | Status (Active/Inactive) |
| H | EmployeeId |
| I | Role |
| J | isAdmin |

### `Master Company` Sheet

| Col | Field |
|-----|-------|
| A | Tên công ty viết tắt |
| B | Tên công ty (full — used for lookup) |
| C | Địa chỉ |
| D | Mã số thuế |
| E | Email Đại diện pháp luật |
| F | Tên Đại diện pháp luật |
| G | Signature URL Đại diện pháp luật |
| H | Email Kế toán trưởng |
| I | Tên Kế toán trưởng |
| J | Signature URL Kế toán trưởng |
| K | Email Thủ quỹ |
| L | Tên Thủ quỹ |
| M | Signature URL Thủ quỹ |

---

## Approval Meta JSON Structure

Stored in `Voucher_History` column I (Note), prefixed with `"Meta: "`:

```json
{
  "approvers": {
    "accountant": {
      "email": "...", "name": "...", "status": "pending|approved|rejected",
      "signature": "base64...", "approvedAt": "ISO8601", "order": 1
    },
    "legalRep": {
      "email": "...", "name": "...", "status": "pending|approved|rejected",
      "signature": "base64...", "approvedAt": "ISO8601", "order": 2
    },
    "treasurer": {
      "email": "...", "name": "...", "status": "pending|approved|rejected",
      "signature": "base64...", "approvedAt": "ISO8601", "order": 3
    }
  },
  "overallStatus": "Pending Approval | Partially Approved | Approved | Rejected",
  "approvalProgress": "0/3 | 1/3 | 2/3 | 3/3",
  "currentApprover": "accountant | legalRep | treasurer | null",
  "approvalSequence": ["accountant", "legalRep", "treasurer"],
  "displayStatus": "Chờ duyệt | Đang duyệt (X/3) | Đã duyệt | Đã từ chối",
  "fullyApprovedAt": null,
  "rejectedAt": null,
  "rejectedBy": null
}
```

---

## Frontend Init Sequence (DOMContentLoaded)

```
1. Check auth (localStorage.tlc_current_user → email + name required)
   └── If missing/invalid → redirect to index.html
2. initDriveAPI()              ← Initialize Google Drive OAuth
3. loadEmployeesFromBackend()  ← GET ?action=getEmployees → populate employee dropdown
4. initializeForm()            ← Populate company/type/currency dropdowns from embedded base64 data
5. generateVoucherNumber()     ← Create initial TL-YYYYMM-#### number
6. renderExpenseTable()        ← Render empty expense table (1 blank row)
7. loadFromLocalStorage()      ← If draft exists → prompt user to restore
8. loadSavedSignature()        ← Load signature from localStorage if previously saved
9. loadRecentVouchers()        ← POST action=getVoucherSummary → populate recent panel
10. setInterval(loadRecentVouchers, 60000)  ← Auto-refresh every 60s
11. Check URL ?viewStatus=voucherNumber → open status modal if present
```

---

## 5-Step Form Workflow

### Step 1 — Thông tin chung (General Info)

**Fields:**

| ID | Type | Required | Notes |
|----|------|----------|-------|
| `company` | SELECT | Yes | On change → `updateCompanyDetails()` → fetch approvers |
| `voucher-type` | SELECT | Yes | Thu / Chi — on change → `updateVoucherTitle()` |
| `voucher-number` | TEXT readonly | Auto | Format: TL-YYYYMM-#### |
| `voucher-date` | DATE | Yes | Always today (system date) |
| `employee` | SELECT | Yes | On change → `updateEmployeeDepartment()` |
| `department` | TEXT readonly | Auto | Auto-filled from employee selection |

**On company change:**
1. Show company address from embedded `data.companies_data`
2. POST `action=getCompanyApprovers` with `companyName`
3. Backend reads `Master Company` sheet → returns 3 approvers
4. `updateApproversDisplay(approvers)` → updates Step 4 display

**Validation to advance to Step 2:** company, voucher-type, employee all selected.

---

### Step 2 — Thông tin đối tượng (Payee Info)

**Fields:**

| ID | Type | Required | Notes |
|----|------|----------|-------|
| `payee-dropdown` | SELECT | No | Pre-fills payee-name |
| `payee-name` | TEXT | Yes | Min 2 chars |
| `reason` | TEXTAREA | Yes | Min 10 chars |
| `amount` | TEXT readonly | Auto | Calculated from expense table |
| `signature-upload` | FILE (image/*) | Yes | Compressed → base64 → localStorage |

**Signature handling:**
1. User uploads image file
2. `handleSignatureUpload()` → `compressImageSignature()` (max 800×400px, quality 0.7)
3. Stored as base64 in `signatureData` variable + `localStorage[SIGNATURE_STORAGE_KEY]`
4. Preview shown in page

**Validation to advance to Step 3:** payee-name ≥2 chars, reason ≥10 chars, signature uploaded.

---

### Step 3 — Chi tiết (Expense Items)

**Fields:**

| ID | Type | Required | Notes |
|----|------|----------|-------|
| `currency` | SELECT | Yes | VNĐ / USD / EUR |
| Expense rows | Dynamic table | Min 1 row | content (text, required) + amount (number, >0) + attachments |
| `grand-total` | display | Auto | Sum of all row amounts |
| `amount-in-words-display` | display | Auto | Vietnamese text |

**Expense table operations:**
- `addExpenseRow()` — appends blank row to `expenseItems[]` array
- `removeExpenseRow(index)` — deletes row, recalculates total
- `updateExpenseItem(index, field, value)` — updates cell, recalculates
- `updateGrandTotal()` — sums amounts, converts to Vietnamese words, updates `#amount` hidden field

**Attachment per row:**
- Each row has a file picker
- If Drive configured (`isDriveConfigured()`) → `uploadToDrive(file, voucherNumber)`:
  1. `ensureDriveToken()` → OAuth2 via Google Identity Services
  2. `getOrCreateDriveFolder()` → creates `DRIVE_FOLDER_ID/{voucherNumber}/`
  3. Upload file → `setDriveFilePublic()` → returns shareable URL
- If Drive not configured → stores file as base64 for backend upload

**Validation to advance to Step 4:** currency selected, at least 1 expense row with content + amount > 0.

---

### Step 4 — Phê duyệt (Approvers Display)

Read-only display of 3 approvers loaded in Step 1:

| Approver | Role | Order |
|----------|------|-------|
| `approver-accountant-name` | Kế toán trưởng | 1st |
| `approver-legalrep-name` | Đại diện pháp luật | 2nd |
| `approver-treasurer-name` | Thủ quỹ | 3rd |

Also shows current approval status and history (from `approvalHistory[]` array).

No validation required — always passable.

---

### Step 5 — Xem lại & Gửi (Review & Submit)

Shows read-only summary of all data. Edit buttons call `editStepFromReview(n)` to jump back.

**Buttons:**
- **Lưu bản nháp** → `saveToLocalStorage()` (key: `voucher_draft`)
- **Gửi phê duyệt** → `sendForApproval()`
- **Xuất PDF** → `exportToPDF()` (html2pdf.js, A4)
- **Xuất Excel** → `exportToExcel()` (XLSX library, 3 sheets)

---

## Submission Flow (`sendForApproval`)

```
User clicks "Gửi phê duyệt"
│
├─ Set isSubmitting = true (prevent duplicate clicks)
├─ validateAllFields() — all required fields
├─ validateSignature() — signature present
├─ generateVoucherNumber() — ensure TL-YYYYMM-#### valid
├─ ensureSignatureCompressed() — compress if >300KB
│
├─ [If Drive configured]
│   └─ Upload attachments to Drive → get folder URL
│
├─ Build submission payload:
│   {
│     action: 'sendApprovalEmail',
│     email: { to, cc, subject, body },
│     voucher: {
│       voucherNumber, voucherType, company, employee, department,
│       payeeName, reason, currency, amount, amountInWords,
│       expenseItems[], approvers[], requesterSignature (base64),
│       attachmentsUrl, requestorEmail
│     },
│     companyApprovers: { accountant, legalRep, treasurer }
│   }
│
├─ POST to API_URL (FormData with data=JSON)
│
├─ Backend (handleSendEmail):
│   ├─ Check duplicate (scan Voucher_History for existing Submit)
│   ├─ Handle file uploads (legacy base64 → Drive if needed)
│   ├─ initializeApproversMeta() → build meta JSON with 3 approvers
│   ├─ appendHistory_() → write row to Voucher_History (action: 'Submit')
│   └─ GmailApp.sendEmail() → email to accountant (Kế toán trưởng)
│
├─ Show success toast with "Xem trạng thái" link
├─ loadRecentVouchers() — refresh panel
├─ Clear draft from localStorage
└─ Set isSubmitting = false
```

---

## Sequential Approval Workflow

### Approval Chain

```
[Submitted] → Accountant (Kế toán trưởng) → Legal Rep (Đại diện pháp luật) → Treasurer (Thủ quỹ) → [Done]
   0/3                    1/3                          2/3                         3/3
```

### Approve Path (`handleApproveVoucher`)

```
Approver clicks Approve link (email) or approves in modal
│
├─ Validate: approverEmail matches currentApprover's email
├─ Validate: requestorEmail ≠ approverEmail (no self-approval)
├─ Validate: not already approved / voucher not rejected
├─ [If signatureVerification provided] → check verified === true
│
├─ Update meta: approvers[role].status = 'approved', approvedAt = now
├─ Increment approvalProgress (0/3 → 1/3 → 2/3 → 3/3)
├─ appendHistory_() → new row (action: 'Approved')
│
├─ [If approvalProgress < 3/3]
│   ├─ Set currentApprover = next in sequence
│   ├─ sendApprovalEmailToNextApprover() → email next approver
│   └─ sendProgressEmail() → email requester (X/3 progress)
│
└─ [If approvalProgress = 3/3]
    ├─ meta.overallStatus = 'Approved', fullyApprovedAt = now
    └─ sendFinalApprovalEmail() → email requester (fully approved)
```

### Reject Path (`handleRejectVoucher`)

```
Approver clicks Reject
│
├─ Require rejection reason (non-empty)
├─ Update meta: overallStatus = 'Rejected', currentApprover = null
├─ appendHistory_() → new row (action: 'Rejected')
└─ GmailApp.sendEmail() → rejection email to requester
```

### Email Triggers

| Event | To | Subject |
|-------|----|---------|
| Voucher submitted | Accountant | From `email.subject` parameter |
| Accountant approves | Legal Rep | `[PHÊ DUYỆT] Phiếu {n} - Đại diện pháp luật` |
| Legal Rep approves | Treasurer | `[PHÊ DUYỆT] Phiếu {n} - Thủ quỹ` |
| Each approval | Requester | `[ĐANG DUYỆT (X/3)] Phiếu {n}` |
| All 3 approved | Requester | `[ĐÃ DUYỆT HOÀN TOÀN] Phiếu {n}` |
| Any rejection | Requester | `[TỪ CHỐI] Phiếu {n}` |

### Approval Action Links (in emails)

- Approve: `https://workflow.egg-ventures.com/approve_voucher.html?voucherNumber=...&approverEmail=...&approverRole=...`
- Reject: `https://workflow.egg-ventures.com/reject_voucher.html?voucherNumber=...`
- View status: `https://workflow.egg-ventures.com/phieu_thu_chi.html?viewStatus={voucherNumber}`

---

## Frontend Approval Modal

```
Click voucher card in recent panel
│
├─ openVoucherDetail(voucherNumber)
│   ├─ POST action=getVoucherHistory → full voucher + all history rows
│   ├─ Determine currentApproverRole from approvalProgress:
│   │   0/3 → accountant | 1/3 → legalRep | 2/3 → treasurer | 3/3 → none
│   └─ renderVoucherDetails() → modal HTML:
│       ├─ Approval progress bar (X/3)
│       ├─ Expense items table
│       ├─ Approval history timeline
│       └─ Buttons (based on user role + status):
│           ├─ [Approve] → approveFromModal()
│           ├─ [Reject]  → rejectFromModal()
│           ├─ [Edit]    → editVoucherFromModal() (requester + pending only)
│           └─ [Print]   → exportToPDF()
│
├─ approveFromModal()
│   ├─ Upload approver signature (required)
│   ├─ compareSignatures() → perceptual hash vs sample from Drive
│   ├─ showConfirmation() → user confirms
│   └─ POST action=approveVoucher
│
└─ rejectFromModal()
    ├─ Prompt for rejection reason
    ├─ Upload approver signature
    └─ POST action=rejectVoucher
```

---

## Recent Vouchers Panel

- **Load**: `loadRecentVouchers()` → POST `action=getVoucherSummary`
  - Returns: `{ pending, approved, rejected, total, recent: [...] }`
  - Deduplicates by `voucherNumber` keeping latest row; sorted by timestamp desc
- **Auto-refresh**: every 60 seconds (pauses when tab hidden, resumes on focus)
- **Status async update**: `loadVoucherApprovalStatus()` refreshes each card badge after load
- **Click card**: `openVoucherDetail(voucherNumber)` → opens detail modal

---

## Local Storage Keys

| Key | Contents | When Saved | When Loaded |
|-----|----------|-----------|------------|
| `voucher_draft` | Full form state (all steps + expenseItems) | Every 3s (debounced) | On page load (with prompt) |
| `SIGNATURE_STORAGE_KEY` | Requester signature base64 | On signature upload | On page load |
| `tlc_current_user` | `{name, email, ...}` | On login | On every page load (auth check) |
| `voucher_template` | Template form state | On "Save Template" | On "Load Template" |

---

## Backend API Reference

**Base URL**: `API_URL` (configured in HTML)

| Action | Method | Handler | Key Input | Key Output |
|--------|--------|---------|-----------|-----------|
| `getEmployees` | GET/POST | `handleGetEmployees` | — | `{ employees: [{name, department, email}] }` |
| `getCompanyApprovers` | GET/POST | `handleGetCompanyApprovers` | `companyName` | `{ data: { approvers: {accountant, legalRep, treasurer} } }` |
| `getVoucherSummary` | GET/POST | `handleGetVoucherSummary` | — | `{ data: { pending, approved, rejected, recent[] } }` |
| `getVoucherHistory` | GET/POST | `handleGetVoucherHistory` | `voucherNumber` | `{ voucher, history[] }` |
| `getApprovalStatus` | GET/POST | `handleGetApprovalStatus` | `voucherNumber` | `{ data: { approvers, approvalProgress, currentApprover } }` |
| `sendApprovalEmail` | POST | `handleSendEmail` | Full voucher + email + companyApprovers | `{ success, voucherNumber, viewStatusUrl }` |
| `approveVoucher` | GET/POST | `handleApproveVoucher` | `{voucherNumber, approverEmail, approverSignature, approverRole}` | `{ success, approvalProgress }` |
| `rejectVoucher` | GET/POST | `handleRejectVoucher` | `{voucherNumber, approverEmail, rejectReason}` | `{ success }` |
| `refreshApproverEmails` | POST | `handleRefreshApproverEmails` | — | Updates all pending vouchers' meta |
| `fetchSignatureImage` | POST | `handleFetchSignatureImage` | `imageUrl` | Base64 image data URL |
| `login` | POST | `handleLogin_` | `email` | `{ name, email, role }` |

All responses: `{ "success": true|false, "message": "...", "data": {...} }`

---

## Backend Function Reference

| Function | Line | Purpose |
|----------|------|---------|
| `doGet(e)` | 69 | GET dispatcher |
| `doPost(e)` | 149 | POST dispatcher + JSON parsing (3 formats) |
| `safeOpenSpreadsheet(id, ctx)` | 20 | Safe spreadsheet open with actionable errors |
| `safeGetSheet(ss, name, ctx)` | 57 | Safe sheet get, lists available sheets if missing |
| `initializeApproversMeta(approvers)` | 392 | Build 3-person sequential meta structure |
| `getVoucherFromHistory(voucherNumber)` | 445 | Fetch voucher + parse meta from Note column |
| `countApprovals(approvers)` | 589 | Count approved approvers (0–3) |
| `getApproverRoleName(role)` | 601 | role key → Vietnamese display name |
| `handleSendEmail(body)` | 611 | Submit voucher; duplicate check; write history; email accountant |
| `handleApproveVoucher(body)` | 929 | Sequential approval; self-approval check; email next/final |
| `handleApproveVoucherLegacy(body, voucher)` | 1205 | Fallback: single-approver workflow |
| `sendApprovalEmailToNextApprover(...)` | 1285 | Email next approver with approve/reject links |
| `sendProgressEmail(...)` | 1404 | Email requester X/3 progress update |
| `sendFinalApprovalEmail(...)` | 1517 | Email requester on full approval |
| `handleRejectVoucher(body)` | 1558 | Reject; stop workflow; email requester |
| `handleGetApprovalStatus(body)` | 1732 | Return current approval state |
| `handleLogin_(body)` | 1970 | Authenticate by email against Master Employee |
| `handleGetEmployees(body)` | 2042 | Return all active employees |
| `handleGetCompanyApprovers(body, name)` | 2101 | Return company's 3 approvers from Master Company |
| `handleGetVoucherSummary(body)` | 2286 | Return dashboard summary (deduplicated) |
| `handleGetVoucherHistory(body)` | 2428 | Return single voucher + all history rows |
| `uploadFilesToDrive_(files, folder)` | 2501 | Decode base64 files → upload to Drive |
| `appendHistory_(entry)` | 2527 | Append row to Voucher_History (columns A–M) |
| `formatTimestamp(date)` | 2608 | Date → `DD/MM/YYYY HH:MM` |
| `createResponse(ok, msg, data)` | 2619 | Standardized `{success, message, data}` |
| `handleRefreshApproverEmails(body)` | 2735 | Refresh approver emails in all pending meta |
| `handleFetchSignatureImage(body)` | 2918 | Fetch external image → base64 data URL |

---

## Frontend Function Reference

| Function | Line | Purpose |
|----------|------|---------|
| `fetchWithRetry(url, opts, retries, delay)` | 2847 | Fetch with exponential backoff (3 retries) |
| `loadEmployeesFromBackend()` | 2979 | Fetch employees; populate dropdown |
| `showToast(msg, type, title)` | 3103 | Toast notification (info/success/warning/error) |
| `showConfirmation(msg, title)` | 3134 | Confirmation dialog → Promise |
| `validateField(id, value, name)` | 3166 | Validate single field, show inline error |
| `validateAllFields()` | 3217 | Validate all required fields |
| `saveToLocalStorage()` | 3251 | Save full draft to localStorage |
| `loadFromLocalStorage()` | 3279 | Restore draft from localStorage |
| `debounceAutoSave()` | 3371 | Auto-save with 3s debounce |
| `validateStep(step)` | 3406 | Validate fields needed for step |
| `goToStep(step)` | 3431 | Navigate to form step |
| `editStepFromReview(n)` | 3467 | Jump to step from Step 5 review |
| `updateStepperProgress()` | 3507 | Update visual stepper bar |
| `updateReviewSection()` | 3530 | Populate Step 5 review data |
| `initializeForm()` | 3888 | Populate dropdowns from embedded data blob |
| `loadCompanyApprovers(name)` | 3931 | POST getCompanyApprovers → update Step 4 |
| `updateApproversDisplay(approvers)` | 3985 | Render 3 approvers in Step 4 |
| `updateCompanyDetails()` | 4015 | Show address; call loadCompanyApprovers |
| `updateEmployeeDepartment()` | 4037 | Auto-fill department from employee |
| `compressImageSignature(file,...)` | 4338 | Compress via canvas (800×400, 70% quality) |
| `compareSignatures(uploaded, sampleUrl)` | 4467 | Perceptual hash signature verification |
| `handleSignatureUpload(event)` | 4527 | Process signature upload + compress + store |
| `loadSavedSignature()` | 4517 | Load signature from localStorage |
| `validateSignature()` | 4595 | Check signature present |
| `loadRecentVouchers()` | 4668 | POST getVoucherSummary → render panel |
| `openVoucherDetail(voucherNumber)` | 4901 | Open detail modal |
| `renderVoucherDetails(voucher, history, ...)` | 5137 | Build modal HTML |
| `ensureSignatureCompressed(data, maxKB)` | 5501 | Compress signature if >300KB |
| `approveFromModal()` | 5591 | Approver approves via modal |
| `rejectFromModal()` | 5783 | Approver rejects via modal |
| `closeVoucherModal(event)` | 5892 | Close detail modal |
| `editVoucherFromModal()` | 6367 | Load voucher back into form for editing |
| `generateVoucherNumber()` | 6540 | Generate TL-YYYYMM-#### |
| `exportToPDF()` | 6610 | Export to PDF (html2pdf.js, A4 portrait) |
| `exportToExcel()` | 6624 | Export to Excel (XLSX, 3 sheets) |
| `sendForApproval()` | 7239 | Main submission: validate → upload → POST |
| `addExpenseRow()` | 8409 | Add blank row to expense table |
| `removeExpenseRow(index)` | 8415 | Remove row; recalculate total |
| `updateExpenseItem(i, field, val)` | 8429 | Update cell value; recalculate |
| `updateGrandTotal()` | 8499 | Sum amounts; convert to words |
| `uploadToDrive(file, voucherNumber)` | 4276 | Upload file to Drive; return URL |
| `isDriveConfigured()` | 4332 | Check Drive API credentials present |
| `ensureDriveToken(promptConsent)` | 4123 | Get OAuth2 token via Google Identity Services |
| `getOrCreateDriveFolder(token, num, ...)` | 4205 | Create Drive folder `parent/{voucherNumber}/` |

---

## Key Business Rules

1. **Sequential approval only** — cannot skip order: accountant → legalRep → treasurer
2. **No self-approval** — requestor email cannot match any approver email
3. **No double approval** — once approved, status is locked; rejected voucher cannot be approved
4. **Signature required** — requestor on submit; each approver on approve action
5. **Signature verification** — optional perceptual hash comparison vs stored sample
6. **Duplicate prevention** — backend scans `Voucher_History` before accepting new Submit
7. **Graceful retry** — frontend retries failed API calls up to 3× with exponential backoff
8. **Auto-save** — form saves to localStorage every 3s; restored on page reload with prompt
9. **Fallback data** — if backend unreachable, embedded base64 company/employee data is used
