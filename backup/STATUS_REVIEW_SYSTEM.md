# 🔍 Status Review System - For All Users

## 🎯 Objective

Allow **all users involved in the approval workflow** (requester, approvers) to **review the approval status at any time**.

---

## 👥 Who Can Review Status

- ✅ **Requester** - Person who submitted the voucher
- ✅ **Current Approver** - Approver whose turn it is now
- ✅ **All Approvers** - Can check status even if not their turn yet
- ✅ **Already Approved** - Can review their approval and overall progress

---

## 📋 Status Review Methods

### 1. Email Links (Primary Method)

**Add status review link to ALL emails:**

```html
<p>
  <a href="https://workflow.egg-ventures.com/phieu_thu_chi.html?viewStatus=TL-2024-001234" 
     style="background: #4285f4; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 10px;">
    🔍 Xem trạng thái phê duyệt
  </a>
</p>
```

**Email Types with Status Links:**
1. ✅ Initial submission email (to requester)
2. ✅ Approval request emails (to each approver)
3. ✅ Progress update emails (to requester)
4. ✅ Final approval email (to requester)
5. ✅ Rejection email (to requester)

---

### 2. Website Dashboard

**Voucher List View:**
- Show approval progress badge on each voucher
- Click voucher to see detailed status

**Voucher Detail Modal:**
- Show full approval progress
- List all approvers with status
- Show who approved and when

---

### 3. Direct Status API

**Backend Function:** `handleGetApprovalStatus()`

**Action:** `getApprovalStatus`

**Request:**
```javascript
POST /api/voucher
{
  action: 'getApprovalStatus',
  voucherNumber: 'TL-2024-001234'
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "voucherNumber": "TL-2024-001234",
    "overallStatus": "Partially Approved",
    "displayStatus": "Đang duyệt (1/3)",
    "approvalProgress": "1/3",
    "currentApprover": "legalRep",
    "currentApproverName": "Nguyễn Văn A",
    "approvers": {
      "accountant": {
        "name": "Trần Thị B",
        "email": "accountant@company.com",
        "status": "approved",
        "approvedAt": "2024-01-13T10:30:00Z",
        "signature": "..."
      },
      "legalRep": {
        "name": "Nguyễn Văn A",
        "email": "legal@company.com",
        "status": "pending",
        "approvedAt": null,
        "signature": null
      },
      "treasurer": {
        "name": "Lê Văn C",
        "email": "treasurer@company.com",
        "status": "pending",
        "approvedAt": null,
        "signature": null
      }
    },
    "requesterEmail": "requester@company.com",
    "submittedAt": "2024-01-13T09:00:00Z",
    "lastUpdatedAt": "2024-01-13T10:30:00Z"
  }
}
```

---

## 🔧 Implementation

### Backend Function: `handleGetApprovalStatus()`

**Location:** `VOUCHER_WORKFLOW_BACKEND.gs`

```javascript
function handleGetApprovalStatus(requestBody) {
  try {
    const voucherNumber = requestBody.voucherNumber || '';
    
    if (!voucherNumber) {
      return createResponse(false, 'Thiếu số phiếu');
    }
    
    // Get latest voucher entry from history
    const sheet = SpreadsheetApp.openById(VOUCHER_HISTORY_SHEET_ID)
      .getSheetByName(VH_SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    
    // Find latest entry for this voucher
    let latestEntry = null;
    for (let i = data.length - 1; i >= 1; i--) {
      if (data[i][0] === voucherNumber) {
        latestEntry = {
          voucherNumber: data[i][0],
          voucherType: data[i][1],
          company: data[i][2],
          employee: data[i][3],
          amount: data[i][4],
          status: data[i][5],
          action: data[i][6],
          note: data[i][7],
          timestamp: data[i][8],
          requestorEmail: data[i][9],
          approverEmail: data[i][10]
        };
        break;
      }
    }
    
    if (!latestEntry) {
      return createResponse(false, 'Không tìm thấy phiếu');
    }
    
    // Parse meta from note field
    let meta = {};
    const metaMatch = latestEntry.note.match(/Meta: (.+)/);
    if (metaMatch) {
      try {
        meta = JSON.parse(metaMatch[1]);
      } catch (e) {
        Logger.log('Error parsing meta: ' + e.toString());
      }
    }
    
    // Build status response
    const statusData = {
      voucherNumber: voucherNumber,
      overallStatus: meta.overallStatus || 'Pending Approval',
      displayStatus: meta.displayStatus || 'Chờ duyệt',
      approvalProgress: meta.approvalProgress || '0/3',
      currentApprover: meta.currentApprover || null,
      currentApproverName: meta.currentApprover 
        ? (meta.approvers && meta.approvers[meta.currentApprover] 
          ? meta.approvers[meta.currentApprover].name 
          : null)
        : null,
      approvers: meta.approvers || {},
      requesterEmail: latestEntry.requestorEmail || '',
      submittedAt: latestEntry.timestamp || '',
      lastUpdatedAt: new Date().toISOString()
    };
    
    return createResponse(true, 'Thành công', statusData);
  } catch (error) {
    Logger.log('Error in handleGetApprovalStatus: ' + error.toString());
    return createResponse(false, 'Lỗi: ' + error.message);
  }
}
```

**Add to routing:**
```javascript
// In doPost()
case 'getApprovalStatus':
  return handleGetApprovalStatus(requestBody);
```

---

### Frontend: Status Review Page

**URL Format:**
```
phieu_thu_chi.html?viewStatus=TL-2024-001234
```

**Implementation in `phieu_thu_chi.html`:**

```javascript
// Check for viewStatus parameter on page load
document.addEventListener('DOMContentLoaded', function() {
  const urlParams = new URLSearchParams(window.location.search);
  const viewStatusVoucher = urlParams.get('viewStatus');
  
  if (viewStatusVoucher) {
    // Show status review modal
    loadAndDisplayApprovalStatus(viewStatusVoucher);
  }
});

async function loadAndDisplayApprovalStatus(voucherNumber) {
  try {
    showToast('Đang tải trạng thái phê duyệt...', 'info');
    
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
      displayApprovalStatusModal(result.data);
    } else {
      showToast('Không thể tải trạng thái: ' + (result.message || ''), 'error');
    }
  } catch (error) {
    console.error('Error loading approval status:', error);
    showToast('Lỗi khi tải trạng thái: ' + error.message, 'error');
  }
}

function displayApprovalStatusModal(statusData) {
  // Build status HTML
  const statusHtml = renderApprovalStatusReview(statusData);
  
  // Show in modal (reuse existing voucher modal or create new one)
  showStatusReviewModal(statusHtml, statusData.voucherNumber);
}

function renderApprovalStatusReview(statusData) {
  const approvers = statusData.approvers || {};
  const progress = statusData.approvalProgress || '0/3';
  const progressNum = parseInt(progress.split('/')[0]);
  const progressPercent = (progressNum / 3) * 100;
  
  // Build approver list HTML
  const approversList = [];
  
  // Accountant (Step 1)
  const accountant = approvers.accountant || {};
  approversList.push(renderApproverStatusItem(
    accountant,
    'Kế toán trưởng',
    1,
    statusData.currentApprover === 'accountant'
  ));
  
  // Legal Rep (Step 2)
  const legalRep = approvers.legalRep || {};
  approversList.push(renderApproverStatusItem(
    legalRep,
    'Đại diện pháp luật',
    2,
    statusData.currentApprover === 'legalRep'
  ));
  
  // Treasurer (Step 3)
  const treasurer = approvers.treasurer || {};
  approversList.push(renderApproverStatusItem(
    treasurer,
    'Thủ quỹ',
    3,
    statusData.currentApprover === 'treasurer'
  ));
  
  return `
    <div class="approval-status-review-container">
      <div class="status-header">
        <h3>📊 Trạng thái phê duyệt</h3>
        <p class="voucher-number">Phiếu: <strong>${statusData.voucherNumber}</strong></p>
      </div>
      
      <div class="status-summary">
        <div class="status-badge status-${getStatusClass(progressNum)}">
          ${statusData.displayStatus}
        </div>
        <div class="progress-bar-container">
          <div class="progress-label">Tiến độ: ${progress}</div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${progressPercent}%"></div>
          </div>
        </div>
      </div>
      
      <div class="approval-sequence">
        <h4>Thứ tự phê duyệt:</h4>
        <div class="approvers-status-list">
          ${approversList.join('')}
        </div>
      </div>
      
      ${statusData.currentApprover ? `
        <div class="current-approver-notice">
          <p>⏳ <strong>Đang chờ:</strong> ${statusData.currentApproverName} phê duyệt</p>
        </div>
      ` : ''}
      
      <div class="status-actions">
        <button onclick="refreshApprovalStatus('${statusData.voucherNumber}')" class="btn-refresh">
          🔄 Làm mới trạng thái
        </button>
        <button onclick="closeStatusModal()" class="btn-close">
          Đóng
        </button>
      </div>
    </div>
  `;
}

function renderApproverStatusItem(approver, roleName, stepNumber, isCurrent) {
  let statusIcon = '⏳';
  let statusText = 'Chờ duyệt';
  let statusClass = 'pending';
  let timestamp = '';
  
  if (approver.status === 'approved') {
    statusIcon = '✅';
    statusText = 'Đã duyệt';
    statusClass = 'approved';
    timestamp = approver.approvedAt 
      ? formatDateTime(approver.approvedAt) 
      : '';
  } else if (approver.status === 'rejected') {
    statusIcon = '❌';
    statusText = 'Đã từ chối';
    statusClass = 'rejected';
    timestamp = approver.rejectedAt 
      ? formatDateTime(approver.rejectedAt) 
      : '';
  } else if (isCurrent) {
    statusIcon = '📧';
    statusText = 'Đang chờ phê duyệt';
    statusClass = 'current';
  }
  
  return `
    <div class="approver-status-item ${statusClass} ${isCurrent ? 'current-approver' : ''}">
      <div class="step-number">Bước ${stepNumber}</div>
      <div class="approver-icon">${statusIcon}</div>
      <div class="approver-info">
        <div class="approver-role">${roleName}</div>
        <div class="approver-name">${approver.name || approver.email || 'N/A'}</div>
        ${timestamp ? `
          <div class="approver-time">${statusText} lúc: ${timestamp}</div>
        ` : `
          <div class="approver-time">${statusText}</div>
        `}
      </div>
    </div>
  `;
}
```

---

## 🎨 UI Display Example

### Status Review Modal

```
┌─────────────────────────────────────────────────┐
│ 📊 Trạng thái phê duyệt                         │
│ Phiếu: TL-2024-001234                          │
├─────────────────────────────────────────────────┤
│                                                 │
│ Status: Đang duyệt (1/3)                       │
│                                                 │
│ Tiến độ: ████░░░░░░░░  33% (1/3)              │
│                                                 │
├─────────────────────────────────────────────────┤
│ Thứ tự phê duyệt:                              │
│                                                 │
│ Bước 1  ✅  Kế toán trưởng                     │
│          Trần Thị B                            │
│          Đã duyệt lúc: 13/01/2024 10:30       │
│                                                 │
│ Bước 2  📧  Đại diện pháp luật                 │
│          Nguyễn Văn A                          │
│          Đang chờ phê duyệt...                 │
│          ⬅️ HIỆN TẠI                           │
│                                                 │
│ Bước 3  ⏳  Thủ quỹ                            │
│          Lê Văn C                              │
│          Chưa đến lượt                         │
│                                                 │
├─────────────────────────────────────────────────┤
│ ⏳ Đang chờ: Nguyễn Văn A phê duyệt            │
│                                                 │
│ [🔄 Làm mới trạng thái]  [Đóng]               │
└─────────────────────────────────────────────────┘
```

---

## ✅ Features

1. ✅ **Status visible to all users** - Requester and approvers
2. ✅ **Email links** - Easy access from any email
3. ✅ **Website integration** - Check status from dashboard
4. ✅ **Real-time updates** - Shows current progress
5. ✅ **Detailed information** - Who approved, when, who's next
6. ✅ **Manual refresh** - Update status on demand
7. ✅ **Shareable links** - Can share status URL

---

## 📧 Email Integration Examples

### Email Template with Status Link

```html
<p>Kính gửi Anh/Chị,</p>
<p>Phiếu <strong>TL-2024-001234</strong> đang được xử lý phê duyệt.</p>

<h3>📊 Tiến độ: 1/3 người đã duyệt</h3>
<ul>
  <li>✅ Kế toán trưởng: Đã duyệt</li>
  <li>⏳ Đại diện pháp luật: Đang chờ</li>
  <li>⏳ Thủ quỹ: Chưa đến lượt</li>
</ul>

<p>
  <a href="https://workflow.egg-ventures.com/phieu_thu_chi.html?viewStatus=TL-2024-001234" 
     style="background: #4285f4; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 15px;">
    🔍 Xem trạng thái chi tiết
  </a>
</p>

<p>Bạn có thể xem trạng thái cập nhật bất cứ lúc nào bằng link trên.</p>
```

---

**Last Updated:** 2025-01-13  
**Status:** ✅ **STATUS REVIEW SYSTEM DEFINED**
