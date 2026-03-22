# Diagnostic Guide for openById Error

## Quick Diagnostic Steps

### Option 1: Run Diagnostic Function (Recommended)

1. **Open Google Apps Script Editor**:
   - Go to https://script.google.com
   - Open your project

2. **Run Diagnostic Function**:
   - Select `diagnoseSpreadsheetAccess` from the function dropdown
   - Click **Run** (▶️)
   - If prompted for authorization, click **"Review Permissions"** → **"Advanced"** → **"Go to [Project Name] (unsafe)"** → **"Allow"**

3. **Check Results**:
   - Click **View** → **Logs**
   - Look for test results:
     - ✅ PASSED = Working correctly
     - ❌ FAILED = Issue identified with specific error message

### Option 2: Use Diagnostic Endpoint

You can also call the diagnostic endpoint via your web app:

```javascript
// In browser console or test script
const formData = new FormData();
formData.append('action', 'diagnose');

const response = await fetch('YOUR_WEB_APP_URL', {
  method: 'POST',
  body: formData
});
const result = await response.json();
console.log(result);
```

## What Each Test Checks

### Test 1: SpreadsheetApp Availability
- Checks if `SpreadsheetApp` object exists
- **If FAILED**: Script environment issue (very rare)

### Test 2: openById Method
- Checks if `SpreadsheetApp.openById` is a function
- **If FAILED**: **Authorization required** - This is the most common cause
  - Solution: Run `testSpreadsheetAccess()` to authorize
  - Then re-deploy with "Execute as: Me"

### Test 3: Spreadsheet ID
- Verifies `USERS_SHEET_ID` is defined
- **If FAILED**: Configuration issue - check script constants

### Test 4: Open Spreadsheet
- Attempts to open the spreadsheet
- **If FAILED**: 
  - Authorization error → Run authorization
  - Not found → Check spreadsheet ID and access
  - Permission denied → Share spreadsheet with script account

### Test 5: Sheet Access
- Checks if "Nhân viên" sheet exists
- **If FAILED**: Sheet name mismatch or sheet doesn't exist

### Test 6: Read Data
- Attempts to read data from the sheet
- **If FAILED**: Data access permission issue

## Common Issues and Solutions

### Issue: "openById method not available"
**Cause**: Script not authorized  
**Solution**:
1. Run `testSpreadsheetAccess()` function
2. Authorize when prompted
3. Re-deploy web app with "Execute as: Me"

### Issue: "Spreadsheet not found"
**Cause**: Wrong spreadsheet ID or no access  
**Solution**:
1. Verify spreadsheet ID: `1ujmPbtEdkGLgEshfhvV8gRB6R0GLI31jsZM5rDOJS0g`
2. Open spreadsheet: https://docs.google.com/spreadsheets/d/1ujmPbtEdkGLgEshfhvV8gRB6R0GLI31jsZM5rDOJS0g/edit
3. Ensure you have access to the spreadsheet

### Issue: "Sheet not found"
**Cause**: Sheet name mismatch  
**Solution**:
1. Check sheet name is exactly: `"Nhân viên"`
2. Verify in the spreadsheet that this sheet exists
3. Update `USERS_SHEET_NAME` constant if needed

### Issue: "Permission denied"
**Cause**: Spreadsheet not shared with script account  
**Solution**:
1. Open the spreadsheet
2. Click **Share**
3. Add the Google account that's running the script
4. Give it **Editor** access
5. OR set spreadsheet to **"Anyone with link can view/edit"**

## Deployment Configuration Check

After running diagnostics, verify deployment settings:

1. **Deploy** → **Manage deployments** → **Edit**
2. Check:
   - ✅ **Execute as:** `Me (your-email@gmail.com)` ← **CRITICAL**
   - ❌ NOT "User accessing the web app"
   - ✅ **Who has access:** `Anyone`
3. Click **Deploy** (or **Update**)

## Next Steps After Diagnosis

1. **If all tests PASSED**:
   - The script is working correctly
   - The issue might be in the frontend or API routing
   - Check browser console and network requests

2. **If any test FAILED**:
   - Follow the specific solution for that test
   - Re-run diagnostics after fixing
   - Re-deploy web app after authorization

3. **If still failing after fixes**:
   - Share the diagnostic log output
   - Check Google Apps Script execution logs
   - Verify all deployment settings

## Getting Help

If diagnostics don't reveal the issue, provide:
1. Full diagnostic log output (from View → Logs)
2. Deployment configuration screenshot
3. Error message from browser console
4. Network request/response details
