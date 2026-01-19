# 🧪 Quick Test for getCompanyApprovers

## The Issue
The error "Action không hợp lệ: getCompanyApprovers" means the backend doesn't recognize the action. This is **almost certainly because the backend code hasn't been deployed**.

## Quick Verification Steps

### Step 1: Verify Backend Code Has the Action

Open `VOUCHER_WORKFLOW_BACKEND.gs` and search for:
- Line 27: `} else if (action === 'getCompanyApprovers') {`
- Line 175: `case 'getCompanyApprovers':`

If these lines exist, the code is correct. If not, the file needs to be updated.

### Step 2: Check if Backend is Deployed

The backend MUST be deployed for changes to take effect. The code in the file is just source code - Google Apps Script needs to be deployed as a Web App.

**To Deploy:**
1. Go to https://script.google.com
2. Open your project
3. Click **Deploy** → **New deployment** (or **Manage deployments** → **Edit**)
4. Make sure the latest code is saved
5. Deploy as Web App

### Step 3: Test Direct Backend URL (Bypass Proxy)

Test the backend directly to see if it recognizes the action:

**Replace `YOUR_WEB_APP_URL` with your actual Google Apps Script Web App URL:**

```
https://YOUR_WEB_APP_URL?action=getCompanyApprovers&companyName=CÔNG TY TNHH TƯ VẤN TLC
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Thành công",
  "data": {
    "companyName": "CÔNG TY TNHH TƯ VẤN TLC",
    "approvers": {...}
  }
}
```

**If you get "Action không hợp lệ":**
- Backend code is NOT deployed
- Deploy the backend immediately

**If you get a different error (like "Company not found"):**
- Backend IS deployed and working
- The issue is with the company name or sheet data

### Step 4: Check Vercel Proxy Logs

When testing through the frontend, check:
1. Browser DevTools → Network tab
2. Look for the POST request to `/api/voucher`
3. Check the response

If the proxy returns the error, it means the backend returned "Action không hợp lệ", which confirms the backend isn't deployed.

---

## Most Likely Solution

**99% chance: The backend code file (`VOUCHER_WORKFLOW_BACKEND.gs`) has the correct code, but it hasn't been deployed to Google Apps Script.**

**Fix: Deploy the backend!**

1. Copy ALL code from `VOUCHER_WORKFLOW_BACKEND.gs`
2. Paste into Google Apps Script editor
3. Save
4. Deploy → New deployment (or update existing)
5. Test again

---

## Alternative: Test with GET Request

If POST isn't working, you can temporarily test with GET:

```javascript
// In browser console:
fetch('/api/voucher?action=getCompanyApprovers&companyName=CÔNG TY TNHH TƯ VẤN TLC')
  .then(r => r.json())
  .then(data => console.log(data));
```

This will help verify if:
- The action is recognized (if yes, backend is deployed)
- The company name works
- The sheet data is accessible
