# 🔐 Fix Spreadsheet Permissions Error

## Error Message
```
{"success":false,"message":"Lỗi: Unexpected error while getting the method or property openById on object SpreadsheetApp."}
```

This means the Apps Script **doesn't have permission** to access the spreadsheet.

---

## ✅ Solution: Authorize the Script

### Step 1: Run a Test Function to Trigger Authorization

1. **Open Google Apps Script:** https://script.google.com
2. **Open your project** (the one with `VOUCHER_WORKFLOW_BACKEND.gs`)
3. **Select function:** `testSpreadsheetAccess` (or any function)
4. **Click Run (▶️ button)**
5. **Click "Review Permissions"** when prompted
6. **Choose your Google account**
7. **Click "Advanced"** → **"Go to [Project Name] (unsafe)"**
8. **Click "Allow"** to grant permissions

### Step 2: Verify Spreadsheet Sharing

The spreadsheet must be shared with the account running the script:

1. **Open the spreadsheet:**
   https://docs.google.com/spreadsheets/d/1ujmPbtEdkGLgEshfhV8gRB6R0GLI31jsZM5rDOJS0g/edit

2. **Click "Share" button** (top right)

3. **Add the script owner's email:**
   - If script owner is `linh.le@tl-c.com.vn`, make sure this email has access
   - If script owner is different, add that email
   - Permission level: **Editor** (at minimum)

4. **Save**

### Step 3: Test Access

After authorizing, test again:

**Option A: Test via Apps Script Editor**
1. Select function: `testSpreadsheetAccess`
2. Click **Run**
3. Check **View → Execution log**
4. Should see: `✅ Spreadsheet opened successfully`

**Option B: Test via URL**
```
https://YOUR_WEB_APP_URL?action=getCompanyApprovers&companyName=CÔNG TY TNHH TƯ VẤN TLC
```

---

## 🔍 Quick Diagnostic Function

The script already has a test function. Run it:

```javascript
// Already in your code - just run it:
testSpreadsheetAccess()
```

This will tell you exactly what's wrong:
- ✅ If SpreadsheetApp is available
- ✅ If openById method exists  
- ❌ If spreadsheet can't be opened (permissions issue)

---

## 📋 Common Issues & Fixes

### Issue 1: "You need permission"
**Fix:** Click "Review Permissions" and authorize

### Issue 2: "Cannot access spreadsheet"
**Fix:** Share spreadsheet with script owner's email

### Issue 3: Script owner doesn't match spreadsheet owner
**Fix:** Either:
- Share spreadsheet with script owner, OR
- Change script owner to match spreadsheet owner

### Issue 4: Deployed Web App uses different account
**Fix:** 
- Deploy → Manage deployments
- Check "Execute as" setting
- Make sure it's set to "Me" (your account that has spreadsheet access)

---

## ⚠️ Important Notes

1. **Authorization is per-account**: The account that deploys the Web App must have spreadsheet access
2. **Re-authorize after deployment**: Sometimes permissions need to be re-granted after deploying
3. **Check "Execute as"**: In deployment settings, "Execute as" should be "Me" (not "User accessing the web app")

---

## 🚀 Quick Fix Steps

1. ✅ Run `testSpreadsheetAccess()` function in Apps Script
2. ✅ Authorize when prompted
3. ✅ Verify spreadsheet is shared with script owner
4. ✅ Re-deploy Web App if needed
5. ✅ Test the action again

---

**After authorization, the error should be resolved!** 🎯
