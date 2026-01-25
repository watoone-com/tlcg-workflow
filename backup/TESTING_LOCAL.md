# 🧪 Local Testing Guide

## Prerequisites

1. **Google Apps Script Backend** - Must be deployed first
2. **Python 3 or Node.js** - For local web server
3. **Vercel CLI** (optional) - For testing API proxy locally

---

## Step 1: Deploy Backend Changes First

Before testing locally, you **must** deploy the backend changes to Google Apps Script:

### 1.1 Update Google Apps Script Code
1. Open Google Apps Script: https://script.google.com
2. Open your project: `VOUCHER_WORKFLOW_BACKEND.gs`
3. Copy the updated code from `VOUCHER_WORKFLOW_BACKEND.gs` in this repository
4. Paste it into the Apps Script editor
5. Save the project (Ctrl+S or Cmd+S)

### 1.2 Deploy as Web App
1. Click **Deploy** → **New deployment**
2. Select type: **Web app**
3. Settings:
   - **Execute as**: Me (your account)
   - **Who has access**: Anyone
4. Click **Deploy**
5. **Copy the Web App URL** (you'll need this)

### 1.3 Test Backend Function Directly

Test the new `getCompanyApprovers` function:

1. In Apps Script editor, select function `handleGetCompanyApprovers`
2. Click **Run** (or press Ctrl+R)
3. When prompted, authorize the script
4. Check logs: **View** → **Logs** or **Execution log**

Or test via URL (replace `YOUR_WEB_APP_URL`):
```
https://YOUR_WEB_APP_URL?action=getCompanyApprovers&companyName=CÔNG TY TNHH TƯ VẤN TLC
```

Expected response:
```json
{
  "success": true,
  "message": "Thành công",
  "data": {
    "companyName": "CÔNG TY TNHH TƯ VẤN TLC",
    "approvers": {
      "legalRep": {
        "name": "Lê Ngân Anh",
        "email": "anh.le@mediainsider.vn",
        "signature": "https://...",
        "role": "Đại diện pháp luật"
      },
      "accountant": {
        "name": "Nguyễn Thị Nhanh",
        "email": "nhanh.nguyen@tl-c.com.vn",
        "signature": "https://...",
        "role": "Kế toán trưởng"
      },
      "treasurer": {
        "name": "Lê Thùy Linh",
        "email": "linh.le@tl-c.com.vn",
        "signature": "https://...",
        "role": "Thủ quỹ"
      }
    }
  }
}
```

---

## Step 2: Test Frontend Locally

### Option A: Using Python Simple Server (Easiest)

1. **Start local server**:
   ```bash
   ./start-server.sh
   ```
   Or manually:
   ```bash
   cd "/Volumes/MacEx01/TLCG Workflow"
   python3 -m http.server 8000
   ```

2. **Open in browser**:
   ```
   http://localhost:8000/phieu_thu_chi.html
   ```

3. **Important**: The API calls will go through your Vercel proxy (if deployed) or directly to Google Apps Script if you modify the code.

### Option B: Using Vercel Dev (Recommended - Tests API Proxy Too)

1. **Install Vercel CLI** (if not installed):
   ```bash
   npm install -g vercel
   ```

2. **Start Vercel dev server**:
   ```bash
   cd "/Volumes/MacEx01/TLCG Workflow"
   npm run dev
   # Or: vercel dev
   ```

3. **Open in browser**:
   ```
   http://localhost:3000/phieu_thu_chi.html
   ```

   This will:
   - Serve the frontend files
   - Proxy `/api/voucher` requests to your Google Apps Script backend
   - Test the full integration locally

---

## Step 3: Testing Checklist

### ✅ Test 1: Load Company Approvers

1. Open `phieu_thu_chi.html` in browser
2. Login (if required)
3. Select a company from dropdown (e.g., "CÔNG TY TNHH TƯ VẤN TLC")
4. **Check browser console** (F12 → Console tab)
   - Should see: `✅ Company approvers loaded: {...}`
   - Should see approvers object with 3 roles

**Expected Result**: 
- Toast notification: "Đã tải thông tin người phê duyệt cho công ty..."
- No console errors

---

### ✅ Test 2: Review Section Shows Approvers

1. Fill out Step 1 (company selected)
2. Fill out Step 2 (payee, reason, signature)
3. Fill out Step 3 (expense items)
4. Fill out Step 4 (approver - this field is now less critical)
5. Go to Step 5 (Review)

**Expected Result**:
- "Người phê duyệt" field shows:
  - "Đại diện pháp luật: [Name]; Kế toán trưởng: [Name]; Thủ quỹ: [Name]"

---

### ✅ Test 3: Email Recipients (Don't Actually Send)

1. Fill out the entire form
2. Open browser DevTools → Network tab
3. Click "Gửi phê duyệt"
4. **Before it sends**, check the network request

Look for POST request to `/api/voucher`:
- In request payload, check `email.to` field
- Should contain all 3 approver emails from the selected company
- Should NOT contain the old fixed list

**Expected Result**:
- Request payload shows 3 company-specific email addresses
- Not the old fixed list: `['linh.le@tl-c.com.vn', 'anh.le@mediainsider.vn', 'nhanh.nguyen@tl-c.com.vn']`

---

### ✅ Test 4: Print/PDF Shows Correct Signatures

1. Submit a voucher (or view existing one)
2. Click "Print" or view voucher details
3. Check signatures section at bottom

**Expected Result**:
- Shows 3 signature boxes:
  - Kế toán trưởng: [Company Accountant Name]
  - Đại diện pháp luật: [Company Legal Rep Name]
  - Thủ quỹ: [Company Treasurer Name]
- Each shows correct signature image (if available)
- Names match the company from "Công ty" sheet

---

### ✅ Test 5: Backend Stores Approver Data

1. Submit a voucher
2. Check Google Apps Script logs (View → Logs)
3. Check "Voucher_History" sheet in Google Sheets

**Expected Result**:
- Voucher history entry includes approver data
- Can see company approvers stored in voucher metadata

---

## Step 4: Common Issues & Debugging

### Issue 1: "Action không hợp lệ: getCompanyApprovers"

**Cause**: Backend not deployed or code not updated

**Fix**:
1. Check Google Apps Script code has `handleGetCompanyApprovers` function
2. Check `doGet` and `doPost` include `getCompanyApprovers` action
3. Redeploy the web app

---

### Issue 2: "Company approvers not loaded"

**Cause**: Company name mismatch

**Fix**:
1. Check browser console for exact error
2. Verify company name in dropdown matches exactly with "Công ty" sheet (column B)
3. Check backend logs for which company name was searched

---

### Issue 3: "No recipients found"

**Cause**: Approver emails not found or empty

**Fix**:
1. Check "Công ty" sheet has emails in columns E, H, K
2. Verify emails are not empty
3. Check browser console for `data.selectedCompanyApprovers` object

---

### Issue 4: API calls fail with CORS error

**Cause**: Testing with `file://` protocol or wrong URL

**Fix**:
1. Always use `http://localhost:8000` or `http://localhost:3000`
2. Never open HTML file directly (file://)
3. Check `/api/voucher` URL is correct in code

---

## Step 5: Browser Console Testing

Open browser console (F12) and test manually:

```javascript
// Check if company approvers are loaded
console.log('Company approvers:', data.selectedCompanyApprovers);

// Test loading approvers manually
async function testLoadApprovers() {
    const response = await fetch('/api/voucher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            action: 'getCompanyApprovers',
            companyName: 'CÔNG TY TNHH TƯ VẤN TLC'
        })
    });
    const result = await response.json();
    console.log('Result:', result);
}
testLoadApprovers();
```

---

## Step 6: Before Pushing to GitHub

1. ✅ All tests pass locally
2. ✅ Backend deployed and working
3. ✅ No console errors
4. ✅ Check git status:
   ```bash
   git status
   ```

5. ✅ Review changes:
   ```bash
   git diff
   ```

6. ✅ Commit changes:
   ```bash
   git add .
   git commit -m "feat: Add company-specific approvers from Công ty sheet"
   ```

7. ✅ Push to GitHub:
   ```bash
   git push origin main
   # or
   git push origin master
   ```

---

## Quick Test Script

Create a test file to verify backend connection:

```html
<!-- test-backend.html -->
<!DOCTYPE html>
<html>
<head>
    <title>Test Backend</title>
</head>
<body>
    <h1>Test Company Approvers API</h1>
    <button onclick="testAPI()">Test API</button>
    <pre id="result"></pre>
    
    <script>
        async function testAPI() {
            const resultEl = document.getElementById('result');
            resultEl.textContent = 'Testing...';
            
            try {
                const response = await fetch('/api/voucher', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({
                        action: 'getCompanyApprovers',
                        companyName: 'CÔNG TY TNHH TƯ VẤN TLC'
                    })
                });
                
                const result = await response.json();
                resultEl.textContent = JSON.stringify(result, null, 2);
            } catch (error) {
                resultEl.textContent = 'Error: ' + error.message;
            }
        }
    </script>
</body>
</html>
```

Save as `test-backend.html` and open via local server: `http://localhost:8000/test-backend.html`

---

## Notes

- ⚠️ **Backend must be deployed first** - Frontend can't work without backend
- ⚠️ **API proxy needed** - Use Vercel dev or ensure `/api/voucher` is deployed
- ⚠️ **Test with real company names** - Make sure company names match exactly with "Công ty" sheet

---

*Happy Testing! 🚀*
