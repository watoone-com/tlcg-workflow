# 📋 PHIẾU THU/CHI - Flow Details

## 🎯 Overview

The **Phiếu Thu/Chi (Voucher Receipt/Payment)** workflow is a multi-step form application that allows employees to create, submit, and track payment/receipt vouchers through an approval process.

---

## 🔐 Authentication Flow

### Initial Access Check
1. **Page Load** → Checks `localStorage.getItem('tlc_current_user')`
2. **Not Logged In** → Redirects to `index.html` with alert
3. **Logged In** → Validates user data structure (requires `email` and `name`)
4. **Invalid Session** → Clears localStorage and redirects to login

### Google Drive API Initialization (Optional)
- If Drive API credentials are configured:
  - Initializes Google Identity Services (GIS) for token-based authentication
  - Enables unlimited file uploads
- If not configured:
  - Falls back to legacy upload (500KB limit per file)

---

## 📊 Data Loading Flow

### Backend Data Sources
The form loads master data from Google Apps Script backend via Vercel proxy (`/api/voucher.js`):

1. **Employees** (`loadEmployeesFromBackend()`)
   - Source: "Nhân viên" sheet
   - Columns: Name (B), Email (C), Department (D)
   - Populates: Employee dropdown, Payee dropdown, Department auto-fill
   - Creates: `employeeEmailMap` and `employee_departments` mapping

2. **Companies** (from `data` object)
   - Source: Pre-loaded in JavaScript
   - Contains: Company name, address, email contacts
   - Populates: Company dropdown, auto-fills company address

3. **Voucher Types** (from `data` object)
   - Options: "Thu" (Receipt), "Chi" (Payment)
   - Populates: Voucher type dropdown, updates form title

4. **Currencies** (from `data` object)
   - Options: VNĐ, USD, EUR, etc.
   - Populates: Currency dropdown

5. **Approvers** (from `data` object)
   - Source: Pre-loaded list in `data.approver_names`
   - Populates: Approver dropdown
   - Creates: `approverEmailMap` for email routing
   - **Approver List Includes**:
     - All employees from employee list
     - **Company Roles** (dynamically added from company data):
       - **Đại diện pháp luật** (Legal Representative)
       - **Kế toán trưởng** (Chief Accountant)
       - **Thủ quỹ** (Treasurer) - sometimes
   - **Default Approvers with Email Mapping**:
     - Lê Ngân Anh → anh.le@mediainsider.vn
     - Nguyễn Văn Chinh → chinh.nguyen@mediainsider.vn
     - Lê Thùy Linh → linh.le@tl-c.com.vn
     - Nguyễn Lực → hieuluc.nguyen@gmail.com

---

## 📝 Form Steps & Validation

### Step 1: Thông tin cơ bản (Basic Information)

#### Fields:
- **Công ty (Company)**: `required` - Dropdown selection
- **Loại phiếu (Voucher Type)**: `required` - Dropdown (Thu/Chi)
- **Số phiếu (Voucher Number)**: `readonly` - Auto-generated format: `TL-YYYYMM-####`
- **Ngày lập phiếu (Voucher Date)**: `required` - Date input (must be today or future)
- **Người đề nghị (Requester)**: `required` - Dropdown
- **Bộ phận (Department)**: `readonly` - Auto-filled from employee selection

#### Auto-behaviors:
- **Company Selection** → Displays company address below dropdown
- **Voucher Type Selection** → Updates form title: "PHIẾU THU" or "PHIẾU CHI"
- **Employee Selection** → Auto-fills department from `employee_departments` map
- **Voucher Number** → Generated on page load: `TL-YYYYMM-RRRR` (4 random digits)
- **Voucher Date** → Defaults to current date, prevents past dates

#### Validation:
```javascript
validateStep(1) → company && voucherType && employee
```

---

### Step 2: Thông tin đối tượng (Payee Information)

#### Fields:
- **Chọn người nộp/nhận (Payee Dropdown)**: Optional - Quick selection from employee list
- **Họ tên người nộp/nhận (Payee Name)**: `required` - Text input (can type or select from dropdown)
- **Lý do (Reason)**: `required` - Textarea
- **Tổng số tiền (Total Amount)**: `readonly` - Auto-calculated from Step 3
- **Chữ ký người đề nghị (Requester Signature)**: `required` - Image upload

#### Auto-behaviors:
- **Payee Dropdown** → Auto-fills "Payee Name" field when selected
- **Total Amount** → Updates automatically when expense items change (from Step 3)
- **Signature Upload**:
  - Accepts: PNG, JPG, GIF (prefers transparent background)
  - Saves to localStorage for reuse in future vouchers
  - Preview shown immediately
  - Max size: 10MB per file

#### Validation:
```javascript
validateStep(2) → payeeName && reason && signature
```

#### Signature Validation:
- Must have signature uploaded before proceeding to Step 3
- Error shown if missing when clicking "Next"

---

### Step 3: Chi tiết chi phí (Expense Details)

#### Fields:
- **Loại tiền (Currency)**: `required` - Dropdown selection
- **Expense Items Table**:
  - **STT (No.)**: Auto-increment, readonly
  - **Nội dung (Content)**: `required` - Text input
  - **Số tiền (Amount)**: `required` - Number input (auto-formats as VNĐ)
  - **Đính kèm (Attachments)**: Optional - File upload (supports multiple files)

#### Table Actions:
1. **Thêm dòng (Add Row)**: Adds new empty row to table
2. **Dán từ Excel (Paste from Excel)**: 
   - Opens modal to paste Excel data
   - Parses tab-separated values
   - Auto-populates rows (content and amount columns)
3. **Nhập file Excel (Import Excel File)**:
   - File input for `.xlsx` files
   - Uses XLSX library to parse
   - Imports first sheet, assumes columns: Content (B) and Amount (C)

#### Auto-calculations:
- **Grand Total**: Sums all item amounts, displays formatted currency
- **Amount in Words**: Converts total to Vietnamese words (e.g., "Một triệu đồng")
- **Real-time Updates**: Recalculates on every amount change

#### File Upload:
- **With Drive API**: Uploads to Google Drive, stores file URLs
- **Without Drive API**: Converts to base64 (500KB limit per file)
- **Per-item Upload**: Each expense item can have multiple attachments
- **Validation**: Max 10MB per file

#### Validation:
```javascript
validateStep(3) → currency && expenseItems.length > 0 && 
                  expenseItems.every(item => item.content && item.amount > 0)
```

---

### Step 4: Phê duyệt (Approval)

#### Fields:
- **Người phê duyệt (Approver)**: `required` - Dropdown selection
- **Trạng thái phê duyệt (Approval Status)**: Display only - Shows "Pending" initially
- **Lịch sử phê duyệt (Approval History)**: Display only - Shows submission history

#### Approval Status States:
- **Pending**: Yellow badge - Waiting for approval
- **Approved**: Green badge - Approved
- **Rejected**: Red badge - Rejected/Returned

#### Approval History:
- Shows list of approval requests sent
- Includes: Date/time, Approver, Status, Comments
- Updated after each submission

#### Validation:
```javascript
validateStep(4) → approver
```

---

### Step 5: Xem lại & Gửi (Review & Submit)

#### Review Sections:
1. **Thông tin chung (General Information)**
   - All fields from Step 1
   - Edit button → Returns to Step 1

2. **Thông tin đối tượng (Payee Information)**
   - All fields from Step 2
   - Edit button → Returns to Step 2

3. **Chi tiết chi phí (Expense Details)**
   - Currency
   - Full expense items table with attachments
   - Grand total and amount in words
   - Edit button → Returns to Step 3

4. **Thông tin phê duyệt (Approval Information)**
   - Approver name
   - Status
   - Edit button → Returns to Step 4

#### Action Buttons:
1. **Lưu phiếu (Save Voucher)**: Saves to localStorage, does not send
2. **Gửi phê duyệt (Send for Approval)**: Submits form and sends email
3. **Xuất PDF**: Generates PDF of voucher
4. **Xuất Excel**: Exports voucher data to Excel file
5. **Nhập Excel**: Imports data from Excel file
6. **Lưu Template**: Saves current form as template
7. **Load Template**: Loads previously saved template

---

## 🔄 Navigation Flow

### Step Navigation (`goToStep(step)`)
1. **Forward Navigation** (step > currentStep):
   - Validates current step before proceeding
   - Shows error toast if validation fails
   - Updates `highestStepReached` if advancing further
   - Updates stepper visual progress

2. **Backward Navigation** (step < currentStep):
   - No validation required
   - Allows editing previous steps
   - Updates stepper to show current step

3. **From Review** (Step 5):
   - `editStepFromReview(stepToEdit)` sets `editingFromReview = true`
   - After editing, returns to Step 5 automatically
   - Updates review section with new data

### Progress Stepper
- **Visual States**:
  - **Pending**: Gray circle, gray label
  - **Active**: Blue circle, white number, blue label
  - **Completed**: Green circle with checkmark, green label
- **Progress Line**: Animated bar showing completion percentage
- **Clickable**: Can click any step to jump (if validation allows)

---

## 💾 Data Persistence

### Auto-save (LocalStorage)
- **Trigger**: Any input change (debounced 2 seconds)
- **Saves**: All form fields, expense items, signature
- **Indicator**: Shows "Đang lưu..." / "Đã lưu" toast
- **Load**: Restored on page load (except voucher date → always current)

### Manual Save (`saveVoucher()`)
- Validates all required fields
- Saves to localStorage
- Shows success toast
- Does not send email or submit form

### Templates
- **Save Template**: Saves current form state as named template
- **Load Template**: Restores form from saved template
- Stored in localStorage with user-defined names

---

## 📧 Submission Flow (`sendForApproval()`)

### Pre-submission Validation
1. **Duplicate Prevention**: 
   - `isSubmitting` flag prevents double-clicks
   - Button disabled immediately on click
   - Shows spinner during processing

2. **Field Validation**:
   - All required fields filled
   - At least one expense item with content and amount
   - Signature uploaded
   - Valid voucher number format: `TL-YYYYMM-####`

3. **Date Validation**:
   - Voucher date must be today or future
   - If past date selected, silently uses current date

### Email Preparation
1. **Recipient Collection**:
   - Fixed recipients: `['linh.le@tl-c.com.vn', 'anh.le@mediainsider.vn', 'nhanh.nguyen@tl-c.com.vn']`
   - CC: Requester email (if found in `employeeEmailMap`)
   - Reply-to: Logged-in user email (from localStorage) or requester email

2. **Approval Links**:
   - **Approval Link**: `approve_voucher.html?{voucherNumber, voucherType, company, employee, amount, requestorEmail, approverEmail}`
   - **Rejection Link**: `reject_voucher.html?{same params}`
   - Base URL: `https://workflow.egg-ventures.com`

3. **Email Content**:
   - **Subject**: `[PHIẾU {TYPE}] Yêu cầu phê duyệt - {VOUCHER_NUMBER}`
   - **Approver Email**:
     - Voucher details summary
     - Full expense items table with attachments
     - Approval/Rejection buttons
   - **Requester Email**:
     - Notification that voucher was submitted
     - Link to view voucher details
     - CC on all future approval updates

### File Upload Process
1. **For Each Expense Item**:
   - Collects all attachment files
   - If Drive API configured:
     - Uploads to Google Drive
     - Gets shareable file URLs
     - Stores URLs in submission data
   - If Drive API not configured:
     - Converts files to base64 (if < 500KB)
     - Includes base64 in submission payload

2. **Submission Payload**:
   - Form data (FormData object to avoid CORS preflight)
   - All expense items with file URLs/base64
   - Signature image (base64)
   - Email addresses for routing

### Backend Submission
- **Endpoint**: `/api/voucher.js` (Vercel proxy)
- **Action**: `sendVoucherForApproval`
- **Backend**: Google Apps Script (`VOUCHER_WORKFLOW_BACKEND.gs`)
- **Response Handling**:
  - Success → Shows success toast, updates approval history
  - Error → Shows error toast, enables button, resets `isSubmitting`

### Post-submission
1. **Update UI**:
   - Adds entry to approval history
   - Updates approval status to "Pending"
   - Shows success message

2. **Clear Form** (optional):
   - Can reset form for new voucher
   - Or keep data for reference

---

## 🎨 Export Functions

### PDF Export (`exportToPDF()`)
- Uses `html2pdf.js` library
- Captures form content (excluding buttons/navigation)
- Generates downloadable PDF file
- Includes: All form data, expense table, signature

### Excel Export (`exportToExcel()`)
- Uses `XLSX` library
- Creates workbook with multiple sheets:
  - **Voucher Info**: Basic information
  - **Expense Items**: Table with all items
  - **Attachments**: List of files
- Downloads as `.xlsx` file

---

## 🔧 Key Functions Reference

### Navigation
- `goToStep(step)`: Navigate to specific step
- `goToStepAfterEdit(nextStep)`: Navigate after editing (handles review mode)
- `editStepFromReview(stepToEdit)`: Edit step from review page
- `validateStep(step)`: Validate step before allowing navigation
- `updateStepperProgress()`: Update visual progress indicator

### Data Management
- `saveVoucher()`: Save to localStorage (manual)
- `saveToLocalStorage()`: Auto-save function
- `loadFromLocalStorage()`: Restore saved data
- `saveTemplate()`: Save as template
- `loadTemplate()`: Load template

### Form Updates
- `updateVoucherTitle()`: Update form title based on voucher type
- `updateCompanyDetails()`: Show company address
- `updateEmployeeDepartment()`: Auto-fill department
- `generateVoucherNumber()`: Generate voucher number
- `setCurrentDate()`: Set voucher date to today

### Expense Items
- `addExpenseRow()`: Add new row to expense table
- `removeExpenseRow(index)`: Remove row from table
- `updateExpenseItem(index, field, value)`: Update item data
- `updateGrandTotal()`: Recalculate total
- `updateAmountInWords()`: Convert total to Vietnamese words
- `copyFromExcelToTable()`: Paste Excel data
- `importExcelToTable()`: Import Excel file

### File Handling
- `handleFileUpload(itemIndex, event)`: Upload files for expense item
- `uploadFileToDrive(file)`: Upload to Google Drive (if configured)
- `fileToBase64(file)`: Convert file to base64
- `handleSignatureUpload(event)`: Upload requester signature
- `clearSignature()`: Remove signature

### Validation
- `validateStep(step)`: Validate step fields
- `validateAllFields()`: Validate entire form
- `validateField(fieldId, value, fieldName)`: Validate single field
- `validateSignature()`: Check if signature uploaded

### Backend Integration
- `loadEmployeesFromBackend()`: Fetch employees from backend
- `sendForApproval()`: Submit voucher for approval

### Review & Display
- `updateReviewSection()`: Update Step 5 review display
- `renderExpenseTable()`: Render expense items table
- `renderApprovalHistory()`: Display approval history

---

## 🚨 Error Handling

### Validation Errors
- Shows toast notification with error message
- Highlights invalid fields with red border
- Scrolls to first error field
- Prevents navigation until fixed

### Network Errors
- Shows error toast with details
- Logs to console for debugging
- Resets submission state
- Allows retry

### File Upload Errors
- Size limit exceeded → Shows error, rejects file
- Invalid file type → Shows error, rejects file
- Drive API failure → Falls back to base64 (if possible)

---

## 📱 Responsive Design

- **Desktop**: Full-width form, side-by-side fields
- **Tablet**: Adjusted column layouts
- **Mobile**: Stacked fields, optimized stepper display

---

## 🔐 Security Features

1. **Authentication Required**: Redirects if not logged in
2. **Session Validation**: Checks user data structure
3. **Date Validation**: Prevents backdating vouchers
4. **File Size Limits**: Prevents oversized uploads
5. **CORS Protection**: Uses Vercel proxy for backend calls
6. **Duplicate Prevention**: Prevents double-submission

---

## 📝 Notes

- **Voucher Number Format**: `TL-YYYYMM-####` (4 random digits)
- **Date Handling**: Always uses local system date (not UTC)
- **Currency Formatting**: Vietnamese locale (VNĐ) with thousand separators
- **File Storage**: Google Drive (if configured) or base64 in database
- **Email Service**: Google Apps Script MailApp service
- **Approval Workflow**: Separate HTML pages (`approve_voucher.html`, `reject_voucher.html`)

---

## 🔄 Complete User Journey

```
1. User logs in → Redirected if not authenticated
2. Page loads → Master data fetched from backend
3. Form initializes → Auto-generates voucher number and date
4. User fills Step 1 → Company, type, employee selected
5. User fills Step 2 → Payee, reason, signature uploaded
6. User fills Step 3 → Currency selected, expense items added
7. User fills Step 4 → Approver selected
8. User reviews Step 5 → Can edit any section, then submits
9. Form validates → All required fields checked
10. Files uploaded → To Drive or converted to base64
11. Email sent → To approvers with approval links
12. Approval history updated → Status set to "Pending"
13. User notified → Success toast shown
```

---

*Last Updated: Based on `phieu_thu_chi.html` code analysis*
