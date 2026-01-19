# 🎯 How to Handle "Partially Approved" Status - User-Friendly Solution

## ❌ Problem

Users see **"Partially Approved"** status and don't understand:
- What does it mean?
- Is the voucher approved or not?
- What happens next?
- How many approvers are done?

## ✅ Solution: Never Show "Partially Approved" to Users

**Principle:** Replace technical status with **clear, descriptive Vietnamese text** showing progress.

---

## 📊 Status Display Strategy

### Internal Status (Backend) vs Display Status (Frontend)

**Backend stores:**
```json
{
  "overallStatus": "Partially Approved",
  "approvalProgress": "2/3"
}
```

**Frontend displays:**
```html
<div class="status-badge status-partial">
  Đang duyệt (2/3 người đã duyệt)
</div>
```

---

## 🔄 Status Mapping

### Status Translation Function

```javascript
function getDisplayStatus(status, approvalCount, approvers) {
  // Never show "Partially Approved" to users
  const statusMap = {
    'Pending Approval': 'Chờ duyệt',
    'Partially Approved': `Đang duyệt (${approvalCount}/3 người đã duyệt)`,
    'Approved': 'Đã duyệt',
    'Rejected': 'Đã từ chối'
  };
  
  // Special handling for partial approval
  if (status === 'Partially Approved') {
    return `Đang duyệt (${approvalCount}/3 người đã duyệt)`;
  }
  
  return statusMap[status] || status;
}
```

---

## 🎨 UI Components

### 1. Status Badge Component

**HTML:**
```html
<div class="approval-status">
  <span class="status-badge status-partial">
    <i class="fas fa-clock"></i>
    Đang duyệt (2/3)
  </span>
</div>
```

**CSS:**
```css
.status-badge.status-partial {
  background: #dbeafe;
  color: #1e40af;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-weight: 500;
}
```

---

### 2. Detailed Progress Display

**Component:**
```html
<div class="approval-progress-card">
  <div class="progress-header">
    <h4>Trạng thái phê duyệt</h4>
    <span class="status-badge">Đang duyệt (2/3 người đã duyệt)</span>
  </div>
  
  <div class="progress-bar">
    <div class="progress-fill" style="width: 67%"></div>
    <span class="progress-text">2/3</span>
  </div>
  
  <div class="approvers-list">
    <div class="approver-item approved">
      <i class="fas fa-check-circle"></i>
      <div>
        <strong>Đại diện pháp luật: Nguyễn Văn A</strong>
        <small>Đã duyệt lúc: 13/01/2024 10:30</small>
      </div>
    </div>
    
    <div class="approver-item approved">
      <i class="fas fa-check-circle"></i>
      <div>
        <strong>Kế toán trưởng: Trần Thị B</strong>
        <small>Đã duyệt lúc: 13/01/2024 11:15</small>
      </div>
    </div>
    
    <div class="approver-item pending">
      <i class="fas fa-clock"></i>
      <div>
        <strong>Thủ quỹ: Lê Văn C</strong>
        <small>Đang chờ phê duyệt...</small>
      </div>
    </div>
  </div>
</div>
```

---

## 📧 Email Notifications

### Progress Email Template

**Subject:**
```
[TIẾN ĐỘ PHÊ DUYỆT] Phiếu TL-2024-001234 - Đã có 2/3 người duyệt
```

**Body:**
```html
<p>Kính gửi Anh/Chị,</p>

<p>Phiếu <strong>TL-2024-001234</strong> của Anh/Chị đang được xử lý:</p>

<h3>📊 Tiến độ phê duyệt: 2/3 người đã duyệt</h3>

<ul>
  <li>✅ <strong>Đại diện pháp luật:</strong> Nguyễn Văn A<br>
      Đã duyệt lúc: 13/01/2024 10:30</li>
  
  <li>✅ <strong>Kế toán trưởng:</strong> Trần Thị B<br>
      Đã duyệt lúc: 13/01/2024 11:15</li>
  
  <li>⏳ <strong>Thủ quỹ:</strong> Lê Văn C<br>
      Đang chờ phê duyệt...</li>
</ul>

<hr>
<p><em>Phiếu sẽ được hoàn tất khi tất cả 3 người phê duyệt.</em></p>
```

---

## 🔧 Implementation Examples

### Example 1: Voucher List Display

**Before (Bad):**
```html
<span class="status">Partially Approved</span>
```

**After (Good):**
```html
<span class="status">Đang duyệt (2/3)</span>
```

---

### Example 2: Voucher Detail Modal

**Display:**
```javascript
function renderVoucherStatus(voucher) {
  const meta = JSON.parse(voucher.meta || '{}');
  const approvalCount = countApprovals(meta.approvers || {});
  
  let statusDisplay = '';
  if (meta.displayStatus) {
    statusDisplay = meta.displayStatus;
  } else if (approvalCount === 0) {
    statusDisplay = 'Chờ duyệt';
  } else if (approvalCount === 3) {
    statusDisplay = 'Đã duyệt';
  } else {
    statusDisplay = `Đang duyệt (${approvalCount}/3 người đã duyệt)`;
  }
  
  return `
    <div class="voucher-status">
      <span class="status-badge">${statusDisplay}</span>
      ${approvalCount < 3 ? `
        <div class="progress-info">
          <p>Còn ${3 - approvalCount} người phê duyệt cần duyệt</p>
        </div>
      ` : ''}
    </div>
  `;
}
```

---

### Example 3: Backend Status Update

```javascript
// In handleApproveVoucher()
const approvalCount = countApprovals(meta.approvers);

if (approvalCount === 3) {
  meta.overallStatus = 'Approved';
  meta.displayStatus = 'Đã duyệt';
} else {
  meta.overallStatus = 'Partially Approved'; // Internal only
  meta.displayStatus = `Đang duyệt (${approvalCount}/3 người đã duyệt)`;
}

// Always use displayStatus in response messages
return createResponse(true, 
  `Đã phê duyệt thành công. ${meta.displayStatus}`
);
```

---

## 📋 Status Options Comparison

### ❌ Bad Status Messages
- "Partially Approved" ❌ (unclear)
- "In Progress" ❌ (too vague)
- "2/3" ❌ (missing context)

### ✅ Good Status Messages
- "Đang duyệt (2/3 người đã duyệt)" ✅ (clear and specific)
- "Chờ duyệt" ✅ (simple and clear)
- "Đã duyệt" ✅ (clear final state)
- "Đã từ chối" ✅ (clear rejection)

---

## 🎯 Key Rules

1. **Never show "Partially Approved"** - Always translate to Vietnamese
2. **Always show count** - "2/3" tells users exactly where they are
3. **Show who's done** - List approved approvers
4. **Show who's pending** - List pending approvers
5. **Use progress bars** - Visual representation helps
6. **Explain next steps** - "Còn 1 người phê duyệt cần duyệt"

---

## 📱 Mobile-Friendly Display

**Compact View:**
```
┌─────────────────────────┐
│ Đang duyệt (2/3)        │
│ ████████░░  67%         │
│                         │
│ ✅ 2 người đã duyệt     │
│ ⏳ 1 người đang chờ     │
└─────────────────────────┘
```

**Expanded View (on click):**
```
┌─────────────────────────┐
│ Đang duyệt (2/3)        │
├─────────────────────────┤
│ ✅ Nguyễn Văn A         │
│ ✅ Trần Thị B           │
│ ⏳ Lê Văn C             │
└─────────────────────────┘
```

---

## ✅ Checklist

When implementing status display:

- [ ] Replace "Partially Approved" with Vietnamese text
- [ ] Show count: "2/3 người đã duyệt"
- [ ] Display progress bar
- [ ] List who approved
- [ ] List who's pending
- [ ] Show timestamps
- [ ] Explain what happens next
- [ ] Update emails with same format
- [ ] Update all UI components consistently

---

**Summary:** Users should **never** see "Partially Approved". Always show clear Vietnamese text with progress count and details.
