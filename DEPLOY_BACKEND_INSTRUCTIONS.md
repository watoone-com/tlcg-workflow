# Backend Deployment Instructions

## Overview
This guide will help you deploy the updated backend code to Google Apps Script so that employee data (including departments) can be fetched from the "Nhân viên" sheet.

## Pre-Deployment Checklist

✅ Backend code is ready: `VOUCHER_WORKFLOW_BACKEND.gs`
✅ Backend includes `getEmployees` function to fetch from "Nhân viên" sheet
✅ Backend reads departments from column C (Phòng ban)
✅ Frontend code is ready and will call the backend

## Deployment Steps

### Step 1: Open Google Apps Script
1. Go to [script.google.com](https://script.google.com)
2. Sign in with your Google account (the one that owns the Web App)

### Step 2: Open Your Project
1. Find and open your project (the one with Web App URL: `AKfycbwcz8QPzcb7fCeTc7f7xjBHNamLq44bh-TTTH_1MCCOOwtw2bI9U_8yACfAr6SV_V3K`)
2. If you're not sure which project, look for the one containing voucher workflow code

### Step 3: Backup Current Code (Optional but Recommended)
1. Select all code (Ctrl+A / Cmd+A)
2. Copy it (Ctrl+C / Cmd+C)
3. Paste into a backup file or text editor for reference

### Step 4: Replace Code
1. Delete all existing code in the editor
2. Open the file: `VOUCHER_WORKFLOW_BACKEND.gs` from your workspace
3. Copy the entire file content (Ctrl+A, Ctrl+C / Cmd+A, Cmd+C)
4. Paste it into the Google Apps Script editor (Ctrl+V / Cmd+V)

### Step 5: Save the Project
1. Click **File** → **Save** (or press Ctrl+S / Cmd+S)
2. Give the project a name if prompted (or keep existing name)
3. Wait for "All changes saved" confirmation

### Step 6: Review Important Configuration
Verify these constants at the top of the code:
- `VOUCHER_HISTORY_SHEET_ID = '1ujmPbtEdkGLgEshfhV8gRB6R0GLI31jsZM5rDOJS0g'`
- `USERS_SHEET_ID = VOUCHER_HISTORY_SHEET_ID` (same spreadsheet)
- `EMPLOYEES_SHEET_NAME = 'Nhân viên'`

### Step 7: Deploy as Web App
1. Click **Deploy** → **Manage deployments** (or **Deploy** → **New deployment**)
2. If editing existing deployment:
   - Click the **pencil icon (✏️)** next to your deployment
   - OR click **New deployment**
3. Configure the deployment:
   - **Type**: Select **Web app**
   - **Description** (optional): "Updated with getEmployees function"
   - **Execute as**: Select **Me** (your email)
   - **Who has access**: Select **Anyone** (or "Anyone with Google account" if you prefer)
4. Click **Deploy**

### Step 8: Authorize Permissions (if prompted)
1. If asked to authorize, click **Authorize access**
2. Choose your Google account
3. Click **Advanced** → **Go to [Project Name] (unsafe)** (if warning appears)
4. Click **Allow** to grant permissions
5. You may need to do this twice (once for viewing, once for executing)

### Step 9: Copy the Web App URL
1. After deployment, you'll see the Web App URL
2. Copy the URL (it should be the same as before if editing existing deployment)
3. Verify it matches: `https://script.google.com/macros/s/AKfycbwcz8QPzcb7fCeTc7f7xjBHNamLq44bh-TTTH_1MCCOOwtw2bI9U_8yACfAr6SV_V3K/exec`

### Step 10: Test the Deployment
1. Open your workflow page (`phieu_thu_chi.html`)
2. Open browser console (F12 → Console tab)
3. Refresh the page
4. Look for:
   - ✅ `📥 Fetching employees from backend...`
   - ✅ `✅ Fetched X employees from backend`
   - ✅ `✅ Employee departments loaded from backend (column C - Phòng ban)`
5. Select an employee from the dropdown
6. Verify the department field populates correctly

## Verification Checklist

After deployment, verify:

- [ ] No errors in browser console
- [ ] Employee list loads correctly
- [ ] Department field populates when selecting employees
- [ ] Departments match the "Nhân viên" sheet data
- [ ] No "Action không hợp lệ" errors

## Troubleshooting

### Error: "Action không hợp lệ trong GET: getEmployees"
- **Cause**: Backend not deployed or deployment failed
- **Solution**: Re-check deployment steps, ensure code was saved before deploying

### Error: "Sheet 'Nhân viên' không tồn tại"
- **Cause**: Sheet name doesn't match exactly
- **Solution**: Verify sheet name is exactly "Nhân viên" (case-sensitive) in the spreadsheet

### Departments not updating
- **Cause**: Browser cache or deployment not active
- **Solution**: 
  1. Hard refresh the page (Ctrl+Shift+R / Cmd+Shift+R)
  2. Clear browser cache
  3. Wait a few seconds after deployment for changes to propagate

### Permission errors
- **Cause**: Google Apps Script needs access to the spreadsheet
- **Solution**: 
  1. Ensure the spreadsheet is shared with the Google account running the script
  2. Re-authorize the script with proper permissions

## After Successful Deployment

✅ The system will automatically fetch employee data from "Nhân viên" sheet
✅ Departments will come from column C (Phòng ban)
✅ New employees added to the sheet will appear automatically
✅ Department changes in the sheet will be reflected automatically
✅ No code changes needed for future updates

## Support

If you encounter issues:
1. Check the browser console for error messages
2. Check Google Apps Script execution logs (View → Executions)
3. Verify the spreadsheet ID and sheet name are correct
4. Ensure the spreadsheet is accessible to the script's Google account
