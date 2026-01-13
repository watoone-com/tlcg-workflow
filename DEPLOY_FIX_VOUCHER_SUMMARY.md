# Deploy Fix for Voucher Summary

## Problem
The "Recent Vouchers" section shows error: "Unexpected error while getting the method or property openById on object SpreadsheetApp."

## Solution
Deploy the updated `VOUCHER_WORKFLOW_BACKEND.gs` file to Google Apps Script.

## Quick Deployment Steps

### 1. Open Google Apps Script
- Go to [script.google.com](https://script.google.com)
- Sign in with the account that owns the Web App (linh.le@tl-c.com.vn)
- Open your project (the one with Web App URL: `AKfycbwcz8QPzcb7fCeTc7f7xjBHNamLq44bh-TTTH_1MCCOOwtw2bI9U_8yACfAr6SV_V3K`)

### 2. Replace the Code
1. In the code editor, select all (Ctrl+A / Cmd+A) and delete
2. Open `VOUCHER_WORKFLOW_BACKEND.gs` from your workspace
3. Copy ALL the code (Ctrl+A, Ctrl+C / Cmd+A, Cmd+C)
4. Paste into the Google Apps Script editor (Ctrl+V / Cmd+V)

### 3. Save the Project
- Click **File** → **Save** (or press Ctrl+S / Cmd+S)
- Wait for "All changes saved" confirmation

### 4. Deploy as Web App
1. Click **Deploy** → **Manage deployments**
2. Find your existing deployment
3. Click the **pencil icon (✏️)** next to your deployment
4. Click **Save** (don't change any settings)
5. Click **Done**

### 5. Test
- Go back to `phieu_thu_chi.html` 
- Refresh the page
- Check the "Recent Vouchers" section
- Check browser console for any errors

## Important Notes
- The fix changes `handleGetVoucherSummary` to use the same one-liner pattern as other working functions
- Other functions (`handleSendEmail`, `appendHistory_`, etc.) use the same pattern and work correctly
- After deployment, the error should be resolved

## If Error Persists
1. **Re-authorize the script:**
   - In Apps Script editor, click **Run** → Select any function → Click **Run**
   - Authorize permissions if prompted
   
2. **Check script logs:**
   - View → Executions
   - Check the latest execution for detailed error messages

3. **Verify spreadsheet access:**
   - Ensure the script owner (linh.le@tl-c.com.vn) has access to the spreadsheet
   - Spreadsheet ID: `1ujmPbtEdkGLgEshfhV8gRB6R0GLI31jsZM5rDOJS0g`
   - Sheet name: `Voucher_History`
