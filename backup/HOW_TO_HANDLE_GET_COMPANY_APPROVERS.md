# 📖 How to Handle `getCompanyApprovers` - Complete Guide

## Overview

The `getCompanyApprovers` action fetches company-specific approver information (Legal Representative, Chief Accountant, Treasurer) from the "Công ty" Google Sheet when a user selects a company in the Phiếu Thu/Chi form.

---

## 🔄 Complete Data Flow

### 1. Frontend Trigger (`phieu_thu_chi.html`)

**Location:** Lines 3288-3321

**When it's called:**
- User selects a company from the dropdown
- `updateCompanyDetails()` function is triggered (line 3323)
- `loadCompanyApprovers(companyName)` is called

**Code:**
```javascript
async function loadCompanyApprovers(companyName) {
    try {
        console.log('📧 Loading approvers for company:', companyName);
        
        const response = await fetch('/api/voucher', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                action: 'getCompanyApprovers',
                companyName: companyName
            })
        });
        
        const result = await response.json();
        
        if (result.success && result.data && result.data.approvers) {
            data.selectedCompanyApprovers = result.data.approvers;
            console.log('✅ Company approvers loaded:', data.selectedCompanyApprovers);
            showToast(`Đã tải thông tin người phê duyệt cho công ty "${companyName}"`, 'success', 'Thành công');
        } else {
            console.error('❌ Failed to load company approvers:', result.message);
            data.selectedCompanyApprovers = null;
            showToast('Không thể tải thông tin người phê duyệt. ' + (result.message || ''), 'warning', 'Cảnh báo');
        }
    } catch (error) {
        console.error('❌ Error loading company approvers:', error);
        data.selectedCompanyApprovers = null;
        showToast('Lỗi khi tải thông tin người phê duyệt: ' + error.message, 'error', 'Lỗi');
    }
}
```

**Request Format:**
- Method: `POST`
- URL: `/api/voucher`
- Content-Type: `application/x-www-form-urlencoded`
- Body:
  ```
  action=getCompanyApprovers&companyName=CÔNG TY TNHH TƯ VẤN TLC
  ```

---

### 2. Vercel Proxy (`api/voucher.js`)

**Location:** Lines 55-109

**What it does:**
- Receives the request from frontend
- Routes to the appropriate Google Apps Script backend
- By default, routes to `PHIEU_THU_CHI_BACKEND` (which handles voucher operations)
- Since `getCompanyApprovers` is not in `paymentRequestActions`, it goes to voucher backend ✅

**Code:**
```javascript
// Default routing - getCompanyApprovers goes to PHIEU_THU_CHI_BACKEND
let GAS_URL = PHIEU_THU_CHI_BACKEND;

// getCompanyApprovers is NOT in paymentRequestActions, so it uses default ✅
const paymentRequestActions = [
    'sendPaymentRequest',
    'getSuppliers',
    'getEmployees',  // ⚠️ Note: This is for payment requests
    // ... other payment request actions
];
```

**Proxy forwards request to:**
```
https://script.google.com/macros/s/AKfycbyltkunEjTHhFSRH6evpwDAxZk74QouLTG-FSlCOQtLJGts8guLhFYuBq9n1h0fJvyd/exec
```

---

### 3. Google Apps Script Backend (`VOUCHER_WORKFLOW_BACKEND.gs`)

#### Step 3a: Request Routing

**Location:** `doPost` function (lines 108-219)

**What happens:**
1. Parses request body from `e.parameter` (URL-encoded form data)
2. Extracts `action` and `companyName`
3. Routes to `handleGetCompanyApprovers` handler

**Code:**
```javascript
case 'getCompanyApprovers': 
    Logger.log('✅✅✅ MATCHED getCompanyApprovers case ✅✅✅');
    let companyNameParam = null;
    if (requestBody) {
        companyNameParam = requestBody.companyName || requestBody.company || null;
    }
    return handleGetCompanyApprovers(requestBody, companyNameParam);
```

#### Step 3b: Handler Function

**Location:** `handleGetCompanyApprovers` (lines 591-784)

**What it does:**

1. **Extract company name** from request (handles multiple formats):
   - From `e.parameter.companyName` (URL-encoded form)
   - From `directCompanyName` parameter
   - Case-insensitive matching

2. **Open Google Sheet:**
   ```javascript
   const ss = SpreadsheetApp.openById(TLCG_MASTER_DATA_SHEET_ID);
   const sheet = ss.getSheetByName(COMPANY_SHEET_NAME); // "Công ty"
   ```

3. **Find company row** in Column B (case-insensitive match)

4. **Extract approver data** from columns:
   - **Legal Representative (Đại diện pháp luật):**
     - Name: Column F (index 5)
     - Email: Column E (index 4)
     - Signature: Column G (index 6)
   
   - **Chief Accountant (Kế toán trưởng):**
     - Name: Column I (index 8)
     - Email: Column H (index 7)
     - Signature: Column J (index 9)
   
   - **Treasurer (Thủ quỹ):**
     - Name: Column L (index 11)
     - Email: Column K (index 10)
     - Signature: Column M (index 12)

   **Column Mapping Summary:**
   ```
   Legal Rep name:      Column F (index 5)
   Legal Rep email:     Column E (index 4)
   Legal Rep signature: Column G (index 6)
   
   Accountant name:      Column I (index 8)
   Accountant email:     Column H (index 7)
   Accountant signature: Column J (index 9)
   
   Treasurer name:      Column L (index 11)
   Treasurer email:     Column K (index 10)
   Treasurer signature: Column M (index 12)
   ```

5. **Return response:**
   ```javascript
   return createResponse(true, 'Thành công', { 
       approvers: {
           legalRep: { name, email, signature, role },
           accountant: { name, email, signature, role },
           treasurer: { name, email, signature, role }
       }
   });
   ```

**Column Mapping Reference:**
```
A: Tên công ty viết tắt (index 0)
B: Tên công ty (index 1) ⬅️ MATCH THIS COLUMN
C: Địa chỉ (index 2)
D: Mã số thuế (index 3)

Legal Representative (Đại diện pháp luật):
  E: Email (index 4)
  F: Name (index 5)
  G: Signature URL (index 6)

Chief Accountant (Kế toán trưởng):
  H: Email (index 7)
  I: Name (index 8)
  J: Signature URL (index 9)

Treasurer (Thủ quỹ):
  K: Email (index 10)
  L: Name (index 11)
  M: Signature URL (index 12)
```

---

### 4. Response Format

**Success Response:**
```json
{
    "success": true,
    "message": "Thành công",
    "data": {
        "approvers": {
            "legalRep": {
                "name": "Nguyễn Văn A",
                "email": "a.nguyen@company.com",
                "signature": "https://drive.google.com/...",
                "role": "Đại diện pháp luật"
            },
            "accountant": {
                "name": "Trần Thị B",
                "email": "b.tran@company.com",
                "signature": "https://drive.google.com/...",
                "role": "Kế toán trưởng"
            },
            "treasurer": {
                "name": "Lê Văn C",
                "email": "c.le@company.com",
                "signature": "https://drive.google.com/...",
                "role": "Thủ quỹ"
            }
        }
    }
}
```

**Error Response:**
```json
{
    "success": false,
    "message": "Không tìm thấy công ty: CÔNG TY ABC"
}
```

---

### 5. Frontend Storage

**Location:** `phieu_thu_chi.html` line 3286

**Data stored:**
```javascript
data.selectedCompanyApprovers = {
    legalRep: { name, email, signature, role },
    accountant: { name, email, signature, role },
    treasurer: { name, email, signature, role }
}
```

**Used in:**
- **Email sending** (`sendForApproval`): Lines 6211-6284
- **Review section** (`updateReviewSection`): Lines 2940-2953
- **PDF printing** (`printVoucher`): Lines 5101-5155
- **Voucher submission** (`submitVoucher`): Line 6949

---

## 🔍 Troubleshooting

### Error: "Action không hợp lệ: getCompanyApprovers"

**Cause:** Backend code not deployed or outdated

**Fix:**
1. Deploy latest `VOUCHER_WORKFLOW_BACKEND.gs` to Apps Script
2. Check `doPost` includes `case 'getCompanyApprovers':`
3. Check `doGet` includes `} else if (action === 'getCompanyApprovers') {`

---

### Error: "Unexpected error while getting the method or property openById"

**Cause:** Permissions issue - Apps Script not authorized

**Fix:**
1. Run `testSpreadsheetAccess()` function in Apps Script
2. Click "Review Permissions" → "Allow"
3. Verify spreadsheet is shared with script owner
4. See `FIX_SPREADSHEET_PERMISSIONS.md` for details

---

### Error: "Không tìm thấy công ty: [company name]"

**Causes:**
1. Company name doesn't match exactly (including spaces, capitalization)
2. Company not in "Công ty" sheet
3. Company name in wrong column (should be Column B)

**Fix:**
1. Check company name in frontend matches exactly with Column B in sheet
2. Verify company exists in "Công ty" sheet
3. Check for extra spaces or special characters

---

### Error: "Tên công ty là bắt buộc"

**Cause:** `companyName` parameter not being passed correctly

**Fix:**
1. Check frontend sends `companyName` in POST body
2. Check backend logs for parameter parsing
3. Verify `e.parameter.companyName` is accessible in `doPost`

---

## 🧪 Testing

### Test 1: Direct URL Test
```
https://YOUR_WEB_APP_URL?action=getCompanyApprovers&companyName=CÔNG TY TNHH TƯ VẤN TLC
```

### Test 2: Apps Script Function
```javascript
function testGetCompanyApprovers() {
    const result = handleGetCompanyApprovers({companyName: 'CÔNG TY TNHH TƯ VẤN TLC'});
    Logger.log(result);
}
```

### Test 3: Frontend Console
```javascript
// In browser console on phieu_thu_chi.html page
fetch('/api/voucher', {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: 'action=getCompanyApprovers&companyName=CÔNG TY TNHH TƯ VẤN TLC'
})
.then(r => r.json())
.then(d => console.log(d));
```

---

## 📋 Checklist

Before deploying, verify:

- [ ] `handleGetCompanyApprovers` function exists in backend
- [ ] `doPost` has `case 'getCompanyApprovers':` 
- [ ] `doGet` has `} else if (action === 'getCompanyApprovers') {`
- [ ] Frontend calls `loadCompanyApprovers()` when company changes
- [ ] Frontend stores result in `data.selectedCompanyApprovers`
- [ ] Spreadsheet permissions are granted
- [ ] "Công ty" sheet exists with correct column structure
- [ ] Company names in Column B match frontend dropdown values

---

## 🎯 Key Points

1. **Case-insensitive matching:** Company name matching is case-insensitive
2. **Column B is key:** Company name must be in Column B (index 1)
3. **Three approvers required:** Legal Rep, Accountant, Treasurer
4. **Signatures optional:** Signature URLs can be empty strings
5. **Error handling:** Comprehensive error messages guide troubleshooting

---

## 📚 Related Files

- `phieu_thu_chi.html`: Frontend implementation (lines 3286-3340)
- `VOUCHER_WORKFLOW_BACKEND.gs`: Backend handler (lines 591-784)
- `api/voucher.js`: Vercel proxy routing (uses default PHIEU_THU_CHI_BACKEND)
- `FIX_SPREADSHEET_PERMISSIONS.md`: Permissions troubleshooting guide

---

**Last Updated:** 2025-01-13
