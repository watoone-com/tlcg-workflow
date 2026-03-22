# Fix: "Unexpected error while getting the method or property openById"

## Error Description
```
Login failed: Lỗi: Unexpected error while getting the method or property openById on object SpreadsheetApp.
```

## Root Cause
This error occurs when the Google Apps Script **has not been authorized** to access Google Sheets, or the **deployment configuration is incorrect**.

## Solution Steps

### Step 1: Update the Code
✅ **Already done** - The code has been updated with better error handling and authorization checks.

### Step 2: Authorize the Script

1. **Open Google Apps Script Editor**:
   - Go to https://script.google.com
   - Open the project containing `TLCG_INTRANET_BACKEND_COMPLETE.gs`

2. **Run the Test Function**:
   - In the function dropdown at the top, select `testSpreadsheetAccess`
   - Click the **Run** button (▶️)
   - **IMPORTANT**: A popup will appear asking for authorization
   - Click **"Review Permissions"**
   - Select your Google account
   - Click **"Advanced"** → **"Go to [Project Name] (unsafe)"**
   - Click **"Allow"**

3. **Check the Logs**:
   - Click **View** → **Logs** (or **Execution log**)
   - You should see:
     ```
     ✅✅✅ ALL TESTS PASSED! ✅✅✅
     ```
   - If you see errors, read the error message and follow the troubleshooting steps

### Step 3: Re-deploy the Web App

1. **Open Deployment Settings**:
   - Click **Deploy** → **Manage deployments**
   - Click the **pencil icon (✏️)** next to the active deployment

2. **Configure Deployment** (CRITICAL):
   - **Execute as:** Must be set to **"Me (your-email@gmail.com)"** ⚠️
     - **NOT** "User accessing the web app"
   - **Who has access:** Must be set to **"Anyone"** ⚠️
   - Description: `Login fix - authorized access` (optional)

3. **Deploy**:
   - Click **"Deploy"** (or **"Update"** if editing)
   - Copy the new Web App URL

4. **Update Frontend** (if URL changed):
   - Check if the new URL matches the URL in `api/voucher.js` line 64-65
   - If different, update `api/voucher.js` with the new URL:
     ```javascript
     const TLCGROUP_BACKEND = process.env.TLCGROUP_BACKEND_URL ||
       'https://script.google.com/macros/s/YOUR_NEW_URL_HERE/exec';
     ```

### Step 4: Verify Spreadsheet Permissions

1. **Check Spreadsheet Access**:
   - Open: https://docs.google.com/spreadsheets/d/1ujmPbtEdkGLgEshfhvV8gRB6R0GLI31jsZM5rDOJS0g/edit
   - Make sure the spreadsheet exists and you have access

2. **Share with Script Account** (if needed):
   - Click **Share** button
   - Add the Google account that's running the script
   - Give it **Editor** access
   - OR set spreadsheet to **"Anyone with link can view/edit"**

### Step 5: Test Login

1. **Clear browser cache** (optional but recommended)
2. **Try logging in again**
3. **Check browser console** (F12 → Console) for any errors

## Code Changes Made

### Enhanced Error Checking
The `safeOpenSpreadsheet()` function now:
1. ✅ Checks if `SpreadsheetApp` is available
2. ✅ Checks if `openById` method exists before calling it
3. ✅ Provides clear, actionable error messages
4. ✅ Logs detailed diagnostic information

### Better Error Messages
- If `SpreadsheetApp` is undefined: Clear error message
- If `openById` is not a function: Authorization error with step-by-step fix instructions
- If spreadsheet not found: Spreadsheet ID verification steps
- If permission denied: Sharing instructions

## Verification Checklist

- [ ] Code has been updated with enhanced error handling
- [ ] `testSpreadsheetAccess()` function has been run successfully
- [ ] Script has been authorized (no more permission prompts)
- [ ] Web app has been re-deployed
- [ ] Deployment settings: **Execute as: Me**
- [ ] Deployment settings: **Who has access: Anyone**
- [ ] Web App URL has been updated in `api/voucher.js` (if changed)
- [ ] Spreadsheet is accessible and shared correctly
- [ ] Login test is successful

## Expected Results

### ✅ Success
- Login works without errors
- User is authenticated successfully
- User data is returned correctly

### ❌ Still Failing?

If you still get errors after following all steps:

1. **Check Google Apps Script Execution Logs**:
   - View → Logs
   - Look for specific error messages
   - The enhanced error handling will provide detailed diagnostics

2. **Verify Deployment Configuration**:
   - Execute as: **Me** (not "User accessing the web app")
   - Who has access: **Anyone**

3. **Check Spreadsheet**:
   - Verify spreadsheet ID: `1ujmPbtEdkGLgEshfhvV8gRB6R0GLI31jsZM5rDOJS0g`
   - Verify sheet name: `"Nhân viên"`
   - Verify you have access to the spreadsheet

4. **Re-run Authorization**:
   - Run `testSpreadsheetAccess()` again
   - Make sure authorization popup appears and you click "Allow"

## Technical Details

### What Changed in the Code?

**Before:**
```javascript
const ss = SpreadsheetApp.openById(spreadsheetId); // Could fail silently
```

**After:**
```javascript
// Check if SpreadsheetApp is available
if (typeof SpreadsheetApp === 'undefined') {
  throw new Error('SpreadsheetApp không khả dụng...');
}

// Check if openById method exists (authorization check)
if (typeof SpreadsheetApp.openById !== 'function') {
  throw new Error('Script chưa được cấp quyền...');
}

// Now safe to call
const ss = SpreadsheetApp.openById(spreadsheetId);
```

### Why This Error Occurs

The error "Unexpected error while getting the method or property openById" happens when:
1. **Script not authorized**: The script hasn't been run manually to trigger the OAuth flow
2. **Wrong deployment setting**: "Execute as: User accessing the web app" doesn't work for SpreadsheetApp operations
3. **Permission scope**: The script needs explicit permission to access Google Sheets

### Architecture Flow

```
User Browser (index.html)
    ↓ POST /api/voucher (action: 'login')
Vercel Proxy (api/voucher.js)
    ↓ Routes to TLCGROUP_BACKEND
Google Apps Script (TLCG_INTRANET_BACKEND_COMPLETE.gs)
    ↓ doPost() → handleLogin() → authenticateUser()
    ↓ safeOpenSpreadsheet() → SpreadsheetApp.openById()
Google Sheets (1ujmPbtEdkGLgEshfhvV8gRB6R0GLI31jsZM5rDOJS0g)
```

## Need More Help?

If the issue persists:
1. Check Google Apps Script execution logs for detailed error messages
2. Verify all deployment settings are correct
3. Ensure the script account has access to the spreadsheet
4. Try running `testSpreadsheetAccess()` again to re-authorize
