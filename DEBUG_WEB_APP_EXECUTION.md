# Debug Web App Execution

## Current Status ✅
- Spreadsheet shared correctly ✅
- URL matches deployment ✅
- `testWebAppDeployment()` PASSED ✅
- But login still fails ❌

## The Mystery

If `testWebAppDeployment()` passes, the code CAN access the spreadsheet. But when called via web app URL, it fails. This suggests:

1. **Different execution context** - Web app might be using a different context
2. **Caching issue** - Old code might be cached
3. **Error handling** - Error might be caught and transformed incorrectly
4. **Request parsing** - Web app request might be parsed differently

## Next Steps to Debug

### Step 1: Check Execution Logs for Web App Calls

1. **Try to log in** from your application
2. **Immediately** go to Google Apps Script: https://script.google.com
3. Click **View** → **Executions** (or **Execution log**)
4. Find the **most recent execution** (should be from the login attempt)
5. **Click on it** to see details
6. **Copy the full log output** - especially:
   - Any error messages
   - The execution context information
   - What function was called (doPost?)
   - The full error stack trace

### Step 2: Test Web App URL Directly

Test the web app URL directly (bypassing Vercel) to see the raw error:

1. Open this URL in browser (replace with your actual web app URL):
   ```
   https://script.google.com/macros/s/AKfycbzPRHqtSW6JSef5A4tiDJbHnIhm2jhK9c8RH6lOBFPEMLR-EjF0iVJO2ndinMZRwbJ4Xw/exec?action=login&email=test@example.com&password=test
   ```

2. Check what error you get
3. This will tell us if it's a Vercel proxy issue or web app issue

### Step 3: Check for Multiple Script Projects

There might be multiple Google Apps Script projects, and the URL might be pointing to a different one:

1. Go to https://script.google.com
2. Check **ALL** your projects
3. Verify which project has the URL: `AKfycbzPRHqtSW6JSef5A4tiDJbHnIhm2jhK9c8RH6lOBFPEMLR-EjF0iVJO2ndinMZRwbJ4Xw`
4. Make sure that project has the latest code with all our fixes

### Step 4: Clear Cache and Re-deploy

Sometimes Google Apps Script caches old code:

1. **Deploy** → **Manage deployments**
2. **Delete** the current deployment
3. **Create new deployment**:
   - Type: Web app
   - Execute as: Me (linh.le@tl-c.com.vn)
   - Who has access: Anyone
4. **Copy new URL**
5. **Update** `api/voucher.js` with new URL
6. **Test again**

### Step 5: Add More Logging

The code now has enhanced logging. When you try to log in:

1. Check **View** → **Executions**
2. Look for logs that show:
   - `=== doPost called ===`
   - `Execution context check - SpreadsheetApp available:`
   - `Execution context check - openById available:`
   - `[authenticateUser] safeOpenSpreadsheet called`

These logs will tell us exactly where it's failing.

## What to Look For

When checking execution logs, look for:

1. **Does doPost get called?** (Should see "=== doPost called ===")
2. **What's the execution context?** (SpreadsheetApp available? openById available?)
3. **Where does it fail?** (In safeOpenSpreadsheet? In authenticateUser?)
4. **What's the exact error message?** (Copy the full error)

## Most Likely Causes

Given that `testWebAppDeployment()` passes:

1. **Cached old code** - Web app is running old version without fixes
2. **Different script project** - URL points to different project
3. **Error transformation** - Error is being caught and transformed, losing original message
4. **Request format** - Web app receives request in different format than expected

## Quick Test

Try this: Call the web app URL directly with a simple test:

```
https://script.google.com/macros/s/AKfycbzPRHqtSW6JSef5A4tiDJbHnIhm2jhK9c8RH6lOBFPEMLR-EjF0iVJO2ndinMZRwbJ4Xw/exec?action=diagnose
```

This should return diagnostic information. If it works, the web app is fine. If it fails with openById error, then we know it's a web app execution context issue.
