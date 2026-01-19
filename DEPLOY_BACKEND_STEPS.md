# 🚀 Deploy Backend Steps - Fix for getCompanyApprovers

## Critical: You MUST Deploy the Backend After Code Changes

The error "Action không hợp lệ: getCompanyApprovers" means the backend doesn't have the new code deployed.

---

## Step-by-Step Deployment

### 1. Open Google Apps Script
Go to: https://script.google.com

### 2. Open Your Project
- Find your project: `VOUCHER_WORKFLOW_BACKEND` (or similar name)
- Click to open

### 3. Copy Updated Code
1. Open the file `VOUCHER_WORKFLOW_BACKEND.gs` in this repository
2. Select ALL code (Ctrl+A / Cmd+A)
3. Copy (Ctrl+C / Cmd+C)

### 4. Paste in Apps Script Editor
1. In Google Apps Script, select ALL existing code
2. Delete it (Backspace or Delete)
3. Paste the new code (Ctrl+V / Cmd+V)
4. **Save** (Ctrl+S / Cmd+S) - Important!

### 5. Verify Key Functions Exist
Check that the file contains:
- ✅ `const COMPANY_SHEET_NAME = 'Công ty';` (around line 11)
- ✅ `handleGetCompanyApprovers(requestBody)` function (around line 537)
- ✅ `case 'getCompanyApprovers':` in `doPost` switch statement (around line 164)
- ✅ `} else if (action === 'getCompanyApprovers')` in `doGet` (around line 27)

### 6. Deploy as Web App

1. Click **Deploy** → **New deployment** (or **Manage deployments** → **Edit**)

2. Select type: **Web app**

3. Configuration:
   - **Description**: "Added getCompanyApprovers action" (optional)
   - **Execute as**: Me (your Google account)
   - **Who has access**: Anyone

4. Click **Deploy**

5. **Copy the Web App URL** - You'll need this!

### 7. Test the Deployment

#### Option A: Test via Browser URL
Replace `YOUR_WEB_APP_URL` with your actual URL:
```
https://YOUR_WEB_APP_URL?action=getCompanyApprovers&companyName=CÔNG TY TNHH TƯ VẤN TLC
```

Expected response (JSON):
```json
{
  "success": true,
  "message": "Thành công",
  "data": {
    "companyName": "CÔNG TY TNHH TƯ VẤN TLC",
    "approvers": {
      "legalRep": {...},
      "accountant": {...},
      "treasurer": {...}
    }
  }
}
```

#### Option B: Test in Apps Script Editor
1. Select function `handleGetCompanyApprovers`
2. Click **Run** (▶️ button)
3. When prompted, authorize the script
4. Check **View** → **Execution log** for any errors

### 8. Check Logs

If test fails:
1. Go to **View** → **Execution log**
2. Look for error messages
3. Check:
   - Sheet "Công ty" exists
   - Company name matches exactly (case-sensitive)
   - Permissions are granted

---

## Verify Deployment Checklist

- [ ] Code saved in Apps Script editor
- [ ] Web app deployed (new deployment or updated)
- [ ] Web app URL copied
- [ ] Test URL returns JSON response (not HTML error page)
- [ ] Response contains `"success": true`
- [ ] Response contains `approvers` object with 3 roles

---

## Common Issues

### Issue: "Script function not found"
**Fix**: Make sure you saved the code after pasting

### Issue: "Sheet 'Công ty' not found"
**Fix**: 
- Verify sheet name is exactly "Công ty" (not "Công Ty" or "CÔNG TY")
- Check spreadsheet ID is correct: `1ujmPbtEdkGLgEshfhV8gRB6R0GLI31jsZM5rDOJS0g`

### Issue: Still getting "Action không hợp lệ"
**Fix**:
- Clear browser cache
- Make sure you're testing the NEW deployment URL
- Check Apps Script logs to see which action was received

### Issue: Permission denied
**Fix**:
- Click **Review permissions**
- Authorize the script
- Make sure "Execute as" is set to "Me"

---

## Update Vercel Environment Variable (If Needed)

If you changed the Web App URL, update it in Vercel:

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Update `GOOGLE_APPS_SCRIPT_URL` with new URL
3. Redeploy Vercel function

---

**After deployment, test the frontend again!** 🎯
