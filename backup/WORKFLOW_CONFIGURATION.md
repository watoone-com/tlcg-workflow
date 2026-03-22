# TLC Group Workflow Configuration

## Master Google Sheet

All workflows use the same master Google Sheet for data storage:

| Property | Value |
|----------|-------|
| **Spreadsheet ID** | `1ujmPbtEdkGLgEshfhvV8gRB6R0GLI31jsZM5rDOJS0g` |
| **URL** | https://docs.google.com/spreadsheets/d/1ujmPbtEdkGLgEshfhvV8gRB6R0GLI31jsZM5rDOJS0g |

### Sheets in Master Spreadsheet

| Sheet Name | Purpose |
|------------|---------|
| `Nhân viên` | Employee data and authentication |
| `Nhà cung cấp` | Supplier/Vendor list |
| `Công ty` | Company information |
| `Voucher_History` | Voucher transaction history |
| `Payment_Request_History` | Payment request records |
| `Purchase Order` | Purchase order types |

---

## Backend Scripts (Google Apps Script)

### 1. TLCGROUP_BACKEND (Intranet)

**Purpose:** Login authentication, master data operations

| Property | Value |
|----------|-------|
| **File** | `TLCG_INTRANET_BACKEND_COMPLETE.gs` |
| **Web App URL** | `https://script.google.com/macros/s/AKfycbzPRHqtSW6JSef5A4tiDJbHnIhm2jhK9c8RH6lOBFPEMLR-EjF0iVJO2ndinMZRwbJ4Xw/exec` |
| **Actions** | `login`, `getMasterData`, `sendApprovalEmail`, `approveVoucher`, `rejectVoucher` |

### 2. PHIEU_THU_CHI_BACKEND (Voucher)

**Purpose:** Voucher (Phiếu Thu/Chi) operations

| Property | Value |
|----------|-------|
| **File** | `VOUCHER_WORKFLOW_BACKEND.gs` |
| **Web App URL** | `https://script.google.com/macros/s/AKfycbwcz8QPzcb7fCeTc7f7xjBHNamLq44bh-TTTH_1MCCOOwtw2bI9U_8yACfAr6SV_V3K/exec` |
| **Actions** | `syncToSheets`, `sendApprovalEmail`, `approveVoucher`, `rejectVoucher` |

### 3. PAYMENT_REQUEST_BACKEND

**Purpose:** Payment request (Đề nghị mua hàng) operations

| Property | Value |
|----------|-------|
| **File** | `PAYMENT_REQUEST_BACKEND.gs` |
| **Web App URL** | `https://script.google.com/macros/s/AKfycbxg_DlOgCCCq4393-OKdinqYt6Onni-YlkYiO6hbq9LuFiXC5oj1AiNgJbbJHih4g/exec` |
| **Actions** | `sendPaymentRequest`, `approvePaymentRequest`, `rejectPaymentRequest`, `getSuppliers`, `getEmployees`, `getPurchaseOrderTypes` |

---

## "Nhân viên" Sheet Column Mapping

| Column | Index | Header | Description |
|--------|-------|--------|-------------|
| A | 0 | Họ và tên | Full name |
| B | 1 | Chức vụ | Position/Title |
| C | 2 | Phòng ban | Department |
| D | 3 | Công ty | Company |
| E | 4 | Email | Email address (for login) |
| F | 5 | Điện thoại | Phone number |
| G | 6 | Status | Active/Inactive |
| H | 7 | EmployeeId | Employee ID |
| I | 8 | Role | System role |
| J | 9 | isAdmin | Admin flag (TRUE/FALSE) |
| K | 10 | - | Other data |
| L | 11 | Password | SHA-256 hashed password |

---

## Password Hashing

Passwords are stored as SHA-256 hashes. To generate a hash:

```javascript
function generatePasswordHash() {
  var password = "your_password_here";
  var hash = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    password,
    Utilities.Charset.UTF_8
  );
  var hashString = hash.map(function(byte) {
    return ('0' + (byte & 0xFF).toString(16)).slice(-2);
  }).join('');
  Logger.log('Password: ' + password);
  Logger.log('Hash: ' + hashString);
}
```

---

## Vercel Proxy Configuration

The frontend uses a Vercel serverless function (`/api/voucher`) to route requests to the appropriate backend.

### Route Logic (`api/voucher.js`)

| Action | Backend |
|--------|---------|
| `login` | TLCGROUP_BACKEND |
| `getMasterData` | TLCGROUP_BACKEND |
| `sendPaymentRequest`, `approvePaymentRequest`, `rejectPaymentRequest`, `getSuppliers`, `getEmployees`, `getPurchaseOrderTypes` | PAYMENT_REQUEST_BACKEND |
| All other actions | PHIEU_THU_CHI_BACKEND |

### Environment Variables (Optional)

Set these in Vercel Dashboard → Settings → Environment Variables:

| Variable | Description |
|----------|-------------|
| `GOOGLE_APPS_SCRIPT_URL` | Override PHIEU_THU_CHI_BACKEND URL |
| `TLCGROUP_BACKEND_URL` | Override TLCGROUP_BACKEND URL |
| `PAYMENT_REQUEST_BACKEND_URL` | Override PAYMENT_REQUEST_BACKEND URL |

---

## Deployment Checklist

### Google Apps Script Deployment

1. Open script in Google Apps Script editor
2. Deploy → New deployment → Web app
3. Settings:
   - **Execute as:** Me
   - **Who has access:** Anyone
4. Click Deploy
5. Copy the Web App URL

### After Changing Spreadsheet ID

1. Update the `USERS_SHEET_ID` or `SPREADSHEET_ID` in the script
2. Run any function in the editor to trigger re-authorization
3. Accept new permissions when prompted
4. Create a **new deployment** (delete old one if needed)
5. Update the URL in `api/voucher.js` if the deployment ID changed

---

## Troubleshooting

### "Unexpected error while getting the method or property openById"

**Cause:** Script doesn't have permission to access the spreadsheet.

**Fix:**
1. Ensure spreadsheet is shared with the script owner
2. Run a test function in the editor to re-authorize
3. Delete old deployment and create new one
4. Verify "Execute as: Me" is set

### "Password mismatch"

**Cause:** Password in sheet doesn't match the hashed input.

**Fix:**
1. Verify password column is L (index 11)
2. Ensure password in sheet is SHA-256 hashed
3. Use `generatePasswordHash()` to create correct hash

### Login works for owner but not other users

**Cause:** Deployment set to "Execute as: User accessing the web app"

**Fix:**
1. Change deployment to "Execute as: Me"
2. Create new deployment version

---

## Files Reference

| File | Purpose |
|------|---------|
| `TLCG_INTRANET_BACKEND_COMPLETE.gs` | Authentication & intranet backend |
| `VOUCHER_WORKFLOW_BACKEND.gs` | Voucher workflow backend |
| `PAYMENT_REQUEST_BACKEND.gs` | Payment request backend |
| `api/voucher.js` | Vercel proxy for routing requests |
| `index.html` | Main intranet page with login |
| `phieu_thu_chi.html` | Voucher form page |
| `de_nghi_mua_hang.html` | Payment request form page |
