# 🔄 Sequential Approval Workflow - Revised Instructions

## 🎯 Key Change: Parallel → Sequential

**Previous Plan:** All 3 approvers receive emails at the same time (parallel)  
**New Plan:** Approvers receive emails one at a time, in sequence (sequential/waterfall)

---

## 📋 Approval Sequence

### Order of Approval:

1. **Step 1: Chief Accountant (Kế toán trưởng)** 
   - Receives email **first** when voucher is submitted
   - Must approve before next step

2. **Step 2: Legal Representative (Đại diện pháp luật)**
   - Receives email **after** Chief Accountant approves
   - Must approve before next step

3. **Step 3: Treasurer (Thủ quỹ)**
   - Receives email **after** Legal Representative approves
   - Final approver - When approved, voucher is fully approved

---

## 🔄 Workflow Flow

```
┌─────────────────────────────────────────────────┐
│ 1. Requester submits voucher                    │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│ 2. Email sent to Chief Accountant ONLY         │
│    Status: "Chờ duyệt"                         │
│    Current Approver: accountant                 │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│ 3. Chief Accountant approves                    │
│    Status: "Đang duyệt (1/3)"                  │
│    → Email sent to Legal Representative         │
│    Current Approver: legalRep                  │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│ 4. Legal Representative approves               │
│    Status: "Đang duyệt (2/3)"                  │
│    → Email sent to Treasurer                    │
│    Current Approver: treasurer                 │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│ 5. Treasurer approves (FINAL)                  │
│    Status: "Đã duyệt"                          │
│    → Final approval email to requester         │
│    Current Approver: null (complete)           │
└─────────────────────────────────────────────────┘
```

---

## 🚫 Rejection Flow

If **any approver rejects** at any step:

```
┌─────────────────────────────────────────────────┐
│ Any Approver Rejects                            │
│ Status: "Đã từ chối"                            │
│ → Workflow STOPS immediately                     │
│ → Rejection email sent to requester             │
│ → No further emails sent                        │
└─────────────────────────────────────────────────┘
```

---

## 🔧 Implementation Changes

### 1. Initial Submission (`handleSendEmail()`)

**Before:**
- Send emails to all 3 approvers at once

**After:**
- Send email **ONLY to Chief Accountant** (first in sequence)
- Set `currentApprover = "accountant"` in meta

### 2. Approval Handler (`handleApproveVoucher()`)

**New Validation:**
- Check if approver is the `currentApprover` (order validation)
- If not current approver → Return error: "Vui lòng đợi [name] phê duyệt trước"

**After Approval:**
- Update approver status to "approved"
- Determine next approver in sequence
- If not final → Send email to next approver
- If final (Treasurer) → Set status to "Approved", notify requester

### 3. Meta Field Structure

**New Fields:**
```json
{
  "currentApprover": "accountant" | "legalRep" | "treasurer" | null,
  "approvalSequence": ["accountant", "legalRep", "treasurer"]
}
```

**Approver Order:**
```json
{
  "accountant": { "order": 1 },  // First
  "legalRep": { "order": 2 },    // Second
  "treasurer": { "order": 3 }    // Third (Final)
}
```

---

## 📧 Email Flow

### Email 1: Initial Submission
**To:** Chief Accountant only  
**Subject:** `[PHÊ DUYỆT] Phiếu TL-2024-001234 - Kế toán trưởng`  
**Content:** "Phiếu đã được gửi, vui lòng phê duyệt"

### Email 2: After Accountant Approves
**To:** Legal Representative  
**Subject:** `[PHÊ DUYỆT] Phiếu TL-2024-001234 - Đại diện pháp luật`  
**Content:** "Phiếu đã được Kế toán trưởng duyệt, vui lòng tiếp tục phê duyệt"

### Email 3: After Legal Rep Approves
**To:** Treasurer  
**Subject:** `[PHÊ DUYỆT] Phiếu TL-2024-001234 - Thủ quỹ`  
**Content:** "Phiếu đã được Đại diện pháp luật duyệt, vui lòng phê duyệt cuối cùng"

### Email 4: Final Approval
**To:** Requester  
**Subject:** `[ĐÃ DUYỆT HOÀN TOÀN] Phiếu TL-2024-001234`  
**Content:** "Tất cả 3 người đã duyệt theo thứ tự: Kế toán trưởng → Đại diện pháp luật → Thủ quỹ"

---

## ✅ Key Features

1. **Sequential Processing** - One approver at a time
2. **Order Validation** - Cannot skip or approve out of order
3. **Automatic Email Forwarding** - Next approver gets email automatically
4. **Progress Tracking** - Clear status: "Đang duyệt (1/3)", "Đang duyệt (2/3)"
5. **Immediate Rejection** - Any rejection stops workflow
6. **Clear Status Messages** - Users understand current state

---

## 🎯 Status Display

| Step | Status | Current Approver | Next Action |
|------|--------|------------------|-------------|
| Initial | "Chờ duyệt" | accountant | Waiting for Chief Accountant |
| After Step 1 | "Đang duyệt (1/3)" | legalRep | Waiting for Legal Rep |
| After Step 2 | "Đang duyệt (2/3)" | treasurer | Waiting for Treasurer |
| After Step 3 | "Đã duyệt" | null | Complete |

---

## 📝 Updated Success Criteria

1. ✅ **Sequential approval** - Approvers approve one at a time, in order
2. ✅ **Approval order:** Chief Accountant → Legal Representative → Treasurer
3. ✅ **Email sent sequentially** - Next approver only gets email after previous approves
4. ✅ **Order validation** - Cannot skip approvers or approve out of order
5. ✅ All 3 approvers must approve before voucher is fully approved
6. ✅ Any approver rejection immediately rejects the voucher (stops workflow)
7. ✅ Progress tracking shows current status (1/3, 2/3, 3/3)
8. ✅ Each approver can only approve once
9. ✅ Email notifications sent at each stage (to next approver + requester)
10. ✅ Frontend displays approval progress with clear Vietnamese text

---

**Last Updated:** 2025-01-13  
**Status:** ✅ **SEQUENTIAL APPROVAL WORKFLOW DEFINED**
