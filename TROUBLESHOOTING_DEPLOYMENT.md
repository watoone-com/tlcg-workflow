# Troubleshooting: Deployment Correct But Still Failing

## Your Current Configuration ✅
- Execute as: **Owner (linh.le@tl-c.com.vn)** ✅
- Who has access: **Anyone** ✅
- Diagnostic tests: **All passed** ✅

But login still fails with `openById` error.

## Possible Causes & Solutions

### 1. Spreadsheet Not Shared with Script Owner

**Check:**
1. Open spreadsheet: https://docs.google.com/spreadsheets/d/1ujmPbtEdkGLgEshfhvV8gRB6R0GLI31jsZM5rDOJS0g/edit
2. Click **Share** button (top right)
3. Verify `linh.le@tl-c.com.vn` is in the list
4. Ensure permission is **Editor** (not just Viewer)

**Fix if missing:**
- Click **Share**
- Add `linh.le@tl-c.com.vn`
- Set permission to **Editor**
- Click **Send**

### 2. Multiple Deployments - Wrong URL Being Used

**Check:**
1. Go to https://script.google.com → Your project
2. Click **Deploy** → **Manage deployments**
3. Look at ALL deployments (not just the active one)
4. Check the URL in `api/voucher.js` line 64-65:
   ```javascript
   const TLCGROUP_BACKEND = process.env.TLCGROUP_BACKEND_URL ||
     'https://script.google.com/macros/s/AKfycbzPRHqtSW6JSef5A4tiDJbHnIhm2jhK9c8RH6lOBFPEMLR-EjF0iVJO2ndinMZRwbJ4Xw/exec';
   ```

**Verify:**
- Does this URL match the deployment with "Execute as: Me"?
- Are there multiple deployments with different settings?

**Fix:**
- If URL doesn't match, update `api/voucher.js` with the correct URL
- Or delete old deployments and create a new one

### 3. Web App Needs Re-Authorization After Deployment

Even though diagnostic tests pass, the **web app deployment** might need separate authorization.

**Fix:**
1. Go to https://script.google.com
2. Click **Deploy** → **Manage deployments**
3. Click the **pencil icon** to edit
4. Click **Deploy** (or **Update**) - this triggers re-authorization
5. If prompted, authorize again

### 4. Check Execution Logs for Web App

The diagnostic tests run directly, but web app executions might show different errors.

**Check:**
1. Go to https://script.google.com → Your project
2. Click **View** → **Executions** (or **Execution log**)
3. Look for recent executions (especially failed ones)
4. Click on a failed execution to see details
5. Check the error message - it might be different from what the frontend shows

### 5. Verify the Correct Script Project

Make sure you're editing and deploying the **correct** script project.

**Check:**
1. The script should contain `TLCG_INTRANET_BACKEND_COMPLETE.gs`
2. The script should have `USERS_SHEET_ID = '1ujmPbtEdkGLgEshfhvV8gRB6R0GLI31jsZM5rDOJS0g'`
3. The script should have `testSpreadsheetAccess()` function

### 6. Test Web App URL Directly

Test the web app URL directly (bypassing Vercel proxy) to see if the issue is with the proxy or the web app itself.

**Test:**
1. Open the web app URL directly in browser:
   ```
   https://script.google.com/macros/s/AKfycbzPRHqtSW6JSef5A4tiDJbHnIhm2jhK9c8RH6lOBFPEMLR-EjF0iVJO2ndinMZRwbJ4Xw/exec?action=login&email=test@example.com&password=test
   ```
2. Check what error you get
3. This will tell you if it's a web app issue or proxy issue

### 7. Create New Deployment

Sometimes old deployments have cached permissions. Create a fresh deployment.

**Steps:**
1. Go to **Deploy** → **Manage deployments**
2. Click **New deployment** (don't edit existing)
3. Type: **Web app**
4. Execute as: **Me (linh.le@tl-c.com.vn)**
5. Who has access: **Anyone**
6. Click **Deploy**
7. Copy the **new URL**
8. Update `api/voucher.js` with the new URL

### 8. Check OAuth Scopes

The script needs the correct OAuth scopes to access spreadsheets.

**Check:**
1. Go to https://script.google.com → Your project
2. Click **Project Settings** (gear icon)
3. Scroll to **OAuth scopes**
4. Verify you see: `https://www.googleapis.com/auth/spreadsheets`
5. If missing, the script needs to request it (run a function that uses SpreadsheetApp)

### 9. Verify Spreadsheet ID is Correct

Double-check the spreadsheet ID matches the actual spreadsheet.

**Verify:**
1. Open: https://docs.google.com/spreadsheets/d/1ujmPbtEdkGLgEshfhvV8gRB6R0GLI31jsZM5rDOJS0g/edit
2. Check if it opens correctly
3. Check if it has a sheet named "Nhân viên"
4. Check if `linh.le@tl-c.com.vn` can see and edit it

## Diagnostic Steps

Run these in order:

### Step 1: Verify Spreadsheet Access
```javascript
// In Apps Script editor, run this:
function testDirectAccess() {
  const ss = SpreadsheetApp.openById('1ujmPbtEdkGLgEshfhvV8gRB6R0GLI31jsZM5rDOJS0g');
  Logger.log('Spreadsheet name: ' + ss.getName());
  const sheet = ss.getSheetByName('Nhân viên');
  Logger.log('Sheet name: ' + sheet.getName());
  Logger.log('✅ Direct access works!');
}
```

### Step 2: Test Web App URL
Open this URL directly (replace with your actual web app URL):
```
https://script.google.com/macros/s/YOUR_URL/exec?action=diagnose
```

This should return diagnostic information.

### Step 3: Check Execution Logs
1. Try logging in from your app
2. Immediately go to **View** → **Executions**
3. Find the most recent execution
4. Check the error message

## Most Likely Issue

Based on your description, the most likely issue is:

**#2: Multiple Deployments or Wrong URL**

The URL in `api/voucher.js` might be pointing to an old deployment that has different settings.

**Quick Fix:**
1. Check all deployments in **Deploy** → **Manage deployments**
2. Find the one with "Execute as: Me (linh.le@tl-c.com.vn)"
3. Copy its URL
4. Update `api/voucher.js` line 64-65 with that URL
5. Or set `TLCGROUP_BACKEND_URL` environment variable in Vercel

## Next Steps

1. **First**: Check spreadsheet sharing (most common issue)
2. **Second**: Verify the URL in `api/voucher.js` matches the correct deployment
3. **Third**: Check execution logs for web app calls (not direct function calls)
4. **Fourth**: Create a new deployment if needed

Let me know what you find!
