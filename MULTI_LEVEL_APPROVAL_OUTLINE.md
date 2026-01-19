# 📋 Multi-Level Approval System Outline - 3 Approvers Required

## 🎯 Objective

Implement a **sequential multi-level approval workflow** where a voucher request must be **approved by ALL 3 approvers in order** before being fully approved:

**Approval Sequence (Sequential/Waterfall):**
1. **Step 1:** Chief Accountant (Kế toán trưởng) - **First approver**
2. **Step 2:** Legal Representative (Đại diện pháp luật) - **After Chief Accountant approves**
3. **Step 3:** Treasurer (Thủ quỹ) - **After Legal Representative approves** (Final approval)

**Key Difference:** 
- ❌ **NOT** parallel (all 3 get emails at once)
- ✅ **Sequential** (one approver at a time, in order)

---

## 📊 Current vs. Desired State

### Current State ❌
- Sends approval emails to 3 approvers **at the same time** (parallel)
- **First approval** sets status to "Approved"
- No tracking of individual approver status
- Any one approver can approve/reject independently

### Desired State ✅
- **Sequential approval workflow** - One approver at a time, in order
- **Step 1:** Send email to Chief Accountant first
- **Step 2:** After Chief Accountant approves → Send email to Legal Representative
- **Step 3:** After Legal Representative approves → Send email to Treasurer (final)
- Voucher status = "Approved" **only when Treasurer (3rd) approves**
- If **any approver rejects** → Status = "Rejected" (immediate, stops workflow)
- Progress tracking: "Đang duyệt (1/3)", "Đang duyệt (2/3)", "Đã duyệt"
- Each approver must upload their signature individually

---

## 🏗️ Architecture Overview

### 1. Data Structure Changes

#### 1.1 Meta Field Structure (in Voucher_History sheet)

**Current Meta Field:**
```json
{
  "approverSignature": "...",
  "approvedAt": "...",
  "approvedBy": "..."
}
```

**New Meta Field:**
```json
{
  "approvers": {
    "legalRep": {
      "email": "legal@company.com",
      "name": "Nguyễn Văn A",
      "status": "pending" | "approved" | "rejected",
      "signature": "...",
      "approvedAt": "...",
      "rejectedAt": "...",
      "rejectReason": "..."
    },
    "accountant": {
      "email": "accountant@company.com",
      "name": "Trần Thị B",
      "status": "pending" | "approved" | "rejected",
      "signature": "...",
      "approvedAt": "...",
      "rejectedAt": "...",
      "rejectReason": "..."
    },
    "treasurer": {
      "email": "treasurer@company.com",
      "name": "Lê Văn C",
      "status": "pending" | "approved" | "rejected",
      "signature": "...",
      "approvedAt": "...",
      "rejectedAt": "...",
      "rejectReason": "..."
    }
  },
  "overallStatus": "Pending Approval" | "Partially Approved" | "Approved" | "Rejected",
  "approvalProgress": "0/3" | "1/3" | "2/3" | "3/3",
  "displayStatus": "Chờ duyệt" | "Đang duyệt (1/3)" | "Đang duyệt (2/3)" | "Đã duyệt" | "Đã từ chối",
  "fullyApprovedAt": "...",
  "rejectedAt": "...",
  "rejectedBy": "..."
}
```

#### 1.2 Voucher Status Values

**New Status System (User-Friendly):**

**Internal Status (stored in backend):**
- `Pending Approval` - Initial state, waiting for all approvers
- `Partially Approved` - 1 or 2 approvers approved, waiting for remaining
- `Approved` - All 3 approvers have approved
- `Rejected` - Any approver rejected

**Display Status (shown to users - Vietnamese):**
- `Chờ duyệt` (Pending) - Waiting for all 3 approvers
- `Đang duyệt (1/3)` - 1 approver approved, waiting for 2 more
- `Đang duyệt (2/3)` - 2 approvers approved, waiting for 1 more
- `Đã duyệt` (Approved) - All 3 approvers have approved
- `Đã từ chối` (Rejected) - Any approver rejected

**Better Alternative - Descriptive Status:**
Instead of showing generic "Partially Approved", show:
- **Status:** "Đang duyệt - Đã có 2/3 người duyệt"
- **Progress:** Visual progress bar + list of who approved/pending
- **Details:** "✅ Nguyễn Văn A đã duyệt | ✅ Trần Thị B đã duyệt | ⏳ Đang chờ Lê Văn C"

---

## 🔧 Implementation Components

### 2. Backend Changes (`VOUCHER_WORKFLOW_BACKEND.gs`)

#### 2.1 New Function: `initializeApproversMeta()`

**Purpose:** Initialize approver tracking structure when voucher is created

**Location:** Called from `handleSendEmail()` when voucher is first submitted

**Logic:**
```javascript
function initializeApproversMeta(companyApprovers) {
  return {
    approvers: {
      legalRep: {
        email: companyApprovers.legalRep.email,
        name: companyApprovers.legalRep.name,
        status: "pending",
        signature: "",
        approvedAt: null,
        rejectedAt: null,
        rejectReason: ""
      },
      accountant: {
        email: companyApprovers.accountant.email,
        name: companyApprovers.accountant.name,
        status: "pending",
        signature: "",
        approvedAt: null,
        rejectedAt: null,
        rejectReason: ""
      },
      treasurer: {
        email: companyApprovers.treasurer.email,
        name: companyApprovers.treasurer.name,
        status: "pending",
        signature: "",
        approvedAt: null,
        rejectedAt: null,
        rejectReason: ""
      }
    },
    overallStatus: "Pending Approval",
    approvalProgress: "0/3",
    fullyApprovedAt: null,
    rejectedAt: null,
    rejectedBy: null
  };
}
```

#### 2.2 Modified Function: `handleApproveVoucher()`

**Changes:**
1. Identify which approver is approving (by email)
2. Update that approver's status to "approved"
3. Store approver's signature
4. Check if all 3 have approved
5. If all approved → Set overall status to "Approved"
6. If not all approved → Set status to "Partially Approved" and update progress

**New Logic:**
```javascript
function handleApproveVoucher(requestBody) {
  // 1. Get voucher and approver info
  const v = requestBody.voucher || {};
  const voucherNumber = v.voucherNumber || '';
  const approverEmail = v.approverEmail || '';
  
  // 2. Load existing voucher data from history
  const existingVoucher = getVoucherFromHistory(voucherNumber);
  const meta = JSON.parse(existingVoucher.meta || '{}');
  
  // 3. Identify which approver (legalRep, accountant, or treasurer)
  let approverRole = null;
  if (meta.approvers.legalRep.email === approverEmail) {
    approverRole = 'legalRep';
  } else if (meta.approvers.accountant.email === approverEmail) {
    approverRole = 'accountant';
  } else if (meta.approvers.treasurer.email === approverEmail) {
    approverRole = 'treasurer';
  }
  
  // 4. Check if this approver already approved
  if (meta.approvers[approverRole].status === 'approved') {
    return createResponse(false, 'Bạn đã phê duyệt phiếu này rồi.');
  }
  
  // 5. Check if voucher was already rejected
  if (meta.overallStatus === 'Rejected') {
    return createResponse(false, 'Phiếu này đã bị từ chối. Không thể phê duyệt.');
  }
  
  // 6. Check if signature provided
  if (!v.approverSignature) {
    return createResponse(false, 'Vui lòng tải lên chữ ký trước khi phê duyệt');
  }
  
  // 7. Update this approver's status
  meta.approvers[approverRole].status = 'approved';
  meta.approvers[approverRole].signature = v.approverSignature;
  meta.approvers[approverRole].approvedAt = new Date().toISOString();
  
  // 8. Count approvals
  const approvalCount = countApprovals(meta.approvers);
  meta.approvalProgress = `${approvalCount}/3`;
  
  // 9. Check if all approved
  if (approvalCount === 3) {
    meta.overallStatus = 'Approved';
    meta.fullyApprovedAt = new Date().toISOString();
    
    // Append final approval entry
    appendHistory_({
      voucherNumber: voucherNumber,
      status: 'Approved',
      action: 'Fully Approved',
      note: 'Tất cả 3 người phê duyệt đã duyệt\nMeta: ' + JSON.stringify(meta)
    });
    
    // Send final approval email to requester
    sendFinalApprovalEmail(v);
    
  } else {
    meta.overallStatus = 'Partially Approved';
    
    // Append partial approval entry
    appendHistory_({
      voucherNumber: voucherNumber,
      status: 'Partially Approved',
      action: 'Approved by ' + meta.approvers[approverRole].name,
      note: `Đã duyệt bởi ${approverRole} (${approvalCount}/3)\nMeta: ` + JSON.stringify(meta)
    });
    
    // Send progress email to requester
    sendProgressEmail(v, approvalCount);
  }
  
  return createResponse(true, `Đã phê duyệt thành công (${approvalCount}/3)`);
}
```

#### 2.3 Modified Function: `handleRejectVoucher()`

**Changes:**
1. Identify which approver is rejecting
2. Update that approver's status to "rejected"
3. Set overall status to "Rejected" immediately
4. Store rejection reason

**New Logic:**
```javascript
function handleRejectVoucher(requestBody) {
  // 1. Get voucher and approver info
  const v = requestBody.voucher || {};
  const voucherNumber = v.voucherNumber || '';
  const approverEmail = v.approverEmail || '';
  const rejectReason = v.rejectReason || '';
  
  // 2. Load existing voucher data
  const existingVoucher = getVoucherFromHistory(voucherNumber);
  const meta = JSON.parse(existingVoucher.meta || '{}');
  
  // 3. Identify which approver
  let approverRole = null;
  if (meta.approvers.legalRep.email === approverEmail) {
    approverRole = 'legalRep';
  } else if (meta.approvers.accountant.email === approverEmail) {
    approverRole = 'accountant';
  } else if (meta.approvers.treasurer.email === approverEmail) {
    approverRole = 'treasurer';
  }
  
  // 4. Check if already rejected
  if (meta.overallStatus === 'Rejected') {
    return createResponse(false, 'Phiếu này đã bị từ chối trước đó.');
  }
  
  // 5. Update approver status to rejected
  meta.approvers[approverRole].status = 'rejected';
  meta.approvers[approverRole].rejectedAt = new Date().toISOString();
  meta.approvers[approverRole].rejectReason = rejectReason;
  
  // 6. Set overall status to Rejected
  meta.overallStatus = 'Rejected';
  meta.rejectedAt = new Date().toISOString();
  meta.rejectedBy = approverEmail;
  
  // 7. Append rejection entry
  appendHistory_({
    voucherNumber: voucherNumber,
    status: 'Rejected',
    action: 'Rejected by ' + meta.approvers[approverRole].name,
    note: `Từ chối bởi ${approverRole}\nLý do: ${rejectReason}\nMeta: ` + JSON.stringify(meta)
  });
  
  // 8. Send rejection email to requester
  sendRejectionEmail(v, meta.approvers[approverRole].name, rejectReason);
  
  return createResponse(true, 'Đã từ chối phiếu thành công');
}
```

#### 2.4 New Helper Function: `getVoucherFromHistory()`

**Purpose:** Retrieve latest voucher entry and parse meta field

```javascript
function getVoucherFromHistory(voucherNumber) {
  const sheet = SpreadsheetApp.openById(VOUCHER_HISTORY_SHEET_ID)
    .getSheetByName(VH_SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  
  // Find latest entry for this voucher
  for (let i = data.length - 1; i >= 1; i--) {
    if (data[i][0] === voucherNumber) {
      const note = data[i][7] || ''; // Column H = Note
      const metaMatch = note.match(/Meta: (.+)/);
      if (metaMatch) {
        return {
          row: i + 1,
          meta: metaMatch[1]
        };
      }
    }
  }
  return null;
}
```

#### 2.5 New Helper Function: `countApprovals()`

**Purpose:** Count how many approvers have approved

```javascript
function countApprovals(approvers) {
  let count = 0;
  if (approvers.legalRep.status === 'approved') count++;
  if (approvers.accountant.status === 'approved') count++;
  if (approvers.treasurer.status === 'approved') count++;
  return count;
}
```

#### 2.6 Modified Function: `handleSendEmail()`

**Changes:**
1. Initialize approvers meta when creating voucher
2. Store meta in first history entry
3. **Send email ONLY to first approver (Chief Accountant)** - Not all 3
4. Set `currentApprover = "accountant"` in meta
5. Include approver role in approval/rejection links

**New Logic:**
```javascript
function handleSendEmail(requestBody) {
  // ... existing code ...
  
  // Initialize approvers meta
  const meta = initializeApproversMeta(companyApprovers);
  meta.currentApprover = 'accountant'; // First approver
  
  // Send email ONLY to Chief Accountant (first in sequence)
  const firstApprover = companyApprovers.accountant;
  sendApprovalEmailToApprover(voucher, firstApprover, 'accountant', meta);
  
  // Store meta in history
  appendHistory_({
    // ... voucher data ...
    note: 'Gửi phê duyệt\nMeta: ' + JSON.stringify(meta)
  });
}
```

#### 2.7 New Function: `sendApprovalEmailToNextApprover()`

**Purpose:** Send approval email to next approver in sequence

**Logic:**
```javascript
function sendApprovalEmailToNextApprover(voucher, nextApprover, approverRole, meta) {
  const baseUrl = 'https://workflow.egg-ventures.com';
  const approveUrl = `${baseUrl}/approve_voucher.html?` +
    `voucherNumber=${voucher.voucherNumber}&` +
    `approverEmail=${nextApprover.email}&` +
    `approverRole=${approverRole}`;
  
  const rejectUrl = `${baseUrl}/reject_voucher.html?` +
    `voucherNumber=${voucher.voucherNumber}&` +
    `approverEmail=${nextApprover.email}&` +
    `approverRole=${approverRole}`;
  
  const emailSubject = `[PHÊ DUYỆT] Phiếu ${voucher.voucherNumber} - ${getApproverRoleName(approverRole)}`;
  const emailBody = `
    <p>Kính gửi ${nextApprover.name},</p>
    <p>Phiếu <strong>${voucher.voucherNumber}</strong> đã được phê duyệt bởi người phê duyệt trước đó.</p>
    <p>Vui lòng xem xét và phê duyệt phiếu này.</p>
    <!-- Voucher details -->
    <p>
      <a href="${approveUrl}">Phê duyệt</a>
      <a href="${rejectUrl}">Từ chối</a>
    </p>
  `;
  
  GmailApp.sendEmail(nextApprover.email, emailSubject, '', { htmlBody: emailBody });
}
```

---

### 3. Frontend Changes (`phieu_thu_chi.html`)

#### 3.1 Modified Function: `sendForApproval()`

**Changes:**
1. Include `companyApprovers` in voucher payload
2. Initialize approvers meta structure

#### 3.2 New Function: `renderApprovalProgress()`

**Purpose:** Display approval progress (e.g., "2/3 approved")

**Display:**
```
┌─────────────────────────────────┐
│ Approval Progress: 2/3          │
├─────────────────────────────────┤
│ ✅ Legal Rep: Approved          │
│ ✅ Accountant: Approved         │
│ ⏳ Treasurer: Pending           │
└─────────────────────────────────┘
```

#### 3.3 Modified Function: `updateReviewSection()`

**Changes:**
1. Show approval progress instead of single approver
2. Display status of each approver

#### 3.4 Modified Function: `renderVoucherDetail()`

**Changes:**
1. Show approval progress in voucher modal with clear Vietnamese text
2. Display individual approver statuses (who approved, who's pending)
3. Show who approved/rejected and when
4. Replace generic status with descriptive progress (e.g., "Đang duyệt (2/3)")

**Status Display in Modal:**
```javascript
// Instead of: status = "Partially Approved"
// Show: status = "Đang duyệt (2/3 người đã duyệt)"

function getStatusDisplay(voucher) {
  const meta = JSON.parse(voucher.meta || '{}');
  
  if (meta.displayStatus) {
    return meta.displayStatus; // "Đang duyệt (2/3)"
  }
  
  // Fallback for old vouchers
  const approvalCount = countApprovals(meta.approvers || {});
  if (approvalCount === 0) return 'Chờ duyệt';
  if (approvalCount === 3) return 'Đã duyệt';
  return `Đang duyệt (${approvalCount}/3)`;
}
```

#### 3.5 Modified Function: `printVoucher()`

**Changes:**
1. Display all 3 approver signatures (if approved)
2. Show approval progress
3. Only show "Fully Approved" when all 3 have approved

---

### 4. Status Tracking & Review System

#### 4.1 Status Review for All Users

**Purpose:** Allow all users (requester, approvers) to check voucher approval status at any time

**Who Can Review:**
- ✅ **Requester** - The person who submitted the voucher
- ✅ **Current Approver** - The approver whose turn it is
- ✅ **All Approvers** - Can check status even if not their turn yet
- ✅ **Already Approved** - Can review their approval and progress

**Review Methods:**
1. **Email Links** - Status check link in all emails
2. **Website Dashboard** - View status in voucher list/detail
3. **Direct Status API** - Backend function to get current status

#### 4.2 New Backend Function: `getApprovalStatus()`

**Purpose:** Return current approval status for a voucher

**Action:** `getApprovalStatus`

**Request:**
```javascript
{
  action: 'getApprovalStatus',
  voucherNumber: 'TL-2024-001234'
}
```

**Response:**
```javascript
{
  success: true,
  data: {
    voucherNumber: 'TL-2024-001234',
    overallStatus: 'Partially Approved',
    displayStatus: 'Đang duyệt (1/3)',
    approvalProgress: '1/3',
    currentApprover: 'legalRep',
    currentApproverName: 'Nguyễn Văn A',
    approvers: {
      accountant: {
        name: 'Trần Thị B',
        email: 'accountant@company.com',
        status: 'approved',
        approvedAt: '2024-01-13T10:30:00Z',
        signature: '...'
      },
      legalRep: {
        name: 'Nguyễn Văn A',
        email: 'legal@company.com',
        status: 'pending',
        approvedAt: null,
        signature: null
      },
      treasurer: {
        name: 'Lê Văn C',
        email: 'treasurer@company.com',
        status: 'pending',
        approvedAt: null,
        signature: null
      }
    },
    requesterEmail: 'requester@company.com',
    submittedAt: '2024-01-13T09:00:00Z',
    lastUpdatedAt: '2024-01-13T10:30:00Z'
  }
}
```

**Implementation:**
```javascript
function handleGetApprovalStatus(requestBody) {
  try {
    const voucherNumber = requestBody.voucherNumber || '';
    
    if (!voucherNumber) {
      return createResponse(false, 'Thiếu số phiếu');
    }
    
    // Get voucher from history
    const voucherData = getVoucherFromHistory(voucherNumber);
    if (!voucherData) {
      return createResponse(false, 'Không tìm thấy phiếu');
    }
    
    const meta = JSON.parse(voucherData.meta || '{}');
    
    // Build status response
    const statusData = {
      voucherNumber: voucherNumber,
      overallStatus: meta.overallStatus || 'Pending Approval',
      displayStatus: meta.displayStatus || 'Chờ duyệt',
      approvalProgress: meta.approvalProgress || '0/3',
      currentApprover: meta.currentApprover || null,
      currentApproverName: meta.currentApprover 
        ? meta.approvers[meta.currentApprover].name 
        : null,
      approvers: meta.approvers || {},
      requesterEmail: voucherData.requestorEmail || '',
      submittedAt: voucherData.timestamp || '',
      lastUpdatedAt: new Date().toISOString()
    };
    
    return createResponse(true, 'Thành công', statusData);
  } catch (error) {
    return createResponse(false, 'Lỗi: ' + error.message);
  }
}
```

#### 4.3 Status Review Link in Emails

**Add to ALL approval/rejection emails:**

**Format:**
```html
<p>
  <a href="[BASE_URL]/phieu_thu_chi.html?viewStatus=[VOUCHER_NUMBER]" 
     style="background: #4285f4; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
    🔍 Xem trạng thái phê duyệt
  </a>
</p>
```

**Email Examples:**

**1. Initial Submission Email to Requester:**
```html
<p>Phiếu <strong>TL-2024-001234</strong> đã được gửi phê duyệt.</p>
<p>Đã gửi email đến <strong>Kế toán trưởng</strong> để bắt đầu phê duyệt.</p>
<p>
  <a href="https://workflow.egg-ventures.com/phieu_thu_chi.html?viewStatus=TL-2024-001234">
    🔍 Xem trạng thái phê duyệt
  </a>
</p>
```

**2. Approval Email to Approver:**
```html
<p>Phiếu <strong>TL-2024-001234</strong> cần được phê duyệt.</p>
<p>
  <a href="[APPROVE_LINK]">Phê duyệt</a>
  <a href="[REJECT_LINK]">Từ chối</a>
</p>
<p>
  <a href="https://workflow.egg-ventures.com/phieu_thu_chi.html?viewStatus=TL-2024-001234">
    🔍 Xem trạng thái chi tiết
  </a>
</p>
```

**3. Progress Update Email:**
```html
<p>Phiếu <strong>TL-2024-001234</strong> đang ở bước 2/3.</p>
<p>
  <a href="https://workflow.egg-ventures.com/phieu_thu_chi.html?viewStatus=TL-2024-001234">
    🔍 Xem chi tiết tiến độ phê duyệt
  </a>
</p>
```

#### 4.4 Frontend Status Review Page

**URL Format:**
```
phieu_thu_chi.html?viewStatus=TL-2024-001234
```

**Functionality:**
1. Auto-load voucher status on page load
2. Display detailed approval progress
3. Show who approved and when
4. Show who is currently pending
5. Show approval order/sequence
6. Auto-refresh status (optional)

**Implementation in `phieu_thu_chi.html`:**
```javascript
// Check if URL has viewStatus parameter
const urlParams = new URLSearchParams(window.location.search);
const viewStatusVoucher = urlParams.get('viewStatus');

if (viewStatusVoucher) {
  // Load and display status
  loadApprovalStatus(viewStatusVoucher);
}

async function loadApprovalStatus(voucherNumber) {
  try {
    const response = await fetch('/api/voucher', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        action: 'getApprovalStatus',
        voucherNumber: voucherNumber
      })
    });
    
    const result = await response.json();
    
    if (result.success && result.data) {
      displayApprovalStatus(result.data);
    } else {
      showToast('Không thể tải trạng thái: ' + result.message, 'error');
    }
  } catch (error) {
    showToast('Lỗi khi tải trạng thái: ' + error.message, 'error');
  }
}

function displayApprovalStatus(statusData) {
  // Show status modal or update status section
  const statusHtml = `
    <div class="approval-status-review">
      <h3>Trạng thái phê duyệt - ${statusData.voucherNumber}</h3>
      
      <div class="status-summary">
        <div class="status-badge">${statusData.displayStatus}</div>
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${(parseInt(statusData.approvalProgress.split('/')[0]) / 3) * 100}%"></div>
        </div>
        <p>Tiến độ: ${statusData.approvalProgress}</p>
      </div>
      
      <div class="approvers-status-list">
        ${renderApproverStatusList(statusData.approvers, statusData.currentApprover)}
      </div>
      
      ${statusData.currentApprover ? `
        <div class="current-approver-notice">
          <p>⏳ Đang chờ: <strong>${statusData.currentApproverName}</strong></p>
        </div>
      ` : ''}
    </div>
  `;
  
  // Display in modal or dedicated section
  showStatusModal(statusHtml);
}
```

#### 4.5 Status Display in Voucher List

**Update `renderVoucherItem()` to show approval progress:**

```javascript
function renderVoucherItem(voucher) {
  // ... existing code ...
  
  // Load approval status if available
  let approvalStatusBadge = '';
  if (voucher.status === 'Pending' || voucher.status === 'Partially Approved') {
    // Fetch current status
    const statusData = await getApprovalStatus(voucher.voucherNumber);
    if (statusData) {
      approvalStatusBadge = `
        <div class="approval-progress-badge">
          ${statusData.displayStatus}
          <small>(${statusData.approvalProgress})</small>
        </div>
      `;
    }
  }
  
  return `
    <!-- ... existing voucher HTML ... -->
    ${approvalStatusBadge}
  `;
}
```

#### 4.6 Status Dashboard Widget

**Add status widget to main dashboard:**

**Display:**
```
┌────────────────────────────────────────┐
│ 📊 Trạng thái phê duyệt                │
├────────────────────────────────────────┤
│ Phiếu: TL-2024-001234                 │
│ Trạng thái: Đang duyệt (1/3)          │
│                                        │
│ ✅ Kế toán trưởng: Đã duyệt           │
│ ⏳ Đại diện pháp luật: Đang chờ       │
│ ⏳ Thủ quỹ: Chưa đến lượt             │
│                                        │
│ [Xem chi tiết]                        │
└────────────────────────────────────────┘
```

---

### 5. Email Changes

#### 5.1 Approval Email Links

**Current:**
```
approve_voucher.html?voucherNumber=...&approverEmail=...
```

**New (Sequential):**
```
# Step 1: Chief Accountant
approve_voucher.html?voucherNumber=...&approverEmail=accountant@company.com&approverRole=accountant

# Step 2: Legal Representative (after accountant approves)
approve_voucher.html?voucherNumber=...&approverEmail=legal@company.com&approverRole=legalRep

# Step 3: Treasurer (after legalRep approves)
approve_voucher.html?voucherNumber=...&approverEmail=treasurer@company.com&approverRole=treasurer
```

**Note:** Each approver receives email only after previous approver has approved.

#### 4.2 Progress Notification Emails

**New Email Type:** Progress update to requester

**Content:**
```
Subject: [TIẾN ĐỘ PHÊ DUYỆT] Phiếu TL-2024-001234

Phiếu TL-2024-001234 của bạn đã được:
✅ Duyệt bởi: Nguyễn Văn A (Đại diện pháp luật)
✅ Duyệt bởi: Trần Thị B (Kế toán trưởng)
⏳ Đang chờ: Lê Văn C (Thủ quỹ)

Tiến độ: 2/3 người phê duyệt
```

#### 4.3 Final Approval Email

**Content:**
```
Subject: [ĐÃ DUYỆT HOÀN TOÀN] Phiếu TL-2024-001234

Phiếu TL-2024-001234 của bạn đã được tất cả 3 người phê duyệt:
✅ Đại diện pháp luật: Nguyễn Văn A
✅ Kế toán trưởng: Trần Thị B
✅ Thủ quỹ: Lê Văn C

Thời gian: [timestamp]
```

---

## 📋 Implementation Steps

### Phase 1: Backend Meta Structure ✅
1. ✅ Create `initializeApproversMeta()` function with approval sequence
2. ✅ Modify `handleSendEmail()` to send email ONLY to first approver (Chief Accountant)
3. ✅ Update `handleApproveVoucher()` to:
   - Validate approval order (check if current approver)
   - Track individual approvals
   - Determine next approver in sequence
   - Send email to next approver after approval
4. ✅ Update `handleRejectVoucher()` to set immediate rejection (stops workflow)
5. ✅ Create helper functions:
   - `getVoucherFromHistory()` - Retrieve voucher data
   - `countApprovals()` - Count approved approvers
   - `sendApprovalEmailToNextApprover()` - Send email to next in sequence
   - `getApproverRoleName()` - Get Vietnamese role name
6. ✅ Add progress email functions (to requester)
7. ✅ **Create `handleGetApprovalStatus()` function** - Return current status for any user
8. ✅ **Add status review link** to all emails

### Phase 2: Frontend Display ✅
1. ✅ Add approval progress display component
2. ✅ Update voucher detail modal to show progress
3. ✅ Update review section with progress
4. ✅ Update print voucher with all signatures
5. ✅ **Add status review functionality:**
   - `loadApprovalStatus()` - Load status from backend
   - `displayApprovalStatus()` - Show status details
   - `renderApprovalStatusReview()` - Render status UI
6. ✅ **Handle `?viewStatus=` URL parameter** - Auto-load status on page load
7. ✅ **Update voucher list** - Show approval progress badges
8. ✅ **Add status refresh button** - Allow manual refresh

### Phase 3: Email Updates ✅
1. ✅ Add approver role to email links
2. ✅ Create progress notification emails
3. ✅ Create final approval email template
4. ✅ Update email content to show progress
5. ✅ **Add status review link** to ALL emails:
   - Initial submission email
   - Approval request emails
   - Progress update emails
   - Final approval email
   - Rejection email
6. ✅ **Email link format:** `phieu_thu_chi.html?viewStatus=[VOUCHER_NUMBER]`

### Phase 4: Testing ✅
1. ✅ Test single approver approval
2. ✅ Test partial approval (1/3, 2/3)
3. ✅ Test full approval (3/3)
4. ✅ Test rejection (any approver)
5. ✅ Test duplicate approval prevention
6. ✅ Test email notifications

---

## 🔐 Security Considerations

### 1. Approver Identification
- **Use email address** to identify approver (cannot be spoofed if using email links)
- **Validate approver email** matches one of the 3 approvers for that company
- **Prevent duplicate approval** from same approver

### 2. Status Checks
- **Check if already rejected** before allowing approval
- **Check if already fully approved** before allowing any action
- **Prevent status changes** after final approval/rejection

### 3. Meta Field Validation
- **Validate meta structure** before parsing
- **Handle missing meta** gracefully (backward compatibility)
- **Validate approver roles** match expected structure

---

## 📊 Database/Sheet Considerations

### Voucher_History Sheet Structure

**Current Columns:**
- A: VoucherNumber
- B: VoucherType
- ...
- H: Note (contains Meta JSON)

**Note Field Format:**
```
Duyệt qua Email
Meta: {"approvers": {...}, "overallStatus": "...", ...}
```

**Considerations:**
- Meta field can be large (signatures are base64)
- May need to split into multiple rows if too large
- Or use a separate "Meta" sheet for large data

---

## 🎨 UI/UX Enhancements

### Approval Progress Indicator

**Visual:**
```
┌────────────────────────────────────────────┐
│ Progress: ████████░░░░░░░░░░  2/3         │
├────────────────────────────────────────────┤
│ ✅ Đại diện pháp luật: Nguyễn Văn A       │
│    Approved on: 2024-01-13 10:30 AM       │
│                                            │
│ ✅ Kế toán trưởng: Trần Thị B             │
│    Approved on: 2024-01-13 11:15 AM       │
│                                            │
│ ⏳ Thủ quỹ: Lê Văn C                      │
│    Status: Waiting for approval           │
└────────────────────────────────────────────┘
```

### Status Badges

- 🟡 `Pending Approval` - Yellow badge
- 🔵 `Partially Approved (1/3)` - Blue badge
- 🔵 `Partially Approved (2/3)` - Blue badge
- 🟢 `Approved` - Green badge
- 🔴 `Rejected` - Red badge

---

## 📝 Migration Notes

### Existing Vouchers

**Backward Compatibility:**
- Check if meta field exists
- If missing, treat as single-approval workflow (existing behavior)
- Gradually migrate to new structure

**Migration Strategy:**
```javascript
function migrateOldVoucher(voucherNumber) {
  // Load old voucher
  // Check if meta exists
  // If not, create meta with default values
  // Update history entry
}
```

---

## ✅ Success Criteria

1. ✅ All 3 approvers must approve before voucher is fully approved
2. ✅ Any approver rejection immediately rejects the voucher
3. ✅ Progress tracking shows current status (1/3, 2/3, 3/3)
4. ✅ Each approver can only approve once
5. ✅ Email notifications sent at each stage
6. ✅ Frontend displays approval progress
7. ✅ PDF shows all 3 signatures when fully approved

---

## 🚀 Next Steps

1. **Review this outline** with stakeholders
2. **Prioritize features** (essential vs. nice-to-have)
3. **Start with Phase 1** (backend meta structure)
4. **Test incrementally** after each phase
5. **Deploy to production** after full testing

---

**Last Updated:** 2025-01-13  
**Status:** 📋 **OUTLINE COMPLETE** - Ready for implementation
