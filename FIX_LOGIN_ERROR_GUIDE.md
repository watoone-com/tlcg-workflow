# Fix Login Error Guide

## Error Description
```
Login failed: Lỗi: Unexpected error while getting the method or property openById on object SpreadsheetApp.
```

This error means the Google Apps Script doesn't have permission to access Google Sheets.

## Root Cause
The script `TLCG_INTRANET_BACKEND_COMPLETE.gs` (deployed at the TLCGROUP_BACKEND URL) needs authorization to access the spreadsheet with ID: `1ujmPbtEdkGLgEshfhvV8gRB6R0GLI31jsZM5rDOJS0g`

## Solution Steps

### Step 1: Update the Google Apps Script

1. **Open the script**:
   - Go to https://script.google.com
   - Find and open the project that contains `TLCG_INTRANET_BACKEND_COMPLETE.gs`
   - Or open it from the spreadsheet: Extensions → Apps Script

2. **Update the code**:
   - Copy the entire contents of `/Volumes/MI 02 (SSD)/TLCG Workflow/TLCG_INTRANET_BACKEND_COMPLETE.gs`
   - Paste it into the script editor (replace existing Code.gs)
   - Click **Save** (💾 icon)

### Step 2: Authorize the Script

1. **Run the test function**:
   - In the script editor, select `testSpreadsheetAccess` from the function dropdown
   - Click **Run** (▶️ button)

2. **Grant permissions**:
   - A popup will appear: "Authorization required"
   - Click **Review Permissions**
   - Choose your Google account
   - Click **Advanced** → **Go to [Project Name] (unsafe)**
   - Click **Allow**

3. **Check the logs**:
   - Click **View** → **Logs** (or **Execution log**)
   - You should see:
     ```
     ✅✅✅ ALL TESTS PASSED! ✅✅✅
     ```
   - If you see errors, read the error message carefully

### Step 3: Re-deploy the Web App

1. **Create new deployment**:
   - Click **Deploy** → **Manage deployments**
   - Click the **Pencil icon** (✏️) next to the active deployment
   - **Or** create new: Click **Deploy** → **New deployment**

2. **Configure deployment**:
   - Type: **Web app**
   - Description: `Login fix - authorized access` (optional)
   - **Execute as:** `Me (your-email@gmail.com)` ⚠️ CRITICAL
   - **Who has access:** `Anyone` ⚠️ CRITICAL
   - Click **Deploy**

3. **Verify the URL**:
   - Copy the Web App URL
   - It should look like: `https://script.google.com/macros/s/AKfycbz.../exec`
   - **Check if it matches the URL in `api/voucher.js` line 64**:
     ```
     Current: https://script.google.com/macros/s/AKfycbzPRHqtSW6JSef5A4tiDJbHnIhm2jhK9c8RH6lOBFPEMLR-EjF0iVJO2ndinMZRwbJ4Xw/exec
     ```
   - If different, update `api/voucher.js` with the new URL

### Step 4: Verify Spreadsheet Access

1. **Check spreadsheet permissions**:
   - Open: https://docs.google.com/spreadsheets/d/1ujmPbtEdkGLgEshfhvV8gRB6R0GLI31jsZM5rDOJS0g/edit
   - Make sure the spreadsheet exists and you have access
   - The account running the script MUST have edit access

2. **Verify sheet name**:
   - Make sure there's a sheet named `Nhân viên` in the spreadsheet
   - Check that it has the correct columns (Email, Password, Name, etc.)

### Step 5: Test the Login

1. **Clear browser cache** (optional but recommended)
2. **Try logging in again**
3. **Check browser console** (F12 → Console tab) for any errors

## Expected Results

### ✅ Success
- Login works without errors
- User is redirected to the main page

### ❌ Still Failing?

If you still get errors, check the detailed error message. The updated script now provides helpful Vietnamese error messages:

#### Error: "Script chưa được cấp quyền"
- Go back to Step 2 and re-authorize

#### Error: "Không tìm thấy spreadsheet"
- Check spreadsheet ID is correct
- Verify spreadsheet exists
- Make sure it's not deleted

#### Error: "Không có quyền truy cập spreadsheet"
- Share the spreadsheet with the account running the script
- Or set spreadsheet to "Anyone with link can edit"

#### Error: "Không tìm thấy sheet 'Nhân viên'"
- Check the sheet name spelling
- Make sure the sheet exists in the spreadsheet

## Technical Details

### What Changed?

I added comprehensive error handling to `TLCG_INTRANET_BACKEND_COMPLETE.gs`:

1. **Helper functions** (`safeOpenSpreadsheet`, `safeGetSheet`):
   - Detailed error messages in Vietnamese
   - Specific troubleshooting steps
   - Better logging for debugging

2. **Updated functions**:
   - `authenticateUser()` - Login authentication
   - `createUser()` - User creation
   - `updateUserPassword()` - Password updates
   - `syncToGoogleSheets()` - Data sync
   - `handleGetMasterData()` - Master data fetch

3. **New test function** (`testSpreadsheetAccess()`):
   - Verifies spreadsheet access
   - Tests sheet access
   - Provides step-by-step guidance

### Architecture

```
User Browser (index.html)
    ↓ POST /api/voucher
Vercel Proxy (api/voucher.js)
    ↓ Routes 'login' action to TLCGROUP_BACKEND
Google Apps Script (TLCG_INTRANET_BACKEND_COMPLETE.gs)
    ↓ Opens spreadsheet
Google Sheets (1ujmPbtEdkGLgEshfhvV8gRB6R0GLI31jsZM5rDOJS0g)
```

## Need More Help?

Check these logs:
1. **Google Apps Script logs**: script.google.com → View → Logs
2. **Vercel logs**: vercel.com → Your project → Logs
3. **Browser console**: F12 → Console tab

Look for specific error messages and follow the troubleshooting steps provided.
