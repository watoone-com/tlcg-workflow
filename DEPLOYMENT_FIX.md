# Fix Deployment Configuration - Execute as Me

## ✅ Diagnostic Status
All diagnostic tests passed! The script is authorized and working correctly.

## 🔍 Problem
The web app deployment is likely configured to run as **"User accessing the web app"** instead of **"Me"**. This causes the `openById` error because the web app doesn't have the same permissions as your account.

## ✅ Solution: Re-deploy with Correct Settings

### Step 1: Open Deployment Settings

1. Go to https://script.google.com
2. Open your project
3. Click **Deploy** → **Manage deployments**
4. You'll see your active deployment(s)

### Step 2: Edit Deployment

1. Click the **pencil icon (✏️)** or **⚙️ (Settings)** icon next to the active deployment
2. A dialog will open with deployment settings

### Step 3: Configure Settings (CRITICAL)

**Execute as:** 
- ❌ **NOT** "User accessing the web app"
- ✅ **MUST BE** "Me (your-email@gmail.com)" ← **This is the fix!**

**Who has access:**
- ✅ Should be "Anyone" (for public access)
- OR "Anyone with Google account" (if you want to restrict)

### Step 4: Deploy

1. Click **Deploy** (or **Update** if editing existing deployment)
2. If prompted "Do you want to update the deployment?", click **Update**
3. **Copy the Web App URL** (it might change, or might stay the same)

### Step 5: Verify URL (if changed)

1. Check if the URL matches the one in `api/voucher.js` line 64-65:
   ```javascript
   const TLCGROUP_BACKEND = process.env.TLCGROUP_BACKEND_URL ||
     'https://script.google.com/macros/s/YOUR_URL_HERE/exec';
   ```

2. If the URL changed, update `api/voucher.js` with the new URL

### Step 6: Test Login

1. Try logging in from your application
2. The error should be resolved!

## Why This Fixes It

- **When you run functions directly**: They execute as "Me" (your account) → ✅ Has permissions
- **When web app runs as "User accessing the web app"**: It tries to use the visitor's permissions → ❌ Visitor doesn't have spreadsheet access
- **When web app runs as "Me"**: It uses your account's permissions → ✅ Has permissions (same as direct execution)

## Verification Checklist

After re-deploying:

- [ ] Deployment shows "Execute as: Me (your-email@gmail.com)"
- [ ] Deployment shows "Who has access: Anyone" (or appropriate setting)
- [ ] Web App URL is copied (and updated in code if changed)
- [ ] Login test is successful
- [ ] No more "openById" errors

## Common Issues

### Issue: "Execute as" dropdown doesn't show "Me"
**Solution**: Make sure you're the owner of the script project, or have edit access

### Issue: URL changed but login still fails
**Solution**: 
1. Verify the new URL is updated in `api/voucher.js`
2. Clear browser cache
3. Check browser console for errors
4. Verify the deployment settings are saved correctly

### Issue: Still getting errors after re-deployment
**Solution**:
1. Double-check "Execute as" is set to "Me"
2. Wait a few minutes for deployment to propagate
3. Check Google Apps Script execution logs (View → Logs) for the web app execution
4. Verify the spreadsheet is shared with your account

## Next Steps

After fixing the deployment:
1. ✅ Test login - should work now!
2. ✅ Monitor for any other errors
3. ✅ Remove debug instrumentation if everything works (optional)
