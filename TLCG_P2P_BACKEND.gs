/**
 * TLCG P2P BACKEND (Purchase-to-Pay)
 * Canonical file: TLCG_P2P_BACKEND.gs
 * Domain: P2P — Mua hàng
 *
 * Workflows:
 *   - Purchase Request  (Đề nghị mua hàng)    — purchaseRequest, getPurchaseRequestHistory
 *   - Payment Request   (Đề nghị thanh toán)  — sendPaymentRequest, approvePaymentRequest, …
 *
 * Proxy routing: /api/voucher.js → TLCG_P2P_BACKEND_URL (or PAYMENT_REQUEST_BACKEND_URL fallback)
 *
 * Version: 2.0  (renamed from PAYMENT_REQUEST_BACKEND.gs, May 2026)
 */

// ==================== CONFIGURATION ====================

/**
 * Read a Script Property and fall back to a hardcoded default when the property
 * is missing or the PropertiesService call fails. Keeps this backend running
 * unchanged in legacy deployments that haven't populated properties yet.
 */
function getCfg_(key, fallback) {
  try {
    var v = PropertiesService.getScriptProperties().getProperty(key);
    return (v && String(v).trim()) ? v : fallback;
  } catch (_) {
    return fallback;
  }
}

const USERS_SHEET_ID = getCfg_('MASTER_SPREADSHEET_ID', '1ujmPbtEdkGLgEshfhvV8gRB6R0GLI31jsZM5rDOJS0g');

const CONFIG = {
  SPREADSHEET_ID: getCfg_('MASTER_SPREADSHEET_ID', '1ujmPbtEdkGLgEshfhvV8gRB6R0GLI31jsZM5rDOJS0g'),
  SHEET_NAME: 'Payment_Request_History', // Main sheet for storing all payment requests
  SUPPLIERS_SHEET_NAME: 'Nhà cung cấp', // Existing suppliers sheet
  EMPLOYEES_SHEET_NAME: 'Master Employee',
  PURCHASE_ORDER_SHEET_NAME: 'Purchase Order', // Purchase Order types sheet
  DRIVE_FOLDER_NAME: '02.De_Nghi_Mua_Hang',
  
  // Column indices for Payment_Request_History sheet
  COLUMNS: {
    REQUEST_ID: 0,
    REQUEST_DATE: 1,
    COMPANY: 2,
    REQUESTOR: 3,
    REQUESTOR_EMAIL: 4,
    DEPARTMENT: 5,
    PURCHASE_TYPE: 6,
    PR_REQUEST_NO: 7,
    PURPOSE: 8,
    SUPPLIER: 9,
    RECIPIENT: 10,
    PRODUCT_ITEMS: 11, // JSON
    TOTAL_AMOUNT: 12,
    PAYMENT_TYPE: 13,
    PAYMENT_PHASES: 14, // JSON
    BUDGET_APPROVER: 15,
    BUDGET_STATUS: 16,
    BUDGET_SIGNATURE: 17,
    SUPPLIER_APPROVER: 18,
    SUPPLIER_STATUS: 19,
    SUPPLIER_SIGNATURE: 20,
    LEGAL_APPROVER: 21,
    LEGAL_STATUS: 22,
    LEGAL_SIGNATURE: 23,
    ACCOUNTING_APPROVER: 24,
    ACCOUNTING_STATUS: 25,
    ACCOUNTING_SIGNATURE: 26,
    DIRECTOR_APPROVER: 27,
    DIRECTOR_STATUS: 28,
    DIRECTOR_SIGNATURE: 29,
    FINAL_APPROVER: 30,
    FINAL_STATUS: 31,
    FINAL_SIGNATURE: 32,
    OVERALL_STATUS: 33,
    SUBMITTED_AT: 34,
    METADATA: 35 // JSON for additional data
  }
};

// ==================== MAIN HANDLERS ====================

function doPost(e) {
  try {
    Logger.log('[Payment Request] Received POST request');
    
    // Parse request data
    let data;
    try {
      const contentType = e.postData.type;
      
      if (contentType === 'application/x-www-form-urlencoded') {
        const params = parseUrlEncodedData(e.postData.contents);
        data = params.data ? JSON.parse(params.data) : params;
      } else {
        data = JSON.parse(e.postData.contents);
      }
    } catch (parseError) {
      Logger.log('[Payment Request] Parse error: ' + parseError.message);
      return createResponse(false, 'Lỗi parse dữ liệu: ' + parseError.message);
    }
    
    const action = data.action;
    Logger.log('[Payment Request] Action: ' + action);
    
    // Route to appropriate handler
    switch (action) {
      // ── Purchase Request ─────────────────────────────────────
      case 'purchaseRequest':
        return handlePurchaseRequest(data);
      case 'getPurchaseRequestHistory':
        return handleGetPurchaseRequestHistory(data);
      case 'approvePurchaseRequest':
        return handleApprovePurchaseRequest(data);
      case 'rejectPurchaseRequest':
        return handleRejectPurchaseRequest(data);
      case 'sendBackPurchaseRequest':
        return handleSendBackPurchaseRequest(data);
      case 'resubmitPurchaseRequest':
        return handleResubmitPurchaseRequest(data);
      // ── Payment Request ──────────────────────────────────────
      case 'submitPaymentRequest':
      case 'sendPaymentRequest':
        return handleSendPaymentRequest(data);
      case 'approvePaymentRequest':
        return handleApprovePaymentRequest(data);
      case 'rejectPaymentRequest':
        return handleRejectPaymentRequest(data);
      case 'getPaymentRequestHistory':
        return handleGetPaymentRequestHistory(data);
      case 'getRecentPaymentRequests':
        return handleGetRecentPaymentRequests(data);
      case 'getPaymentRequestDetails':
        return handleGetPaymentRequestDetails(data);
      case 'getSuppliers':
        return handleGetSuppliers(data);
      case 'getVendorBanks':
        return handleGetVendorBanks(data);
      case 'addSupplier':
        return handleAddSupplier(data);
      case 'getEmployees':
        return handleGetEmployees(data);
      case 'getPurchaseOrderTypes':
        return handleGetPurchaseOrderTypes(data);
      case 'getGoodsCatalog':
        return handleGetGoodsCatalog(data);
      // ── Acceptance Minutes ────────────────────────────────────
      case 'createAcceptanceMinutes':
        return handleCreateAcceptanceMinutes(data);
      case 'getAcceptanceMinutesHistory':
        return handleGetAcceptanceMinutesHistory(data);
      case 'getAcceptanceMinutesDetail':
        return handleGetAcceptanceMinutesDetail(data);
      case 'getAcceptanceMinutesByPR':
        return handleGetAcceptanceMinutesByPR(data);
      case 'approveAcceptanceMinutes':
        return handleApproveAcceptanceMinutes(data);
      case 'rejectAcceptanceMinutes':
        return handleRejectAcceptanceMinutes(data);
      default:
        return createResponse(false, 'Invalid action: ' + action);
    }
    
  } catch (error) {
    Logger.log('[Payment Request] Error in doPost: ' + error.message);
    Logger.log('[Payment Request] Stack trace: ' + error.stack);
    return createResponse(false, 'Lỗi server: ' + error.message);
  }
}

function doGet(e) {
  try {
    const action = e.parameter.action;
    const requestId = e.parameter.requestId;
    
    Logger.log('[Payment Request] GET request - Action: ' + action + ', RequestId: ' + requestId);
    
    if (action === 'getPaymentRequestDetails' && requestId) {
      return handleGetPaymentRequestDetails({ requestId: requestId });
    } else if (action === 'getEmployees') {
      return handleGetEmployees(e.parameter);
    } else if (action === 'getPurchaseOrderTypes') {
      return handleGetPurchaseOrderTypes(e.parameter);
    } else if (action === 'getSuppliers') {
      return handleGetSuppliers(e.parameter);
    } else if (action === 'getVendorBanks') {
      return handleGetVendorBanks(e.parameter);
    }
    
    return createResponse(false, 'Invalid GET request');
    
  } catch (error) {
    Logger.log('[Payment Request] Error in doGet: ' + error.message);
    return createResponse(false, 'Lỗi server: ' + error.message);
  }
}

// ==================== SUBMIT PAYMENT REQUEST ====================

function handleSendPaymentRequest(data) {
  try {
    Logger.log('[Payment Request] Processing submission...');
    
    // Validate required fields
    const validation = validatePaymentRequest(data);
    if (!validation.valid) {
      return createResponse(false, 'Validation error: ' + validation.errors.join(', '));
    }
    
    // Get or create sheet
    const sheet = getOrCreateSheet(CONFIG.SHEET_NAME);
    
    // Check for duplicate
    if (findRequestByIdInSheet(sheet, data.requestId)) {
      return createResponse(false, 'Request ID already exists: ' + data.requestId);
    }
    
    // Store file attachments in Google Drive
    const productItemsWithFiles = storeProductAttachments(data.productItems, data.requestId);
    const paymentPhasesWithFiles = storePaymentPhaseAttachments(data.paymentPhases, data.requestId);
    const contractFiles = storeContractAttachments(data.contractAttachments, data.requestId);
    
    // Store signatures in Google Drive
    const requesterSignature = data.requesterSignature ? 
      storeSignature(data.requesterSignature, data.requestId, 'requester') : '';
    
    // Prepare row data
    const rowData = new Array(36).fill('');
    rowData[CONFIG.COLUMNS.REQUEST_ID] = data.requestId;
    rowData[CONFIG.COLUMNS.REQUEST_DATE] = data.requestDate;
    rowData[CONFIG.COLUMNS.COMPANY] = data.company;
    rowData[CONFIG.COLUMNS.REQUESTOR] = data.requestor;
    rowData[CONFIG.COLUMNS.REQUESTOR_EMAIL] = data.requestorEmail;
    rowData[CONFIG.COLUMNS.DEPARTMENT] = data.department;
    rowData[CONFIG.COLUMNS.PURCHASE_TYPE] = data.purchaseType;
    rowData[CONFIG.COLUMNS.PR_REQUEST_NO] = data.prRequestNo;
    rowData[CONFIG.COLUMNS.PURPOSE] = data.purpose;
    rowData[CONFIG.COLUMNS.SUPPLIER] = data.supplier;
    rowData[CONFIG.COLUMNS.RECIPIENT] = data.recipient;
    rowData[CONFIG.COLUMNS.PRODUCT_ITEMS] = JSON.stringify(productItemsWithFiles);
    rowData[CONFIG.COLUMNS.TOTAL_AMOUNT] = data.totalAmount;
    rowData[CONFIG.COLUMNS.PAYMENT_TYPE] = data.paymentType;
    rowData[CONFIG.COLUMNS.PAYMENT_PHASES] = JSON.stringify(paymentPhasesWithFiles);
    rowData[CONFIG.COLUMNS.BUDGET_APPROVER] = data.budgetApprover;
    rowData[CONFIG.COLUMNS.BUDGET_STATUS] = 'Pending';
    rowData[CONFIG.COLUMNS.SUPPLIER_APPROVER] = data.supplierApprover;
    rowData[CONFIG.COLUMNS.SUPPLIER_STATUS] = 'Pending';
    rowData[CONFIG.COLUMNS.LEGAL_APPROVER] = data.legalApprover || '';
    rowData[CONFIG.COLUMNS.LEGAL_STATUS] = data.legalApprover ? 'Pending' : 'N/A';
    rowData[CONFIG.COLUMNS.ACCOUNTING_APPROVER] = data.accountingApprover;
    rowData[CONFIG.COLUMNS.ACCOUNTING_STATUS] = 'Pending';
    rowData[CONFIG.COLUMNS.DIRECTOR_APPROVER] = data.directorApprover;
    rowData[CONFIG.COLUMNS.DIRECTOR_STATUS] = 'Pending';
    rowData[CONFIG.COLUMNS.FINAL_APPROVER] = data.finalApprover;
    rowData[CONFIG.COLUMNS.FINAL_STATUS] = 'Pending';
    rowData[CONFIG.COLUMNS.OVERALL_STATUS] = 'Pending';
    rowData[CONFIG.COLUMNS.SUBMITTED_AT] = new Date().toISOString();
    
    // Validate AM reference (hard gate — AM must be Đã nghiệm thu)
    const amNo = (data.amNo || '').toString().trim();
    if (!amNo) {
      return createResponse(false, 'Vui lòng nhập số Biên Bản Nghiệm Thu (AM No) để tiến hành thanh toán.');
    }
    const amRecord = getAMByNo_(amNo);
    if (!amRecord) {
      return createResponse(false, 'Biên bản nghiệm thu ' + amNo + ' không tồn tại trong hệ thống.');
    }
    if (amRecord.status !== 'Đã nghiệm thu') {
      return createResponse(false, 'Biên bản nghiệm thu ' + amNo + ' chưa được xác nhận (trạng thái hiện tại: ' + amRecord.status + '). Vui lòng chờ phê duyệt trước khi tạo đề nghị thanh toán.');
    }

    // Store metadata
    const metadata = {
      requesterSignature: requesterSignature,
      contractFiles: contractFiles,
      currency: data.currency,
      paymentInfo: data.paymentInfo,
      poRequestNo: data.poRequestNo,
      dueDate: data.dueDate,
      amountInWords: data.amountInWords,
      implementationTime: data.implementationTime,
      legalComment: data.legalComment || '',
      accountingComment: data.accountingComment || '',
      directorComment: data.directorComment || '',
      isNewVendor: data.isNewVendor === true || data.isNewVendor === 'true',
      amNo: amNo,
      amPrNo: amRecord.prNo || ''
    };
    rowData[CONFIG.COLUMNS.METADATA] = JSON.stringify(metadata);
    
    // Append to sheet
    sheet.appendRow(rowData);
    
    Logger.log('[Payment Request] Saved to sheet successfully');
    
    // Add to history
    appendHistory(data.requestId, 'Submitted', data.requestor, 'Request submitted for approval');
    
    // Send email notifications to all approvers
    sendApprovalEmails(data, requesterSignature);
    
    return createResponse(true, 'Payment request submitted successfully', {
      requestId: data.requestId
    });
    
  } catch (error) {
    Logger.log('[Payment Request] Error in handleSendPaymentRequest: ' + error.message);
    Logger.log('[Payment Request] Stack: ' + error.stack);
    return createResponse(false, 'Lỗi khi lưu đề nghị: ' + error.message);
  }
}

// ==================== APPROVE PAYMENT REQUEST ====================

function handleApprovePaymentRequest(data) {
  try {
    Logger.log('[Payment Request] Processing approval...');
    Logger.log('[Payment Request] Request ID: ' + data.requestId);
    Logger.log('[Payment Request] Approver: ' + data.approver);
    Logger.log('[Payment Request] Stage: ' + data.stage);
    
    const sheet = getOrCreateSheet(CONFIG.SHEET_NAME);
    const rowIndex = findRequestByIdInSheet(sheet, data.requestId);
    
    if (rowIndex === -1) {
      return createResponse(false, 'Request not found: ' + data.requestId);
    }
    
    const row = sheet.getRange(rowIndex, 1, 1, 36).getValues()[0];
    
    // Determine which approval stage
    let statusCol, signatureCol, approverCol, stageName;
    
    switch (data.stage) {
      case 'budget':
        statusCol = CONFIG.COLUMNS.BUDGET_STATUS;
        signatureCol = CONFIG.COLUMNS.BUDGET_SIGNATURE;
        approverCol = CONFIG.COLUMNS.BUDGET_APPROVER;
        stageName = 'Budget Approval';
        break;
      case 'supplier':
        statusCol = CONFIG.COLUMNS.SUPPLIER_STATUS;
        signatureCol = CONFIG.COLUMNS.SUPPLIER_SIGNATURE;
        approverCol = CONFIG.COLUMNS.SUPPLIER_APPROVER;
        stageName = 'Supplier Approval';
        break;
      case 'legal':
        statusCol = CONFIG.COLUMNS.LEGAL_STATUS;
        signatureCol = CONFIG.COLUMNS.LEGAL_SIGNATURE;
        approverCol = CONFIG.COLUMNS.LEGAL_APPROVER;
        stageName = 'Legal Approval';
        break;
      case 'accounting':
        statusCol = CONFIG.COLUMNS.ACCOUNTING_STATUS;
        signatureCol = CONFIG.COLUMNS.ACCOUNTING_SIGNATURE;
        approverCol = CONFIG.COLUMNS.ACCOUNTING_APPROVER;
        stageName = 'Accounting Approval';
        break;
      case 'director':
        statusCol = CONFIG.COLUMNS.DIRECTOR_STATUS;
        signatureCol = CONFIG.COLUMNS.DIRECTOR_SIGNATURE;
        approverCol = CONFIG.COLUMNS.DIRECTOR_APPROVER;
        stageName = 'Director Approval';
        break;
      case 'final':
        statusCol = CONFIG.COLUMNS.FINAL_STATUS;
        signatureCol = CONFIG.COLUMNS.FINAL_SIGNATURE;
        approverCol = CONFIG.COLUMNS.FINAL_APPROVER;
        stageName = 'Final Approval';
        break;
      default:
        return createResponse(false, 'Invalid approval stage: ' + data.stage);
    }
    
    // Check current status
    const currentStatus = row[statusCol];
    if (currentStatus === 'Approved') {
      return createResponse(false, stageName + ' already approved. Cannot approve again.');
    }
    if (currentStatus === 'Rejected') {
      return createResponse(false, stageName + ' already rejected. Cannot approve.');
    }
    
    // Validate signature
    if (!data.signature) {
      return createResponse(false, 'Signature is required for approval');
    }
    
    // Store signature
    const signatureUrl = storeSignature(data.signature, data.requestId, data.stage + '_approver');
    
    // Update status and signature
    sheet.getRange(rowIndex, statusCol + 1).setValue('Approved');
    sheet.getRange(rowIndex, signatureCol + 1).setValue(signatureUrl);
    
    // Check if all required approvals are complete
    const allApproved = checkAllApprovalsComplete(sheet, rowIndex);
    if (allApproved) {
      sheet.getRange(rowIndex, CONFIG.COLUMNS.OVERALL_STATUS + 1).setValue('Approved');
    }
    
    // Add to history
    appendHistory(data.requestId, 'Approved', data.approver, stageName + ' approved');
    
    // Send notification to requester
    sendApprovalNotification(row, data.approver, stageName, 'approved', data.comment);
    
    Logger.log('[Payment Request] Approval processed successfully');
    
    return createResponse(true, stageName + ' approved successfully');
    
  } catch (error) {
    Logger.log('[Payment Request] Error in handleApprovePaymentRequest: ' + error.message);
    return createResponse(false, 'Lỗi khi phê duyệt: ' + error.message);
  }
}

// ==================== REJECT PAYMENT REQUEST ====================

function handleRejectPaymentRequest(data) {
  try {
    Logger.log('[Payment Request] Processing rejection...');
    
    const sheet = getOrCreateSheet(CONFIG.SHEET_NAME);
    const rowIndex = findRequestByIdInSheet(sheet, data.requestId);
    
    if (rowIndex === -1) {
      return createResponse(false, 'Request not found: ' + data.requestId);
    }
    
    const row = sheet.getRange(rowIndex, 1, 1, 36).getValues()[0];
    
    // Determine which approval stage
    let statusCol, stageName;
    
    switch (data.stage) {
      case 'budget':
        statusCol = CONFIG.COLUMNS.BUDGET_STATUS;
        stageName = 'Budget Approval';
        break;
      case 'supplier':
        statusCol = CONFIG.COLUMNS.SUPPLIER_STATUS;
        stageName = 'Supplier Approval';
        break;
      case 'legal':
        statusCol = CONFIG.COLUMNS.LEGAL_STATUS;
        stageName = 'Legal Approval';
        break;
      case 'accounting':
        statusCol = CONFIG.COLUMNS.ACCOUNTING_STATUS;
        stageName = 'Accounting Approval';
        break;
      case 'director':
        statusCol = CONFIG.COLUMNS.DIRECTOR_STATUS;
        stageName = 'Director Approval';
        break;
      case 'final':
        statusCol = CONFIG.COLUMNS.FINAL_STATUS;
        stageName = 'Final Approval';
        break;
      default:
        return createResponse(false, 'Invalid approval stage: ' + data.stage);
    }
    
    // Check current status
    const currentStatus = row[statusCol];
    if (currentStatus === 'Rejected') {
      return createResponse(false, stageName + ' already rejected. Cannot reject again.');
    }
    if (currentStatus === 'Approved') {
      return createResponse(false, stageName + ' already approved. Cannot reject.');
    }
    
    // Update status
    sheet.getRange(rowIndex, statusCol + 1).setValue('Rejected');
    sheet.getRange(rowIndex, CONFIG.COLUMNS.OVERALL_STATUS + 1).setValue('Rejected');
    
    // Add to history
    const reason = data.rejectReason || 'No reason provided';
    appendHistory(data.requestId, 'Rejected', data.approver, stageName + ' rejected: ' + reason);
    
    // Send notification to requester
    sendApprovalNotification(row, data.approver, stageName, 'rejected', reason);
    
    Logger.log('[Payment Request] Rejection processed successfully');
    
    return createResponse(true, stageName + ' rejected successfully');
    
  } catch (error) {
    Logger.log('[Payment Request] Error in handleRejectPaymentRequest: ' + error.message);
    return createResponse(false, 'Lỗi khi từ chối: ' + error.message);
  }
}

// ==================== GET HISTORY ====================

function handleGetPaymentRequestHistory(data) {
  try {
    const historySheet = getOrCreateSheet(CONFIG.SHEET_NAME);
    const dataRange = historySheet.getDataRange();
    
    if (dataRange.getNumRows() <= 1) {
      return createResponse(true, 'No history found', { history: [] });
    }
    
    const values = dataRange.getValues();
    const history = [];
    
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      if (row[0] === data.requestId) {
        history.push({
          requestId: row[0],
          timestamp: row[1],
          action: row[2],
          actor: row[3],
          note: row[4]
        });
      }
    }
    
    return createResponse(true, 'History retrieved successfully', { history: history });
    
  } catch (error) {
    Logger.log('[Payment Request] Error in handleGetPaymentRequestHistory: ' + error.message);
    return createResponse(false, 'Lỗi khi lấy lịch sử: ' + error.message);
  }
}

// ==================== GET RECENT PAYMENT REQUESTS (list view) ====================

function handleGetRecentPaymentRequests(data) {
  try {
    const sheet = getOrCreateSheet(CONFIG.SHEET_NAME);
    const values = sheet.getDataRange().getValues();
    if (values.length <= 1) return createResponse(true, 'No requests found', { requests: [] });

    const C = CONFIG.COLUMNS;
    const emailFilter = (data.requestorEmail || '').toString().trim().toLowerCase();
    const requests = [];

    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      if (!row[C.REQUEST_ID]) continue;
      if (emailFilter && (row[C.REQUESTOR_EMAIL] || '').toString().trim().toLowerCase() !== emailFilter) continue;

      const overallStatus = (row[C.OVERALL_STATUS] || 'Pending').toString().trim();
      const approvalSteps = [
        { role: 'Budget',     status: row[C.BUDGET_STATUS],     approver: row[C.BUDGET_APPROVER] },
        { role: 'Supplier',   status: row[C.SUPPLIER_STATUS],   approver: row[C.SUPPLIER_APPROVER] },
        { role: 'Legal',      status: row[C.LEGAL_STATUS],      approver: row[C.LEGAL_APPROVER] },
        { role: 'Accounting', status: row[C.ACCOUNTING_STATUS], approver: row[C.ACCOUNTING_APPROVER] },
        { role: 'Director',   status: row[C.DIRECTOR_STATUS],   approver: row[C.DIRECTOR_APPROVER] }
      ];
      const approvedCount = approvalSteps.filter(s => (s.status || '').toString().toLowerCase() === 'approved').length;
      const totalSteps    = approvalSteps.filter(s => s.approver).length || 1;

      requests.push({
        requestId:      row[C.REQUEST_ID],
        requestDate:    row[C.REQUEST_DATE],
        company:        row[C.COMPANY],
        requestor:      row[C.REQUESTOR],
        requestorEmail: row[C.REQUESTOR_EMAIL],
        supplier:       row[C.SUPPLIER],
        totalAmount:    row[C.TOTAL_AMOUNT],
        paymentType:    row[C.PAYMENT_TYPE],
        purpose:        row[C.PURPOSE],
        overallStatus:  overallStatus,
        approvedCount:  approvedCount,
        totalSteps:     totalSteps,
        submittedAt:    row[C.SUBMITTED_AT] || row[C.REQUEST_DATE]
      });
    }

    // Most recent first
    requests.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
    return createResponse(true, 'Requests retrieved', { requests: requests });

  } catch (error) {
    Logger.log('[Payment Request] Error in handleGetRecentPaymentRequests: ' + error.message);
    return createResponse(false, 'Lỗi: ' + error.message);
  }
}

// ==================== GET REQUEST DETAILS ====================

function handleGetPaymentRequestDetails(data) {
  try {
    const sheet = getOrCreateSheet(CONFIG.SHEET_NAME);
    const rowIndex = findRequestByIdInSheet(sheet, data.requestId);
    
    if (rowIndex === -1) {
      return createResponse(false, 'Request not found: ' + data.requestId);
    }
    
    const row = sheet.getRange(rowIndex, 1, 1, 36).getValues()[0];
    
    const details = {
      requestId: row[CONFIG.COLUMNS.REQUEST_ID],
      requestDate: row[CONFIG.COLUMNS.REQUEST_DATE],
      company: row[CONFIG.COLUMNS.COMPANY],
      requestor: row[CONFIG.COLUMNS.REQUESTOR],
      requestorEmail: row[CONFIG.COLUMNS.REQUESTOR_EMAIL],
      department: row[CONFIG.COLUMNS.DEPARTMENT],
      purchaseType: row[CONFIG.COLUMNS.PURCHASE_TYPE],
      prRequestNo: row[CONFIG.COLUMNS.PR_REQUEST_NO],
      purpose: row[CONFIG.COLUMNS.PURPOSE],
      supplier: row[CONFIG.COLUMNS.SUPPLIER],
      recipient: row[CONFIG.COLUMNS.RECIPIENT],
      productItems: JSON.parse(row[CONFIG.COLUMNS.PRODUCT_ITEMS] || '[]'),
      totalAmount: row[CONFIG.COLUMNS.TOTAL_AMOUNT],
      paymentType: row[CONFIG.COLUMNS.PAYMENT_TYPE],
      paymentPhases: JSON.parse(row[CONFIG.COLUMNS.PAYMENT_PHASES] || '[]'),
      budgetApprover: row[CONFIG.COLUMNS.BUDGET_APPROVER],
      budgetStatus: row[CONFIG.COLUMNS.BUDGET_STATUS],
      budgetSignature: row[CONFIG.COLUMNS.BUDGET_SIGNATURE],
      supplierApprover: row[CONFIG.COLUMNS.SUPPLIER_APPROVER],
      supplierStatus: row[CONFIG.COLUMNS.SUPPLIER_STATUS],
      supplierSignature: row[CONFIG.COLUMNS.SUPPLIER_SIGNATURE],
      legalApprover: row[CONFIG.COLUMNS.LEGAL_APPROVER],
      legalStatus: row[CONFIG.COLUMNS.LEGAL_STATUS],
      legalSignature: row[CONFIG.COLUMNS.LEGAL_SIGNATURE],
      accountingApprover: row[CONFIG.COLUMNS.ACCOUNTING_APPROVER],
      accountingStatus: row[CONFIG.COLUMNS.ACCOUNTING_STATUS],
      accountingSignature: row[CONFIG.COLUMNS.ACCOUNTING_SIGNATURE],
      directorApprover: row[CONFIG.COLUMNS.DIRECTOR_APPROVER],
      directorStatus: row[CONFIG.COLUMNS.DIRECTOR_STATUS],
      directorSignature: row[CONFIG.COLUMNS.DIRECTOR_SIGNATURE],
      finalApprover: row[CONFIG.COLUMNS.FINAL_APPROVER],
      finalStatus: row[CONFIG.COLUMNS.FINAL_STATUS],
      finalSignature: row[CONFIG.COLUMNS.FINAL_SIGNATURE],
      overallStatus: row[CONFIG.COLUMNS.OVERALL_STATUS],
      submittedAt: row[CONFIG.COLUMNS.SUBMITTED_AT],
      metadata: JSON.parse(row[CONFIG.COLUMNS.METADATA] || '{}')
    };
    
    return createResponse(true, 'Request details retrieved successfully', { details: details });
    
  } catch (error) {
    Logger.log('[Payment Request] Error in handleGetPaymentRequestDetails: ' + error.message);
    return createResponse(false, 'Lỗi khi lấy chi tiết: ' + error.message);
  }
}

// ==================== HELPER FUNCTIONS ====================

function validatePaymentRequest(data) {
  const errors = [];
  
  if (!data.requestId) errors.push('Request ID is required');
  if (!data.company) errors.push('Company is required');
  if (!data.requestor) errors.push('Requestor is required');
  if (!data.purchaseType) errors.push('Purchase type is required');
  if (!data.supplier) errors.push('Supplier is required');
  if (!data.budgetApprover) errors.push('Budget approver is required');
  if (!data.supplierApprover) errors.push('Supplier approver is required');
  if (!data.finalApprover) errors.push('Final approver is required');
  
  if (!data.productItems || data.productItems.length === 0) {
    errors.push('At least one product item is required');
  }
  
  if (!data.paymentPhases || data.paymentPhases.length === 0) {
    errors.push('At least one payment phase is required');
  }
  
  return {
    valid: errors.length === 0,
    errors: errors
  };
}

function checkAllApprovalsComplete(sheet, rowIndex) {
  const row = sheet.getRange(rowIndex, 1, 1, 36).getValues()[0];
  
  const budgetStatus = row[CONFIG.COLUMNS.BUDGET_STATUS];
  const supplierStatus = row[CONFIG.COLUMNS.SUPPLIER_STATUS];
  const legalStatus = row[CONFIG.COLUMNS.LEGAL_STATUS];
  const accountingStatus = row[CONFIG.COLUMNS.ACCOUNTING_STATUS];
  const directorStatus = row[CONFIG.COLUMNS.DIRECTOR_STATUS];
  const finalStatus = row[CONFIG.COLUMNS.FINAL_STATUS];
  
  // Check required approvals
  if (budgetStatus !== 'Approved') return false;
  if (supplierStatus !== 'Approved') return false;
  if (accountingStatus !== 'Approved') return false;
  if (directorStatus !== 'Approved') return false;
  if (finalStatus !== 'Approved') return false;
  
  // Legal approval is optional (check if approver is assigned)
  if (row[CONFIG.COLUMNS.LEGAL_APPROVER] && legalStatus !== 'Approved') return false;
  
  return true;
}

function storeProductAttachments(productItems, requestId) {
  if (!productItems) return [];
  
  return productItems.map((item, index) => {
    const itemCopy = { ...item };
    if (item.attachments && item.attachments.length > 0) {
      itemCopy.attachmentUrls = item.attachments.map((file, fileIndex) => {
        return storeFileInDrive(file, requestId, `product_${index}_${fileIndex}`);
      });
    }
    delete itemCopy.attachments; // Remove base64 data
    return itemCopy;
  });
}

function storePaymentPhaseAttachments(paymentPhases, requestId) {
  if (!paymentPhases) return [];
  
  return paymentPhases.map((phase, index) => {
    const phaseCopy = { ...phase };
    
    if (phase.acceptanceMinutes && phase.acceptanceMinutes.length > 0) {
      phaseCopy.acceptanceMinutesUrls = phase.acceptanceMinutes.map((file, fileIndex) => {
        return storeFileInDrive(file, requestId, `phase_${index}_acceptance_${fileIndex}`);
      });
      delete phaseCopy.acceptanceMinutes;
    }
    
    if (phase.supplierPaymentRequest && phase.supplierPaymentRequest.length > 0) {
      phaseCopy.supplierPaymentRequestUrls = phase.supplierPaymentRequest.map((file, fileIndex) => {
        return storeFileInDrive(file, requestId, `phase_${index}_supplier_${fileIndex}`);
      });
      delete phaseCopy.supplierPaymentRequest;
    }
    
    if (phase.invoice && phase.invoice.length > 0) {
      phaseCopy.invoiceUrls = phase.invoice.map((file, fileIndex) => {
        return storeFileInDrive(file, requestId, `phase_${index}_invoice_${fileIndex}`);
      });
      delete phaseCopy.invoice;
    }
    
    return phaseCopy;
  });
}

function storeContractAttachments(contractAttachments, requestId) {
  if (!contractAttachments || contractAttachments.length === 0) return [];
  
  return contractAttachments.map((file, index) => {
    return storeFileInDrive(file, requestId, `contract_${index}`);
  });
}

function storeFileInDrive(fileData, requestId, fileName) {
  try {
    const folder = getOrCreateFolder(CONFIG.DRIVE_FOLDER_NAME);
    const requestFolder = getOrCreateFolder(requestId, folder);
    
    // If fileData is base64
    if (typeof fileData === 'string' && fileData.startsWith('data:')) {
      const base64Data = fileData.split(',')[1];
      const mimeType = fileData.split(';')[0].split(':')[1];
      const blob = Utilities.newBlob(Utilities.base64Decode(base64Data), mimeType, fileName);
      const file = requestFolder.createFile(blob);
      return file.getUrl();
    }
    
    // If fileData is object with name and data
    if (fileData.data) {
      const base64Data = fileData.data.split(',')[1];
      const mimeType = fileData.data.split(';')[0].split(':')[1];
      const blob = Utilities.newBlob(Utilities.base64Decode(base64Data), mimeType, fileData.name || fileName);
      const file = requestFolder.createFile(blob);
      return file.getUrl();
    }
    
    return '';
  } catch (error) {
    Logger.log('[Payment Request] Error storing file: ' + error.message);
    return '';
  }
}

function storeSignature(signatureData, requestId, signatureType) {
  try {
    if (!signatureData) return '';
    
    const folder = getOrCreateFolder(CONFIG.DRIVE_FOLDER_NAME);
    const requestFolder = getOrCreateFolder(requestId, folder);
    
    const base64Data = signatureData.split(',')[1];
    const mimeType = signatureData.split(';')[0].split(':')[1];
    const fileName = `signature_${signatureType}_${new Date().getTime()}.png`;
    const blob = Utilities.newBlob(Utilities.base64Decode(base64Data), mimeType, fileName);
    const file = requestFolder.createFile(blob);
    
    return file.getUrl();
  } catch (error) {
    Logger.log('[Payment Request] Error storing signature: ' + error.message);
    return '';
  }
}

function sendApprovalEmails(data, requesterSignatureUrl) {
  try {
    const approvers = [
      { name: data.budgetApprover, email: data.budgetApproverEmail, stage: 'budget' },
      { name: data.supplierApprover, email: data.supplierApproverEmail, stage: 'supplier' },
      { name: data.legalApprover, email: data.legalApproverEmail, stage: 'legal' },
      { name: data.accountingApprover, email: data.accountingApproverEmail, stage: 'accounting' },
      { name: data.directorApprover, email: data.directorApproverEmail, stage: 'director' },
      { name: data.finalApprover, email: data.finalApproverEmail, stage: 'final' }
    ].filter(a => a.email);
    
    const baseUrl = 'https://workflow.egg-ventures.com';
    const approveUrl = `${baseUrl}/approve_payment_request.html?requestId=${data.requestId}`;
    const rejectUrl = `${baseUrl}/reject_payment_request.html?requestId=${data.requestId}`;
    
    const subject = `[ĐỀ NGHỊ MUA HÀNG] Yêu cầu phê duyệt - ${data.requestId}`;
    
    const emailBody = `
      <p>Kính gửi các cấp quản lý,</p>
      <p>Đề nghị mua hàng số <b>${data.requestId}</b> đã được tạo và đang chờ phê duyệt.</p>
      
      <h3>Thông tin chung:</h3>
      <ul>
        <li><b>Số đề nghị:</b> ${data.requestId}</li>
        <li><b>Ngày lập:</b> ${data.requestDate}</li>
        <li><b>ty:</b> ${data.company}</li>
        <li><b>Người đề nghị:</b> ${data.requestor} (${data.requestorEmail})</li>
        <li><b>Bộ phận:</b> ${data.department}</li>
      </ul>
      
      <h3>Đề nghị mua hàng:</h3>
      <ul>
        <li><b>Loại:</b> ${data.purchaseType}</li>
        <li><b>Số PR:</b> ${data.prRequestNo}</li>
        <li><b>Mục đích:</b> ${data.purpose}</li>
        <li><b>Nhà cung cấp:</b> ${data.supplier}</li>
        <li><b>Người nhận:</b> ${data.recipient}</li>
        <li><b>Tổng số tiền:</b> ${data.totalAmount}</li>
      </ul>
      
      <h3>Hành động:</h3>
      <p>
        <a href="${approveUrl}" style="background-color: #34A853; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-right: 10px;">Phê duyệt</a>
        <a href="${rejectUrl}" style="background-color: #EA4335; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Từ chối</a>
      </p>
      
      <p>Trân trọng,<br>Hệ thống Workflow TLC Group</p>
    `;
    
    approvers.forEach(approver => {
      try {
        GmailApp.sendEmail(approver.email, subject, '', {
          htmlBody: emailBody,
          replyTo: data.requestorEmail,
          name: 'TLC Group Workflow'
        });
        Logger.log('[Payment Request] Email sent to: ' + approver.email);
      } catch (emailError) {
        Logger.log('[Payment Request] Error sending email to ' + approver.email + ': ' + emailError.message);
      }
    });
    
  } catch (error) {
    Logger.log('[Payment Request] Error in sendApprovalEmails: ' + error.message);
  }
}

function sendApprovalNotification(row, approver, stage, action, comment) {
  try {
    const requestorEmail = row[CONFIG.COLUMNS.REQUESTOR_EMAIL];
    const requestId = row[CONFIG.COLUMNS.REQUEST_ID];
    const requestor = row[CONFIG.COLUMNS.REQUESTOR];
    
    if (!requestorEmail) return;
    
    const subject = `[ĐỀ NGHỊ MUA HÀNG] ${stage} ${action === 'approved' ? 'đã phê duyệt' : 'đã từ chối'} - ${requestId}`;
    
    const emailBody = `
      <p>Kính gửi ${requestor},</p>
      <p>Đề nghị mua hàng số <b>${requestId}</b> của bạn đã được ${action === 'approved' ? 'phê duyệt' : 'từ chối'} bởi ${approver} tại giai đoạn <b>${stage}</b>.</p>
      
      ${comment ? `<p><b>Nhận xét:</b> ${comment}</p>` : ''}
      
      <p>Vui lòng truy cập hệ thống để xem chi tiết.</p>
      
      <p>Trân trọng,<br>Hệ thống Workflow TLC Group</p>
    `;
    
    GmailApp.sendEmail(requestorEmail, subject, '', {
      htmlBody: emailBody,
      name: 'TLC Group Workflow'
    });
    
    Logger.log('[Payment Request] Notification sent to requester: ' + requestorEmail);
    
  } catch (error) {
    Logger.log('[Payment Request] Error sending notification: ' + error.message);
  }
}

function appendHistory(requestId, action, actor, note) {
  try {
    const historySheet = getOrCreateSheet(CONFIG.SHEET_NAME);
    
    // Create header if sheet is empty
    if (historySheet.getLastRow() === 0) {
      historySheet.appendRow(['Request ID', 'Timestamp', 'Action', 'Actor', 'Note']);
    }
    
    historySheet.appendRow([
      requestId,
      new Date().toISOString(),
      action,
      actor,
      note
    ]);
    
  } catch (error) {
    Logger.log('[Payment Request] Error appending history: ' + error.message);
  }
}

function getOrCreateSheet(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    
    // Create headers based on sheet type
    if (sheetName === CONFIG.SHEET_NAME) {
      const headers = [
        'Request ID', 'Request Date', 'Company', 'Requestor', 'Requestor Email', 'Department',
        'Purchase Type', 'PR Request No', 'Purpose', 'Supplier', 'Recipient',
        'Product Items (JSON)', 'Total Amount', 'Payment Type', 'Payment Phases (JSON)',
        'Budget Approver', 'Budget Status', 'Budget Signature',
        'Supplier Approver', 'Supplier Status', 'Supplier Signature',
        'Legal Approver', 'Legal Status', 'Legal Signature',
        'Accounting Approver', 'Accounting Status', 'Accounting Signature',
        'Director Approver', 'Director Status', 'Director Signature',
        'Final Approver', 'Final Status', 'Final Signature',
        'Overall Status', 'Submitted At', 'Metadata (JSON)'
      ];
      sheet.appendRow(headers);
    } else if (sheetName === CONFIG.SHEET_NAME) {
      // Payment_Request_History sheet - will be created manually by user
      // Header row should already exist
    }
  }
  
  return sheet;
}

function getOrCreateFolder(folderName, parentFolder) {
  const parent = parentFolder || DriveApp.getRootFolder();
  const folders = parent.getFoldersByName(folderName);
  
  if (folders.hasNext()) {
    return folders.next();
  } else {
    return parent.createFolder(folderName);
  }
}

function findRequestByIdInSheet(sheet, requestId) {
  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();
  
  for (let i = 1; i < values.length; i++) {
    if (values[i][0] === requestId) {
      return i + 1; // Return 1-based row index
    }
  }
  
  return -1;
}

function parseUrlEncodedData(contents) {
  const params = {};
  const pairs = contents.split('&');

  for (let i = 0; i < pairs.length; i++) {
    const eqIdx = pairs[i].indexOf('=');
    if (eqIdx === -1) continue;
    const rawKey = pairs[i].substring(0, eqIdx);
    const rawVal = pairs[i].substring(eqIdx + 1);
    // URLSearchParams encodes spaces as '+'; decodeURIComponent only handles %20
    const key   = decodeURIComponent(rawKey.replace(/\+/g, ' '));
    const value = decodeURIComponent(rawVal.replace(/\+/g, ' '));
    params[key] = value;
  }

  return params;
}

function createResponse(success, message, data = {}) {
  const response = {
    success: success,
    message: message,
    ...data
  };
  
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

// ==================== SUPPLIER MANAGEMENT ====================

/**
 * Get suppliers from "Master Vendor" sheet, optionally filtered by companyGroupKey
 */
function handleGetSuppliers(data) {
  try {
    Logger.log('[Payment Request] Getting suppliers from "Master Vendor" sheet');
    const companyGroupKey = (data.companyGroupKey || '').toString().trim().toLowerCase();

    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName('Master Vendor');

    if (!sheet) {
      Logger.log('[Payment Request] Sheet "Master Vendor" not found');
      return createResponse(false, 'Sheet "Master Vendor" không tồn tại');
    }

    const rows = sheet.getDataRange().getValues();
    if (rows.length < 2) {
      return createResponse(true, 'No suppliers found', { suppliers: [], count: 0 });
    }

    // Col H=7: Vendor_Full_Name, I=8: Vendor_Type, J=9: Tax_ID, K=10: Address
    // Col G=6: company group key for filtering
    const suppliers = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const vendorName = (row[7] || '').toString().trim();
      if (!vendorName) continue;
      if (companyGroupKey) {
        const rowKey = (row[6] || '').toString().trim().toLowerCase();
        if (rowKey && rowKey !== companyGroupKey) continue;
      }
      suppliers.push({
        vendor_name: vendorName,
        vendor_type: (row[8] || '').toString().trim(),
        tax_id:      (row[9] || '').toString().trim(),
        address:     (row[10] || '').toString().trim()
      });
    }

    suppliers.sort((a, b) => a.vendor_name.localeCompare(b.vendor_name, 'vi'));
    Logger.log('[Payment Request] Found ' + suppliers.length + ' suppliers');
    return createResponse(true, 'Suppliers retrieved successfully', { suppliers: suppliers, count: suppliers.length });

  } catch (error) {
    Logger.log('[Payment Request] Error getting suppliers: ' + error.message);
    return createResponse(false, 'Error: ' + error.message);
  }
}

function handleGetVendorBanks(data) {
  try {
    // Exact match: col B (Master Vendor_Bank) must equal col H (Master Vendor).
    // Only rows where col J Status === 'Active' (case-insensitive) are returned.
    const vendorName = (data.vendorName || '').toString().trim();
    Logger.log('[Payment Request] Getting vendor banks for: ' + vendorName);

    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName('Master Vendor_Bank');

    if (!sheet) {
      Logger.log('[Payment Request] Sheet "Master Vendor_Bank" not found');
      return createResponse(false, 'Sheet "Master Vendor_Bank" không tồn tại');
    }

    const rows = sheet.getDataRange().getValues();
    if (rows.length < 2) {
      return createResponse(true, 'No banks found', { banks: [] });
    }

    // A=0: Name, B=1: Vendor_name, C=2: Vendor Bank Name, D=3: Note,
    // E=4: Bank Name, F=5: Bank Number, G=6: Bank Address,
    // H=7: SWIFT code, I=8: Beneficiary Bank Address, J=9: Status
    const banks = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const rowVendor = (row[1] || '').toString().trim(); // col B: Vendor_name — exact match to col H
      const status    = (row[9] || '').toString().trim(); // col J: Status — must be "Active"
      if (vendorName && rowVendor !== vendorName) continue;
      if (status.toLowerCase() !== 'active') continue;
      banks.push({
        account_name: (row[2] || '').toString().trim(), // Vendor Bank Name
        account_no:   (row[5] || '').toString().trim(), // Bank Number
        bank_name:    (row[4] || '').toString().trim(), // Bank Name
        note:         (row[3] || '').toString().trim(), // Note
        bank_address: (row[6] || '').toString().trim(), // Bank Address
        swift_code:   (row[7] || '').toString().trim()  // SWIFT code
      });
    }

    Logger.log('[Payment Request] Found ' + banks.length + ' banks for: ' + vendorName);
    return createResponse(true, 'Banks retrieved successfully', { banks: banks });

  } catch (error) {
    Logger.log('[Payment Request] Error getting vendor banks: ' + error.message);
    return createResponse(false, 'Error: ' + error.message);
  }
}

/**
 * Add new supplier to "Nhà cung cấp" sheet
 */
function handleAddSupplier(data) {
  try {
    const { name, address, phone, email, taxCode, companyType } = data;
    
    Logger.log('[Payment Request] Adding new supplier: ' + name);
    
    // Validate required field
    if (!name || name.trim() === '') {
      return createResponse(false, 'Supplier name is required');
    }
    
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const suppliersSheet = ss.getSheetByName(CONFIG.SUPPLIERS_SHEET_NAME);
    
    if (!suppliersSheet) {
      Logger.log('[Payment Request] Sheet "Nhà cung cấp" not found');
      return createResponse(false, 'Sheet "Nhà cung cấp" not found');
    }
    
    // Check for duplicates in Column C
    const lastRow = suppliersSheet.getLastRow();
    if (lastRow > 1) {
      const existingNames = suppliersSheet.getRange(2, 3, lastRow - 1, 1).getValues();
      const isDuplicate = existingNames.some(row => 
        row[0] && row[0].toString().trim().toLowerCase() === name.trim().toLowerCase()
      );
      
      if (isDuplicate) {
        Logger.log('[Payment Request] Supplier already exists: ' + name);
        return createResponse(false, 'Supplier "' + name + '" already exists');
      }
    }
    
    // Generate unique ID for Column A
    const newId = 'VD' + String(lastRow).padStart(3, '0');
    
    // Prepare row data matching the sheet structure
    const newRow = [
      newId,                           // A: Name (ID)
      name.substring(0, 50),           // B: Vendor (short name)
      name,                            // C: Vendor_Full_Name
      '',                              // D: Công ty mua hàng (empty for now)
      '',                              // E: QBO_Code (empty for now)
      companyType || 'Others',         // F: Vendor_Type
      taxCode || '',                   // G: Tax_ID
      address || '',                   // H: Address
      '',                              // I: QB_ID
      '',                              // J: FCT
      'VND',                           // K: Payment_Currency
      '',                              // L: Quoc_tich
      '',                              // M: Khong_cu_tru
      '',                              // N: Loai_giay_to
      '',                              // O: CMND/CCCD/Ho_Chieu
      '',                              // P: Ngay_cap
      '',                              // Q: Noi_cap
      phone || '',                     // R: So_dien_thoai_lien_he
      address || '',                   // S: Dia_chi_lien_he
      email || '',                     // T: Email_lien_he
      '',                              // U: Gioi_tinh
      '',                              // V: Ngay_sinh
      '',                              // W: Loan
      '',                              // X: Freelancer_Job_Name
      'Yes'                            // Y: Active
    ];
    
    // Append the new row
    suppliersSheet.appendRow(newRow);
    
    Logger.log('[Payment Request] Successfully added supplier: ' + name + ' with ID: ' + newId);
    
    return createResponse(true, 'Supplier added successfully', {
      supplierId: newId,
      name: name
    });
    
  } catch (error) {
    Logger.log('[Payment Request] Error adding supplier: ' + error.message);
    return createResponse(false, 'Error: ' + error.message);
  }
}

// ==================== EMPLOYEE MANAGEMENT ====================

/**
 * Get all employees from "Nhân viên" sheet
 */
function handleGetEmployees(requestBody) {
  try {
    Logger.log('[Payment Request] === handleGetEmployees called ===');
    
    const ss = SpreadsheetApp.openById(USERS_SHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.EMPLOYEES_SHEET_NAME);
    
    if (!sheet) {
      Logger.log('[Payment Request] ❌ Sheet "' + CONFIG.EMPLOYEES_SHEET_NAME + '" not found');
      return createResponse(false, 'Sheet "' + CONFIG.EMPLOYEES_SHEET_NAME + '" không tồn tại');
    }
    
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) {
      Logger.log('[Payment Request] ⚠️ No employee data found (only header row)');
      return createResponse(true, 'Thành công', { employees: [] });
    }
    
    // Column mapping based on sheet structure:
    // A: Họ và tên (Name) - index 0
    // B: Chức vụ (Position) - index 1
    // C: Phòng ban (Department) - index 2
    // D: Công ty (Company) - index 3
    // E: Email - index 4
    // F: Điện thoại (Phone) - index 5
    // G: Status - index 6
    // H: EmployeeId - index 7
    // I: Role - index 8
    // J: isAdmin - index 9
    
    const employees = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      // Only include active employees
      if (row[6] === 'Active' || !row[6] || row[6] === '') {
        employees.push({
          name: row[0] || '',           // Họ và tên
          position: row[1] || '',       // Chức vụ
          department: row[2] || '',     // Phòng ban (Column C)
          company: row[3] || '',        // Công ty
          email: row[4] || '',          // Email
          phone: row[5] || '',          // Điện thoại
          status: row[6] || 'Active',   // Status
          employeeId: row[7] || '',     // EmployeeId
          role: row[8] || '',           // Role
          isAdmin: row[9] === 'TRUE' || row[9] === true  // isAdmin
        });
      }
    }
    
    Logger.log('[Payment Request] ✅ Found ' + employees.length + ' active employees');
    return createResponse(true, 'Thành công', { employees: employees });
  } catch (error) {
    Logger.log('[Payment Request] ❌ ERROR in handleGetEmployees: ' + error.toString());
    Logger.log('[Payment Request] ❌ Error stack: ' + error.stack);
    return createResponse(false, 'Lỗi: ' + error.message);
  }
}

// ==================== GET PURCHASE ORDER TYPES ====================

function handleGetPurchaseOrderTypes(data) {
  try {
    Logger.log('[Payment Request] === handleGetPurchaseOrderTypes called ===');
    
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.PURCHASE_ORDER_SHEET_NAME);
    
    if (!sheet) {
      Logger.log('[Payment Request] ❌ Sheet "' + CONFIG.PURCHASE_ORDER_SHEET_NAME + '" not found');
      return createResponse(false, 'Sheet "' + CONFIG.PURCHASE_ORDER_SHEET_NAME + '" không tồn tại');
    }
    
    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();
    
    if (values.length < 2) {
      Logger.log('[Payment Request] ⚠️ No purchase order types found (only header row)');
      return createResponse(true, 'Thành công', { types: [] });
    }
    
    // Column mapping:
    // A: No (index 0)
    // B: Type (index 1)
    
    const types = [];
    // Start from row 2 (index 1) to skip header
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      const typeValue = row[1]; // Column B (Type)
      
      // Skip empty rows
      if (typeValue && typeValue.toString().trim() !== '') {
        types.push({
          no: row[0] || '',           // Column A (No)
          type: typeValue.toString().trim()  // Column B (Type)
        });
      }
    }
    
    Logger.log('[Payment Request] ✅ Found ' + types.length + ' purchase order types');
    return createResponse(true, 'Thành công', { types: types });
  } catch (error) {
    Logger.log('[Payment Request] ❌ ERROR in handleGetPurchaseOrderTypes: ' + error.toString());
    Logger.log('[Payment Request] ❌ Error stack: ' + error.stack);
    return createResponse(false, 'Lỗi: ' + error.message);
  }
}

// ==================== GOODS CATALOG ====================

/**
 * Returns goods rows from Goods-KTT sheet (raw headers as keys).
 * Lightweight — does not read employees or suppliers.
 */
function handleGetGoodsCatalog(data) {
  try {
    Logger.log('[P2P] === handleGetGoodsCatalog called ===');
    var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    var goodsSheet = ss.getSheetByName('Goods-KTT');
    if (!goodsSheet) {
      Logger.log('[P2P] ⚠️ Sheet "Goods-KTT" not found');
      return createResponse(true, 'Goods-KTT sheet not found', { goods: [] });
    }
    var vals    = goodsSheet.getDataRange().getValues();
    var headers = vals[0];
    var goods   = vals.slice(1).map(function(row) {
      var obj = {};
      headers.forEach(function(h, i) { obj[h] = row[i]; });
      return obj;
    }).filter(function(r) { return r[headers[0]]; });
    Logger.log('[P2P] ✅ Goods-KTT records: ' + goods.length);
    return createResponse(true, 'Goods catalog fetched successfully', { goods: goods });
  } catch (error) {
    Logger.log('[P2P] ❌ ERROR in handleGetGoodsCatalog: ' + error.toString());
    return createResponse(false, 'Lỗi: ' + error.message);
  }
}

// ==================== P2P MASTER DATA ====================

/**
 * Returns the reference data needed exclusively by the Purchase Request flow:
 *   - employees  (Master Employee sheet)
 *   - goods      (Goods-KTT sheet — MOQ catalog)
 *   - suppliers  (Nhà cung cấp sheet — suggested vendor list)
 *
 * Response shape mirrors handleGetMasterData in TLCG_CORE_BACKEND so the
 * purchase_request.html frontend works without any data-mapping changes.
 */
function handleGetP2PMasterData(data) {
  try {
    Logger.log('[P2P] handleGetP2PMasterData called');
    var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);

    // ── Employees (Master Employee) ──────────────────────────
    // Column layout: A=Họ và tên, B=Chức vụ, C=Phòng ban, D=Công ty,
    //                E=Email, F=Điện thoại, G=Status, H=EmployeeId, I=Role, J=isAdmin
    var empSheet = ss.getSheetByName('Master Employee');
    var employees = [];
    if (empSheet) {
      var empVals = empSheet.getDataRange().getValues();
      for (var i = 1; i < empVals.length; i++) {
        var row = empVals[i];
        if (!row[0]) continue; // skip blank rows
        employees.push({
          // Normalized keys — matches what seedRequesters / seedApprovers expect
          full_name:        (row[0] || '').toString().trim(),   // e.full_name || e['Họ và tên']
          'Họ và tên':      (row[0] || '').toString().trim(),
          employee_status:  (row[6] || 'Active').toString().trim(), // e.employee_status || e['Status']
          'Status':         (row[6] || 'Active').toString().trim(),
          department_name:  (row[2] || '').toString().trim(),   // e.department_name || e['Bộ phận']
          'Bộ phận':        (row[2] || '').toString().trim(),
          employee_email:   (row[4] || '').toString().trim(),   // e.employee_email || e['Email']
          'Email':          (row[4] || '').toString().trim(),
          company:          (row[3] || '').toString().trim(),
          position:         (row[1] || '').toString().trim(),
          phone:            (row[5] || '').toString().trim(),
          employeeId:       (row[7] || '').toString().trim(),
          role:             (row[8] || '').toString().trim(),
        });
      }
      Logger.log('[P2P] Master Employee records: ' + employees.length);
    } else {
      Logger.log('[P2P] ⚠️ Sheet "Master Employee" not found');
    }

    // ── Goods catalog (Goods-KTT) ────────────────────────────
    var goodsSheet = ss.getSheetByName('Goods-KTT');
    var goods = [];
    if (goodsSheet) {
      var gVals    = goodsSheet.getDataRange().getValues();
      var gHeaders = gVals[0];
      goods = gVals.slice(1).map(function(row) {
        var obj = {};
        gHeaders.forEach(function(h, i) { obj[h] = row[i]; });
        return obj;
      }).filter(function(r) { return r[gHeaders[0]]; });
      Logger.log('[P2P] Goods-KTT records: ' + goods.length);
    } else {
      Logger.log('[P2P] ⚠️ Sheet "Goods-KTT" not found');
    }

    // ── Suppliers (Nhà cung cấp) ─────────────────────────────
    var supSheet = ss.getSheetByName(CONFIG.SUPPLIERS_SHEET_NAME);
    var suppliers = [];
    if (supSheet) {
      var sVals    = supSheet.getDataRange().getValues();
      var sHeaders = sVals[0];
      suppliers = sVals.slice(1).map(function(row) {
        var obj = {};
        sHeaders.forEach(function(h, i) { obj[h] = row[i]; });
        return obj;
      });
      Logger.log('[P2P] Suppliers records: ' + suppliers.length);
    } else {
      Logger.log('[P2P] ⚠️ Sheet "' + CONFIG.SUPPLIERS_SHEET_NAME + '" not found');
    }

    Logger.log('[P2P] ✅ getP2PMasterData success');
    return createResponse(true, 'P2P master data fetched successfully', {
      employees: employees,
      goods:     goods,
      suppliers: suppliers,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    Logger.log('[P2P] ❌ ERROR in handleGetP2PMasterData: ' + error.toString());
    return createResponse(false, 'Lỗi: ' + error.message);
  }
}

// ==================== PURCHASE REQUEST (ĐỀ NGHỊ MUA HÀNG) ====================

/**
 * Sheet: Purchase_Request_History
 * Columns: A=PR No, B=Company, C=Company Key, D=Department, E=Requester Name,
 *          F=Required Date, G=Priority, H=Purpose, I=Suggested Vendor,
 *          J=Budget Code, K=Budget Approver Email, L=Supplier Approver Email,
 *          M=Items (JSON), N=Grand Total, O=Status, P=Submitted At, Q=Metadata (JSON)
 */
var PR_SHEET_NAME = 'Purchase_Request_History';

function handlePurchaseRequest(data) {
  try {
    Logger.log('[P2P] handlePurchaseRequest called');

    // Validate required fields
    var prNo         = (data.prNo          || '').toString().trim();
    var companyName  = (data.companyName   || '').toString().trim();
    var requesterName = (data.requesterName || '').toString().trim();
    var requiredDate = (data.requiredDate  || '').toString().trim();
    var items        = (data.items         || '[]').toString();
    var grandTotal   = parseFloat(data.grandTotal) || 0;

    if (!companyName)   return createResponse(false, 'Thiếu tên công ty.');
    if (!requesterName) return createResponse(false, 'Thiếu tên người đề nghị.');
    if (!requiredDate)  return createResponse(false, 'Thiếu ngày cần hàng.');
    if (!(data.budgetApprover || '').toString().trim())
      return createResponse(false, 'Vui lòng chọn người phê duyệt ngân sách.');
    if (!(data.supplierApprover || '').toString().trim())
      return createResponse(false, 'Vui lòng chọn người phê duyệt NCC.');

    // Parse items to validate JSON
    var parsedItems;
    try {
      parsedItems = JSON.parse(items);
    } catch (e) {
      return createResponse(false, 'Dữ liệu hàng hóa không hợp lệ: ' + e.message);
    }
    if (!Array.isArray(parsedItems) || parsedItems.length === 0) {
      return createResponse(false, 'Vui lòng nhập ít nhất 1 hàng hóa / dịch vụ.');
    }

    // Generate PR No if not provided (safety fallback — frontend usually provides it)
    if (!prNo) {
      var now = new Date();
      var dateStr = Utilities.formatDate(now, 'Asia/Ho_Chi_Minh', 'yyyyMMdd');
      prNo = 'PR-' + dateStr + '-' + Math.floor(Math.random() * 100000).toString().padStart(6, '0');
    }

    var submittedAt = data.submittedAt || new Date().toISOString();

    // Upload base64 attachments to Drive via DriveApp (never /api/drive-upload — no SA quota)
    // Folder ID sourced from Script Property 'PURCHASE_REQUEST_FOLDER_ID' — same pattern as
    // uploadFilesToDrive_ in TLCG_CASH_BACKEND.gs uses 'DRIVE_VOUCHER_FOLDER_ID'.
    var attachmentRecords = [];
    try {
      // data.attachments may be an array (when sent inside the data JSON wrapper) or a
      // JSON string (legacy flat-param path). Handle both.
      var rawAttachments = Array.isArray(data.attachments)
        ? data.attachments
        : (typeof data.attachments === 'string' ? JSON.parse(data.attachments || '[]') : []);
      rawAttachments = rawAttachments || [];
      if (rawAttachments.length > 0) {
        var PR_DRIVE_FOLDER_ID = getCfg_('PURCHASE_REQUEST_FOLDER_ID', '1SJ-pUa6jg2rmJTzle-TvvSNrKMUduvx3');
        var parentFolder;
        try {
          parentFolder = DriveApp.getFolderById(PR_DRIVE_FOLDER_ID);
        } catch (folderErr) {
          Logger.log('[P2P] ❌ Cannot access PR Drive folder ' + PR_DRIVE_FOLDER_ID + ': ' + folderErr.message);
          attachmentRecords = rawAttachments.map(function(f) {
            return { fileName: f.fileName, fileUrl: '', error: folderErr.message };
          });
          throw folderErr; // skip per-file loop; caught by outer try/catch
        }
        var subFolder = parentFolder.getFoldersByName(CONFIG.DRIVE_FOLDER_NAME).hasNext()
          ? parentFolder.getFoldersByName(CONFIG.DRIVE_FOLDER_NAME).next()
          : parentFolder.createFolder(CONFIG.DRIVE_FOLDER_NAME);
        var prFolder = subFolder.getFoldersByName(prNo).hasNext()
          ? subFolder.getFoldersByName(prNo).next()
          : subFolder.createFolder(prNo);
        Logger.log('[P2P] 📁 PR Drive folder ready: ' + prFolder.getId());
        rawAttachments.forEach(function(f) {
          try {
            if (!f.fileData) return;
            var b64 = f.fileData.includes(',') ? f.fileData.split(',')[1] : f.fileData;
            var mime = f.mimeType || 'application/octet-stream';
            var blob = Utilities.newBlob(Utilities.base64Decode(b64), mime, f.fileName || 'attachment');
            var driveFile = prFolder.createFile(blob);
            try { driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch(shareErr) {
              Logger.log('[P2P] ⚠️ setSharing failed for ' + (f.fileName || '?') + ': ' + shareErr.message);
            }
            attachmentRecords.push({ fileName: f.fileName, fileUrl: driveFile.getUrl() });
            Logger.log('[P2P] ✅ Uploaded attachment: ' + f.fileName);
          } catch (fe) {
            Logger.log('[P2P] ⚠️ Could not upload ' + (f.fileName || '?') + ': ' + fe.message);
            attachmentRecords.push({ fileName: f.fileName, fileUrl: '', error: fe.message });
          }
        });
      }
    } catch (ae) {
      Logger.log('[P2P] ⚠️ Attachment parse/upload error: ' + ae.message);
    }

    var metadata = {
      companyCode:           data.companyCode          || '',
      companyKey:            data.companyKey            || '',
      requesterEmail:        data.requesterEmail        || '',
      budgetApproverNote:    data.budgetApproverNote    || '',
      supplierApproverNote:  data.supplierApproverNote  || '',
      submittedAt:           submittedAt,
      requesterSignature:    data.requesterSignature    || '',
      attachments:           attachmentRecords,
      // Per-role approval statuses — only set for assigned roles
      budgetStatus:    (data.budgetApprover    || '').trim() ? 'Pending' : 'N/A',
      supplierStatus:  (data.supplierApprover  || '').trim() ? 'Pending' : 'N/A',
      contractStatus:  (data.contractApprover  || '').trim() ? 'Pending' : 'N/A',
      purchasingStatus: (data.purchasingApprover || '').trim() ? 'Pending' : 'N/A',
      vendorDetails: {
        vendorType:         data.vendorType          || '',
        vendorTaxId:        data.vendorTaxId         || '',
        vendorAddress:      data.vendorAddress       || '',
        vendorAccountName:  data.vendorAccountName   || '',
        vendorAccountNo:    data.vendorAccountNo     || '',
        vendorBankName:     data.vendorBankName      || '',
        vendorTransferNote: data.vendorTransferNote  || ''
      }
    };

    // Build comma-separated Drive URLs from successfully uploaded attachments
    var attachmentUrlsStr = attachmentRecords
      .filter(function(r) { return r.fileUrl; })
      .map(function(r) { return r.fileUrl; })
      .join(', ');

    var ss    = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    var sheet = ss.getSheetByName(PR_SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(PR_SHEET_NAME);
      sheet.appendRow([
        'PR No', 'Company', 'Company Key', 'Department', 'Requester Name',
        'Required Date', 'Priority', 'Purpose', 'Suggested Vendor', 'Budget Code',
        'Budget Approver Email', 'Supplier Approver Email',
        'Items (JSON)', 'Grand Total', 'Status', 'Submitted At', 'Metadata (JSON)',
        'Contract Approver Email', 'Purchasing Approver Email', 'Attachment URLs'
      ]);
      Logger.log('[P2P] Created sheet: ' + PR_SHEET_NAME);
    } else {
      // Ensure new columns exist on an existing sheet (migration-safe)
      var headerRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      var expectedHeaders = [
        /*0*/'PR No', /*1*/'Company', /*2*/'Company Key', /*3*/'Department', /*4*/'Requester Name',
        /*5*/'Required Date', /*6*/'Priority', /*7*/'Purpose', /*8*/'Suggested Vendor', /*9*/'Budget Code',
        /*10*/'Budget Approver Email', /*11*/'Supplier Approver Email',
        /*12*/'Items (JSON)', /*13*/'Grand Total', /*14*/'Status', /*15*/'Submitted At', /*16*/'Metadata (JSON)',
        /*17*/'Contract Approver Email', /*18*/'Purchasing Approver Email', /*19*/'Attachment URLs'
      ];
      for (var hi = headerRow.length; hi < expectedHeaders.length; hi++) {
        sheet.getRange(1, hi + 1).setValue(expectedHeaders[hi]);
        Logger.log('[P2P] Added missing column: ' + expectedHeaders[hi]);
      }
    }

    sheet.appendRow([
      prNo,
      companyName,
      data.companyKey        || '',
      data.department        || '',
      requesterName,
      requiredDate,
      (function(p) {
        var m = { gap: 'Gấp', binh_thuong: 'Bình Thường', khong_gap: 'Không Gấp',
                  high: 'Gấp', medium: 'Bình Thường', low: 'Không Gấp' };
        return m[p] || p || 'Bình Thường';
      })(data.priority),
      data.purpose           || '',
      data.vendorName        || data.suggestedVendor || '',
      data.budgetCode        || '',
      data.budgetApprover    || '',
      data.supplierApprover  || '',
      items,
      grandTotal,
      'Đang duyệt ngân sách & NCC (2/5)',
      submittedAt,
      JSON.stringify(metadata),
      data.contractApprover  || '',   // index 17 / col R
      data.purchasingApprover || '',  // index 18 / col S
      attachmentUrlsStr              // index 19 / col T
    ]);

    Logger.log('[P2P] ✅ Purchase request saved: ' + prNo);
    SpreadsheetApp.flush();

    // Send email notifications (non-blocking — failures must not break submission)
    try {
      sendPurchaseRequestEmails_(data, prNo, attachmentRecords);
    } catch (emailErr) {
      Logger.log('[P2P] ⚠️ Email notification error (non-fatal): ' + emailErr.message);
    }

    return createResponse(true, 'Đề nghị mua hàng đã được gửi thành công.', { prNo: prNo });

  } catch (error) {
    Logger.log('[P2P] ❌ ERROR in handlePurchaseRequest: ' + error.toString());
    Logger.log('[P2P] Stack: ' + error.stack);
    return createResponse(false, 'Lỗi khi lưu đề nghị mua hàng: ' + error.message);
  }
}

function sendPurchaseRequestEmails_(data, prNo, attachmentRecords) {
  attachmentRecords = attachmentRecords || [];
  var subject = '[ĐỀ NGHỊ MUA HÀNG] Yêu cầu phê duyệt - ' + prNo;
  var grandTotalFmt = (parseFloat(data.grandTotal) || 0).toLocaleString('vi-VN') + ' ₫';
  var requiredDate  = data.requiredDate || '—';
  var companyName   = data.companyName  || '—';
  var requesterName = data.requesterName || '—';
  var purpose       = data.purpose      || '—';

  // Build attachment links HTML
  var attachHtml = '';
  if (attachmentRecords && attachmentRecords.length > 0) {
    var links = attachmentRecords.filter(function(r){ return r.fileUrl; }).map(function(r){
      return '<li><a href="' + r.fileUrl + '">' + r.fileName + '</a></li>';
    }).join('');
    if (links) attachHtml = '<br><b>Tệp đính kèm:</b><ul>' + links + '</ul>';
  }

  // --- Approver email: Budget + Supplier only on submit (Contract/Purchasing notified when their stage opens) ---
  var approverBody = '<p>Kính gửi,</p>'
    + '<p>Có một <b>Đề nghị mua hàng</b> mới đang chờ phê duyệt của bạn.</p>'
    + '<table cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-size:13px;">'
    + '<tr><td style="font-weight:700;padding-right:16px;">Số phiếu:</td><td>' + prNo + '</td></tr>'
    + '<tr><td style="font-weight:700;padding-right:16px;">Công ty:</td><td>' + companyName + '</td></tr>'
    + '<tr><td style="font-weight:700;padding-right:16px;">Người đề nghị:</td><td>' + requesterName + '</td></tr>'
    + '<tr><td style="font-weight:700;padding-right:16px;">Mục đích:</td><td>' + purpose + '</td></tr>'
    + '<tr><td style="font-weight:700;padding-right:16px;">Tổng cộng:</td><td>' + grandTotalFmt + '</td></tr>'
    + '<tr><td style="font-weight:700;padding-right:16px;">Ngày cần hàng:</td><td>' + requiredDate + '</td></tr>'
    + '</table>'
    + '<p style="margin-top:16px;">Vui lòng đăng nhập vào hệ thống để xem chi tiết và phê duyệt.</p>'
    + attachHtml
    + '<p>Trân trọng,<br>Hệ thống Workflow TLC Group</p>';

  [data.budgetApprover, data.supplierApprover].forEach(function(email) {
    if (!email) return;
    try {
      GmailApp.sendEmail(email, subject, '', { htmlBody: approverBody, name: 'TLC Group Workflow' });
      Logger.log('[P2P] ✅ Approver email sent to: ' + email);
    } catch (e) {
      Logger.log('[P2P] ⚠️ Failed to send approver email to ' + email + ': ' + e.message);
    }
  });

  // --- Requester confirmation email ---
  var requesterEmail = data.requesterEmail || '';
  if (requesterEmail) {
    var requesterBody = '<p>Kính gửi ' + requesterName + ',</p>'
      + '<p>Đề nghị mua hàng của bạn đã được gửi thành công và đang chờ phê duyệt.</p>'
      + '<table cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-size:13px;">'
      + '<tr><td style="font-weight:700;padding-right:16px;">Số phiếu:</td><td>' + prNo + '</td></tr>'
      + '<tr><td style="font-weight:700;padding-right:16px;">Công ty:</td><td>' + companyName + '</td></tr>'
      + '<tr><td style="font-weight:700;padding-right:16px;">Mục đích:</td><td>' + purpose + '</td></tr>'
      + '<tr><td style="font-weight:700;padding-right:16px;">Tổng cộng:</td><td>' + grandTotalFmt + '</td></tr>'
      + '<tr><td style="font-weight:700;padding-right:16px;">Ngày cần hàng:</td><td>' + requiredDate + '</td></tr>'
      + '</table>'
      + '<p style="margin-top:16px;">Người phê duyệt đã được thông báo qua email. Bạn sẽ nhận được thông báo khi phiếu được xử lý.</p>'
      + attachHtml
      + '<p>Trân trọng,<br>Hệ thống Workflow TLC Group</p>';
    try {
      GmailApp.sendEmail(requesterEmail, '[ĐỀ NGHỊ MUA HÀNG] Xác nhận gửi phiếu - ' + prNo, '', {
        htmlBody: requesterBody, name: 'TLC Group Workflow'
      });
      Logger.log('[P2P] ✅ Requester confirmation email sent to: ' + requesterEmail);
    } catch (e) {
      Logger.log('[P2P] ⚠️ Failed to send requester email to ' + requesterEmail + ': ' + e.message);
    }
  }
}

/**
 * Sends a stage-activation email to a single approver when their stage becomes active.
 * row: the sheet row array (0-based indices)
 * stage: 'contract' | 'purchasing'
 */
function sendPurchaseRequestStageEmail_(row, prNo, stage) {
  var stageEmailMap = { contract: 17, purchasing: 18 };
  var stageLabelMap = { contract: 'Thẩm định Hợp đồng', purchasing: 'Mua hàng' };
  var recipientEmail = (row[stageEmailMap[stage]] || '').toString().trim();
  if (!recipientEmail) return;

  var companyName   = (row[1]  || '').toString();
  var requesterName = (row[4]  || '').toString();
  var purpose       = (row[7]  || '').toString();
  var grandTotal    = parseFloat(row[13]) || 0;
  var requiredDate  = (row[5]  || '').toString();
  var grandTotalFmt = grandTotal.toLocaleString('vi-VN') + ' ₫';

  var subject = '[ĐỀ NGHỊ MUA HÀNG] Yêu cầu ' + stageLabelMap[stage] + ' - ' + prNo;
  var body = '<p>Kính gửi,</p>'
    + '<p>Giai đoạn <b>' + stageLabelMap[stage] + '</b> của Đề nghị mua hàng đã mở và đang chờ xử lý của bạn.</p>'
    + '<table cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-size:13px;">'
    + '<tr><td style="font-weight:700;padding-right:16px;">Số phiếu:</td><td>' + prNo + '</td></tr>'
    + '<tr><td style="font-weight:700;padding-right:16px;">Công ty:</td><td>' + companyName + '</td></tr>'
    + '<tr><td style="font-weight:700;padding-right:16px;">Người đề nghị:</td><td>' + requesterName + '</td></tr>'
    + '<tr><td style="font-weight:700;padding-right:16px;">Mục đích:</td><td>' + purpose + '</td></tr>'
    + '<tr><td style="font-weight:700;padding-right:16px;">Tổng cộng:</td><td>' + grandTotalFmt + '</td></tr>'
    + '<tr><td style="font-weight:700;padding-right:16px;">Ngày cần hàng:</td><td>' + requiredDate + '</td></tr>'
    + '</table>'
    + '<p style="margin-top:16px;">Vui lòng đăng nhập vào hệ thống để xem chi tiết và phê duyệt.</p>'
    + '<p>Trân trọng,<br>Hệ thống Workflow TLC Group</p>';

  GmailApp.sendEmail(recipientEmail, subject, '', { htmlBody: body, name: 'TLC Group Workflow' });
  Logger.log('[P2P] ✅ Stage email (' + stage + ') sent to: ' + recipientEmail);
}

/**
 * Notifies the requester when a PR reaches Hoàn thành.
 * row: sheet row, prNo: PR number, metadata: parsed metadata object.
 */
function sendPurchaseRequestCompletionEmail_(row, prNo, metadata) {
  var requesterEmail = (metadata.requesterEmail || '').toString().trim();
  // Fall back to metadata if present; requesterEmail was not saved in the row directly
  if (!requesterEmail) return;

  var requesterName = (row[4]  || '').toString();
  var companyName   = (row[1]  || '').toString();
  var subject = '[ĐỀ NGHỊ MUA HÀNG] Phiếu đã hoàn thành - ' + prNo;
  var body = '<p>Kính gửi ' + requesterName + ',</p>'
    + '<p>Đề nghị mua hàng <b>' + prNo + '</b> của bạn đã được <b>phê duyệt hoàn tất</b>.</p>'
    + '<p>Công ty: ' + companyName + '</p>'
    + '<p>Trân trọng,<br>Hệ thống Workflow TLC Group</p>';

  GmailApp.sendEmail(requesterEmail, subject, '', { htmlBody: body, name: 'TLC Group Workflow' });
  Logger.log('[P2P] ✅ Completion email sent to: ' + requesterEmail);
}

function handleGetPurchaseRequestHistory(data) {
  try {
    Logger.log('[P2P] handleGetPurchaseRequestHistory called');

    var ss    = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    var sheet = ss.getSheetByName(PR_SHEET_NAME);
    if (!sheet || sheet.getLastRow() <= 1) {
      return createResponse(true, 'Thành công', { requests: [] });
    }

    var values  = sheet.getDataRange().getValues();
    var headers = values[0];
    var rows    = values.slice(1);

    // Optional filter: requester name
    var filterRequester = (data.requesterName || '').toString().trim().toLowerCase();

    var requests = rows
      .filter(function(row) {
        if (!row[0]) return false; // skip empty PR No
        if (filterRequester && (row[4] || '').toString().toLowerCase() !== filterRequester) return false;
        return true;
      })
      .map(function(row) {
        return {
          prNo:               row[0]  || '',
          company:            row[1]  || '',
          department:         row[3]  || '',
          requesterName:      row[4]  || '',
          requiredDate:       row[5]  || '',
          priority:           row[6]  || '',
          purpose:            row[7]  || '',
          suggestedVendor:    row[8]  || '',
          budgetCode:         row[9]  || '',
          budgetApprover:     row[10] || '',
          supplierApprover:   row[11] || '',
          items:              row[12] || '[]',
          grandTotal:         row[13] || 0,
          status:             row[14] || '',
          submittedAt:        row[15] || '',
          metadata:           row[16] || '{}',
          contractApprover:   row[17] || '',
          purchasingApprover: row[18] || '',
          attachmentUrls:     row[19] || ''
        };
      })
      .reverse(); // newest first

    Logger.log('[P2P] ✅ Returning ' + requests.length + ' purchase requests');
    return createResponse(true, 'Thành công', { requests: requests });

  } catch (error) {
    Logger.log('[P2P] ❌ ERROR in handleGetPurchaseRequestHistory: ' + error.toString());
    return createResponse(false, 'Lỗi: ' + error.message);
  }
}

// ==================== APPROVAL STATE HELPER ====================

/**
 * Derives the active stage and computed sheet status string from the row data.
 *
 * Stages (in order):
 *   1. parallel  — Budget and/or Supplier acting simultaneously.
 *                  Exits when ALL assigned parallel roles are Approved.
 *   2. contract  — Only when a contract approver is assigned and parallel is done.
 *   3. purchasing — Only when a purchasing approver is assigned and contract is done/skipped.
 *   4. complete  — All required steps done.
 *
 * Returns: { stage, statusLabel, budgetEmail, supplierEmail, contractEmail, purchasingEmail }
 */
function computePRApprovalState_(row, metadata) {
  var budgetEmail    = (row[10] || '').toString().toLowerCase().trim();
  var supplierEmail  = (row[11] || '').toString().toLowerCase().trim();
  var contractEmail  = (row[17] || '').toString().toLowerCase().trim();
  var purchasingEmail = (row[18] || '').toString().toLowerCase().trim();

  var budgetDone    = !budgetEmail    || metadata.budgetStatus    === 'Approved';
  var supplierDone  = !supplierEmail  || metadata.supplierStatus  === 'Approved';
  var contractDone  = !contractEmail  || metadata.contractStatus  === 'Approved';
  var purchasingDone = !purchasingEmail || metadata.purchasingStatus === 'Approved';

  // Parallel stage: either budget or supplier is assigned but not yet approved
  var parallelComplete = budgetDone && supplierDone;

  var stage;
  var statusLabel;

  if (!parallelComplete) {
    stage = 'parallel';
    statusLabel = 'Đang duyệt ngân sách & NCC (2/5)';
  } else if (contractEmail && !contractDone) {
    stage = 'contract';
    statusLabel = 'Thẩm định Hợp đồng (4/5)';
  } else if (purchasingEmail && !purchasingDone) {
    stage = 'purchasing';
    statusLabel = 'Mua hàng (5/5)';
  } else {
    stage = 'complete';
    statusLabel = 'Hoàn thành';
  }

  return {
    stage:          stage,
    statusLabel:    statusLabel,
    budgetEmail:    budgetEmail,
    supplierEmail:  supplierEmail,
    contractEmail:  contractEmail,
    purchasingEmail: purchasingEmail,
    parallelComplete: parallelComplete,
    contractDone:   contractDone
  };
}

// ==================== APPROVE PURCHASE REQUEST ====================

function handleApprovePurchaseRequest(data) {
  try {
    var prNo          = (data.prNo          || '').toString().trim();
    var approverEmail = (data.approverEmail || '').toString().trim().toLowerCase();
    var approverRole  = (data.approverRole  || '').toString().trim(); // 'budget' | 'supplier' | 'contract' | 'purchasing'
    var note          = (data.note          || '').toString().trim();

    if (!prNo)          return createResponse(false, 'Thiếu số phiếu mua hàng.');
    if (!approverEmail) return createResponse(false, 'Thiếu email người duyệt.');

    var validRoles = ['budget', 'supplier', 'contract', 'purchasing'];
    if (validRoles.indexOf(approverRole) === -1) {
      return createResponse(false, 'Vai trò không hợp lệ. Phải là "budget", "supplier", "contract" hoặc "purchasing".');
    }

    var ss    = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    var sheet = ss.getSheetByName(PR_SHEET_NAME);
    if (!sheet) return createResponse(false, 'Không tìm thấy sheet Purchase_Request_History.');

    var values   = sheet.getDataRange().getValues();
    var rowIndex = -1;
    for (var i = 1; i < values.length; i++) {
      if ((values[i][0] || '').toString().trim() === prNo) { rowIndex = i; break; }
    }
    if (rowIndex === -1) return createResponse(false, 'Không tìm thấy đề nghị: ' + prNo);

    var row           = values[rowIndex];
    var currentStatus = (row[14] || '').toString();

    if (currentStatus === 'Đã từ chối' || currentStatus === 'Rejected') {
      return createResponse(false, 'Đề nghị này đã bị từ chối, không thể duyệt.');
    }
    if (currentStatus === 'Hoàn thành' || currentStatus === 'Approved') {
      return createResponse(false, 'Đề nghị này đã được duyệt rồi.');
    }
    if (currentStatus === 'Trả lại bổ sung') {
      return createResponse(false, 'Phiếu đang chờ người đề nghị bổ sung thông tin, không thể duyệt.');
    }

    // Verify email matches the assigned column for this role
    var approverColMap = { budget: 10, supplier: 11, contract: 17, purchasing: 18 };
    var assignedEmail = (row[approverColMap[approverRole]] || '').toString().toLowerCase().trim();
    if (!assignedEmail) {
      return createResponse(false, 'Vai trò "' + approverRole + '" chưa được phân công cho đề nghị này.');
    }
    if (approverEmail !== assignedEmail) {
      return createResponse(false, 'Bạn không được phân công là người duyệt "' + approverRole + '" cho đề nghị này.');
    }

    var metadata;
    try { metadata = JSON.parse(row[16] || '{}'); } catch (e) { metadata = {}; }

    // Gate check: verify role is in the currently active stage
    var stateBeforeApprove = computePRApprovalState_(row, metadata);
    var activeStage = stateBeforeApprove.stage;

    var roleStage = (approverRole === 'budget' || approverRole === 'supplier')
      ? 'parallel'
      : approverRole; // 'contract' | 'purchasing'

    if (roleStage !== activeStage) {
      var stageNames = { parallel: 'duyệt ngân sách & NCC', contract: 'thẩm định hợp đồng', purchasing: 'mua hàng' };
      return createResponse(false,
        'Chưa đến lượt duyệt của bạn. Giai đoạn hiện tại: ' + (stageNames[activeStage] || activeStage) + '.'
      );
    }

    // Check role is not already approved
    if (metadata[approverRole + 'Status'] === 'Approved') {
      return createResponse(false, 'Bạn đã duyệt đề nghị này rồi.');
    }

    var now = new Date().toISOString();
    metadata[approverRole + 'Status']     = 'Approved';
    metadata[approverRole + 'ApprovedAt'] = now;
    metadata[approverRole + 'Note']       = note;

    // Store approver signature and verification result if provided
    if (data.approverSignature) {
      metadata[approverRole + 'Signature'] = data.approverSignature;
    }
    if (data.signatureVerification) {
      try {
        metadata[approverRole + 'SignatureVerification'] = JSON.parse(data.signatureVerification);
      } catch(e) {
        metadata[approverRole + 'SignatureVerification'] = { raw: data.signatureVerification };
      }
    }

    // Compute new state after this approval
    var stateAfter = computePRApprovalState_(row, metadata);
    var newStatus  = stateAfter.statusLabel;

    sheet.getRange(rowIndex + 1, 15).setValue(newStatus);
    sheet.getRange(rowIndex + 1, 17).setValue(JSON.stringify(metadata));
    SpreadsheetApp.flush();

    Logger.log('[P2P] ✅ PR approved: ' + prNo + ' role=' + approverRole + ' newStatus=' + newStatus);

    // Stage transition emails: notify the next stage approver when their stage opens
    if (stateAfter.stage === 'contract' && stateBeforeApprove.stage === 'parallel') {
      // Parallel just completed → notify contract approver
      try {
        sendPurchaseRequestStageEmail_(row, prNo, 'contract');
      } catch (e) {
        Logger.log('[P2P] ⚠️ Stage email (contract) failed: ' + e.message);
      }
    } else if (stateAfter.stage === 'purchasing' && stateBeforeApprove.stage === 'contract') {
      // Contract just completed → notify purchasing approver
      try {
        sendPurchaseRequestStageEmail_(row, prNo, 'purchasing');
      } catch (e) {
        Logger.log('[P2P] ⚠️ Stage email (purchasing) failed: ' + e.message);
      }
    } else if (stateAfter.stage === 'complete') {
      // All done → notify requester
      try {
        sendPurchaseRequestCompletionEmail_(row, prNo, metadata);
      } catch (e) {
        Logger.log('[P2P] ⚠️ Completion email failed: ' + e.message);
      }
    }

    return createResponse(true, 'Đã duyệt thành công.', { prNo: prNo, status: newStatus });

  } catch (error) {
    Logger.log('[P2P] ❌ ERROR in handleApprovePurchaseRequest: ' + error.toString());
    return createResponse(false, 'Lỗi: ' + error.message);
  }
}

// ==================== REJECT PURCHASE REQUEST ====================

function handleRejectPurchaseRequest(data) {
  try {
    var prNo          = (data.prNo          || '').toString().trim();
    var approverEmail = (data.approverEmail || '').toString().trim().toLowerCase();
    var note          = (data.note          || '').toString().trim();

    if (!prNo)          return createResponse(false, 'Thiếu số phiếu mua hàng.');
    if (!approverEmail) return createResponse(false, 'Thiếu email người từ chối.');

    var ss    = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    var sheet = ss.getSheetByName(PR_SHEET_NAME);
    if (!sheet) return createResponse(false, 'Không tìm thấy sheet Purchase_Request_History.');

    var values   = sheet.getDataRange().getValues();
    var rowIndex = -1;
    for (var i = 1; i < values.length; i++) {
      if ((values[i][0] || '').toString().trim() === prNo) { rowIndex = i; break; }
    }
    if (rowIndex === -1) return createResponse(false, 'Không tìm thấy đề nghị: ' + prNo);

    var row           = values[rowIndex];
    var currentStatus = (row[14] || '').toString();

    var metadata0;
    try { metadata0 = JSON.parse(row[16] || '{}'); } catch (e) { metadata0 = {}; }

    // Only approvers whose role is currently active may reject
    var stateNow = computePRApprovalState_(row, metadata0);
    var activeStage = stateNow.stage;

    // Map email → role for the four possible approvers
    var emailRoleMap = {};
    if (stateNow.budgetEmail)    emailRoleMap[stateNow.budgetEmail]    = 'budget';
    if (stateNow.supplierEmail)  emailRoleMap[stateNow.supplierEmail]  = 'supplier';
    if (stateNow.contractEmail)  emailRoleMap[stateNow.contractEmail]  = 'contract';
    if (stateNow.purchasingEmail) emailRoleMap[stateNow.purchasingEmail] = 'purchasing';

    if (!emailRoleMap[approverEmail]) {
      return createResponse(false, 'Bạn không có quyền từ chối đề nghị này.');
    }

    var rejectRole = emailRoleMap[approverEmail];
    var rejectRoleStage = (rejectRole === 'budget' || rejectRole === 'supplier') ? 'parallel' : rejectRole;
    if (rejectRoleStage !== activeStage) {
      return createResponse(false, 'Chưa đến lượt của bạn trong quy trình phê duyệt.');
    }
    if (currentStatus === 'Đã từ chối' || currentStatus === 'Rejected') {
      return createResponse(false, 'Đề nghị này đã bị từ chối rồi.');
    }
    if (currentStatus === 'Hoàn thành' || currentStatus === 'Approved') {
      return createResponse(false, 'Đề nghị đã được duyệt, không thể từ chối.');
    }
    if (currentStatus === 'Trả lại bổ sung') {
      return createResponse(false, 'Phiếu đang chờ người đề nghị bổ sung thông tin, không thể từ chối.');
    }

    metadata0.rejectedAt    = new Date().toISOString();
    metadata0.rejectedBy    = approverEmail;
    metadata0.rejectionNote = note;

    sheet.getRange(rowIndex + 1, 15).setValue('Đã từ chối');
    sheet.getRange(rowIndex + 1, 17).setValue(JSON.stringify(metadata0));
    SpreadsheetApp.flush();

    Logger.log('[P2P] ✅ PR rejected: ' + prNo + ' by=' + approverEmail);
    return createResponse(true, 'Đã từ chối thành công.', { prNo: prNo, status: 'Đã từ chối' });

  } catch (error) {
    Logger.log('[P2P] ❌ ERROR in handleRejectPurchaseRequest: ' + error.toString());
    return createResponse(false, 'Lỗi: ' + error.message);
  }
}

// ==================== SEND BACK PURCHASE REQUEST ====================

/**
 * Sends a PR back to an earlier step.
 * targetStep=1 → back to submitter (status: Trả lại bổ sung)
 * targetStep=2 → back to Budget+Supplier stage (cascade reset)
 * targetStep=3 → back to Contract stage (cascade reset)
 */
function handleSendBackPurchaseRequest(data) {
  try {
    var prNo          = (data.prNo          || '').toString().trim();
    var approverEmail = (data.approverEmail || '').toString().trim().toLowerCase();
    var approverRole  = (data.approverRole  || '').toString().trim();
    var targetStep    = parseInt(data.targetStep, 10);
    var note          = (data.sentBackNote  || '').toString().trim();

    if (!prNo)          return createResponse(false, 'Thiếu số phiếu mua hàng.');
    if (!approverEmail) return createResponse(false, 'Thiếu email người thực hiện.');
    if (!note)          return createResponse(false, 'Vui lòng nhập lý do trả lại.');
    if (isNaN(targetStep) || targetStep < 1 || targetStep > 3) {
      return createResponse(false, 'Bước trả lại không hợp lệ.');
    }

    var validRoles = ['budget', 'supplier', 'contract', 'purchasing'];
    if (validRoles.indexOf(approverRole) === -1) {
      return createResponse(false, 'Vai trò không hợp lệ.');
    }

    var ss    = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    var sheet = ss.getSheetByName(PR_SHEET_NAME);
    if (!sheet) return createResponse(false, 'Không tìm thấy sheet Purchase_Request_History.');

    var values   = sheet.getDataRange().getValues();
    var rowIndex = -1;
    for (var i = 1; i < values.length; i++) {
      if ((values[i][0] || '').toString().trim() === prNo) { rowIndex = i; break; }
    }
    if (rowIndex === -1) return createResponse(false, 'Không tìm thấy đề nghị: ' + prNo);

    var row           = values[rowIndex];
    var currentStatus = (row[14] || '').toString();

    // Block on terminal/already-returned statuses
    if (currentStatus === 'Đã từ chối' || currentStatus === 'Rejected') {
      return createResponse(false, 'Đề nghị này đã bị từ chối.');
    }
    if (currentStatus === 'Hoàn thành' || currentStatus === 'Approved') {
      return createResponse(false, 'Đề nghị này đã hoàn thành.');
    }
    if (currentStatus === 'Trả lại bổ sung') {
      return createResponse(false, 'Đề nghị này đã được trả lại rồi, đang chờ người đề nghị cập nhật.');
    }

    var metadata;
    try { metadata = JSON.parse(row[16] || '{}'); } catch (e) { metadata = {}; }

    // Active-stage gate: same check as approve/reject
    var stateNow    = computePRApprovalState_(row, metadata);
    var activeStage = stateNow.stage;
    var roleStage   = (approverRole === 'budget' || approverRole === 'supplier') ? 'parallel' : approverRole;
    if (roleStage !== activeStage) {
      return createResponse(false, 'Chưa đến lượt của bạn trong quy trình phê duyệt.');
    }

    // Validate sender email matches the assigned column for their role
    var approverColMap = { budget: 10, supplier: 11, contract: 17, purchasing: 18 };
    var assignedEmail  = (row[approverColMap[approverRole]] || '').toString().toLowerCase().trim();
    if (!assignedEmail || approverEmail !== assignedEmail) {
      return createResponse(false, 'Bạn không được phân công vai trò "' + approverRole + '" cho đề nghị này.');
    }

    // Validate targetStep is reachable from this role
    // budget/supplier → only step 1; contract → 1 or 2; purchasing → 1, 2, or 3
    var maxTarget = { budget: 1, supplier: 1, contract: 2, purchasing: 3 };
    if (targetStep > maxTarget[approverRole]) {
      return createResponse(false, 'Bước trả lại không hợp lệ với vai trò của bạn.');
    }

    var newStatus;
    var rolesToReset = [];

    if (targetStep === 1) {
      newStatus = 'Trả lại bổ sung';
      // Role statuses NOT reset here — preserved for display; reset happens on resubmit
    } else if (targetStep === 2) {
      newStatus    = 'Đang duyệt ngân sách & NCC (2/5)';
      rolesToReset = ['budget', 'supplier', 'contract', 'purchasing'];
    } else if (targetStep === 3) {
      newStatus    = 'Thẩm định Hợp đồng (4/5)';
      rolesToReset = ['contract', 'purchasing'];
    }

    rolesToReset.forEach(function(role) {
      if (metadata[role + 'Status'] && metadata[role + 'Status'] !== 'N/A') {
        metadata[role + 'Status'] = 'Pending';
        delete metadata[role + 'ApprovedAt'];
        delete metadata[role + 'Note'];
      }
    });

    // Append to sentBackHistory (audit log)
    if (!Array.isArray(metadata.sentBackHistory)) metadata.sentBackHistory = [];
    metadata.sentBackHistory.push({
      targetStep: targetStep,
      by:         approverEmail,
      byRole:     approverRole,
      at:         new Date().toISOString(),
      note:       note
    });

    sheet.getRange(rowIndex + 1, 15).setValue(newStatus);
    sheet.getRange(rowIndex + 1, 17).setValue(JSON.stringify(metadata));
    SpreadsheetApp.flush();

    Logger.log('[P2P] ✅ PR sent back: ' + prNo + ' targetStep=' + targetStep + ' by=' + approverEmail);

    try {
      sendPurchaseRequestSendBackEmail_(row, prNo, targetStep, note, approverRole, metadata);
    } catch (emailErr) {
      Logger.log('[P2P] ⚠️ Send-back email failed (non-fatal): ' + emailErr.message);
    }

    return createResponse(true, 'Đã trả lại thành công.', { prNo: prNo, status: newStatus });

  } catch (error) {
    Logger.log('[P2P] ❌ ERROR in handleSendBackPurchaseRequest: ' + error.toString());
    return createResponse(false, 'Lỗi: ' + error.message);
  }
}

// ==================== RESUBMIT PURCHASE REQUEST ====================

/**
 * Called when the submitter re-edits and resubmits a PR that was sent back (targetStep=1).
 * Overwrites the existing row in place and resets the full approval chain.
 */
function handleResubmitPurchaseRequest(data) {
  try {
    var prNo          = (data.prNo          || '').toString().trim();
    var requesterEmail = (data.requesterEmail || '').toString().trim().toLowerCase();

    if (!prNo)           return createResponse(false, 'Thiếu số phiếu mua hàng.');
    if (!requesterEmail) return createResponse(false, 'Thiếu email người đề nghị.');

    var companyName   = (data.companyName   || '').toString().trim();
    var requesterName = (data.requesterName || '').toString().trim();
    var requiredDate  = (data.requiredDate  || '').toString().trim();
    var items         = (data.items         || '[]').toString();
    var grandTotal    = parseFloat(data.grandTotal) || 0;

    if (!companyName)   return createResponse(false, 'Thiếu tên công ty.');
    if (!requesterName) return createResponse(false, 'Thiếu tên người đề nghị.');
    if (!requiredDate)  return createResponse(false, 'Thiếu ngày cần hàng.');
    if (!(data.budgetApprover || '').toString().trim())
      return createResponse(false, 'Vui lòng chọn người phê duyệt ngân sách.');
    if (!(data.supplierApprover || '').toString().trim())
      return createResponse(false, 'Vui lòng chọn người phê duyệt NCC.');

    var parsedItems;
    try { parsedItems = JSON.parse(items); } catch (e) {
      return createResponse(false, 'Dữ liệu hàng hóa không hợp lệ: ' + e.message);
    }
    if (!Array.isArray(parsedItems) || parsedItems.length === 0) {
      return createResponse(false, 'Vui lòng nhập ít nhất 1 hàng hóa / dịch vụ.');
    }

    var ss    = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    var sheet = ss.getSheetByName(PR_SHEET_NAME);
    if (!sheet) return createResponse(false, 'Không tìm thấy sheet Purchase_Request_History.');

    var values   = sheet.getDataRange().getValues();
    var rowIndex = -1;
    for (var i = 1; i < values.length; i++) {
      if ((values[i][0] || '').toString().trim() === prNo) { rowIndex = i; break; }
    }
    if (rowIndex === -1) return createResponse(false, 'Không tìm thấy đề nghị: ' + prNo);

    var row           = values[rowIndex];
    var currentStatus = (row[14] || '').toString();

    if (currentStatus !== 'Trả lại bổ sung') {
      return createResponse(false, 'Chỉ có thể gửi lại khi phiếu ở trạng thái "Trả lại bổ sung".');
    }

    var existingMetadata;
    try { existingMetadata = JSON.parse(row[16] || '{}'); } catch (e) { existingMetadata = {}; }

    // Caller must be the original requester
    var storedRequesterEmail = (existingMetadata.requesterEmail || '').toString().toLowerCase().trim();
    if (storedRequesterEmail && requesterEmail !== storedRequesterEmail) {
      return createResponse(false, 'Bạn không phải người đề nghị ban đầu của phiếu này.');
    }

    // Upload any new attachments to Drive
    var newAttachmentRecords = [];
    try {
      var rawAttachments = Array.isArray(data.attachments)
        ? data.attachments
        : (typeof data.attachments === 'string' ? JSON.parse(data.attachments || '[]') : []);
      rawAttachments = rawAttachments || [];
      var newFiles = rawAttachments.filter(function(f) { return f.fileData; });
      if (newFiles.length > 0) {
        var PR_DRIVE_FOLDER_ID = getCfg_('PURCHASE_REQUEST_FOLDER_ID', '1SJ-pUa6jg2rmJTzle-TvvSNrKMUduvx3');
        var parentFolder = DriveApp.getFolderById(PR_DRIVE_FOLDER_ID);
        var subFolder = parentFolder.getFoldersByName(CONFIG.DRIVE_FOLDER_NAME).hasNext()
          ? parentFolder.getFoldersByName(CONFIG.DRIVE_FOLDER_NAME).next()
          : parentFolder.createFolder(CONFIG.DRIVE_FOLDER_NAME);
        var prFolder = subFolder.getFoldersByName(prNo).hasNext()
          ? subFolder.getFoldersByName(prNo).next()
          : subFolder.createFolder(prNo);
        newFiles.forEach(function(f) {
          try {
            var b64 = f.fileData.includes(',') ? f.fileData.split(',')[1] : f.fileData;
            var mime = f.mimeType || 'application/octet-stream';
            var blob = Utilities.newBlob(Utilities.base64Decode(b64), mime, f.fileName || 'attachment');
            var driveFile = prFolder.createFile(blob);
            try { driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch(e) {}
            newAttachmentRecords.push({ fileName: f.fileName, fileUrl: driveFile.getUrl() });
          } catch (fe) {
            Logger.log('[P2P] ⚠️ Resubmit attachment upload failed: ' + fe.message);
            newAttachmentRecords.push({ fileName: f.fileName, fileUrl: '', error: fe.message });
          }
        });
      }
      // Preserve existing attachments passed back from frontend (no fileData = already uploaded)
      rawAttachments.filter(function(f) { return !f.fileData && f.fileUrl; }).forEach(function(f) {
        newAttachmentRecords.push({ fileName: f.fileName, fileUrl: f.fileUrl });
      });
    } catch (ae) {
      Logger.log('[P2P] ⚠️ Resubmit attachment error: ' + ae.message);
    }

    var priorityMap = { gap: 'Gấp', binh_thuong: 'Bình Thường', khong_gap: 'Không Gấp',
                        high: 'Gấp', medium: 'Bình Thường', low: 'Không Gấp' };

    var attachmentUrlsStr = newAttachmentRecords
      .filter(function(r) { return r.fileUrl; })
      .map(function(r) { return r.fileUrl; })
      .join(', ');

    // Build new metadata — reset all approval state but preserve history + identity fields
    var newMetadata = {
      companyCode:          data.companyCode          || existingMetadata.companyCode          || '',
      companyKey:           data.companyKey           || existingMetadata.companyKey           || '',
      requesterEmail:       requesterEmail,
      budgetApproverNote:   data.budgetApproverNote   || '',
      supplierApproverNote: data.supplierApproverNote || '',
      submittedAt:          existingMetadata.submittedAt || new Date().toISOString(),
      resubmittedAt:        new Date().toISOString(),
      resubmitCount:        (parseInt(existingMetadata.resubmitCount, 10) || 0) + 1,
      requesterSignature:   data.requesterSignature   || '',
      attachments:          newAttachmentRecords,
      budgetStatus:    (data.budgetApprover    || '').trim() ? 'Pending' : 'N/A',
      supplierStatus:  (data.supplierApprover  || '').trim() ? 'Pending' : 'N/A',
      contractStatus:  (data.contractApprover  || '').trim() ? 'Pending' : 'N/A',
      purchasingStatus:(data.purchasingApprover|| '').trim() ? 'Pending' : 'N/A',
      vendorDetails: {
        vendorType:         data.vendorType         || '',
        vendorTaxId:        data.vendorTaxId        || '',
        vendorAddress:      data.vendorAddress      || '',
        vendorAccountName:  data.vendorAccountName  || '',
        vendorAccountNo:    data.vendorAccountNo    || '',
        vendorBankName:     data.vendorBankName     || '',
        vendorTransferNote: data.vendorTransferNote || ''
      },
      sentBackHistory: existingMetadata.sentBackHistory || []
    };

    // Overwrite the full row in place (all 20 columns)
    sheet.getRange(rowIndex + 1, 1, 1, 20).setValues([[
      prNo,
      companyName,
      data.companyKey         || '',
      data.department         || '',
      requesterName,
      requiredDate,
      priorityMap[data.priority] || data.priority || 'Bình Thường',
      data.purpose            || '',
      data.vendorName         || data.suggestedVendor || '',
      data.budgetCode         || '',
      data.budgetApprover     || '',
      data.supplierApprover   || '',
      items,
      grandTotal,
      'Đang duyệt ngân sách & NCC (2/5)',
      existingMetadata.submittedAt || new Date().toISOString(),
      JSON.stringify(newMetadata),
      data.contractApprover   || '',
      data.purchasingApprover || '',
      attachmentUrlsStr
    ]]);
    SpreadsheetApp.flush();

    Logger.log('[P2P] ✅ PR resubmitted: ' + prNo + ' resubmitCount=' + newMetadata.resubmitCount);

    try {
      sendPurchaseRequestResubmitEmails_(prNo, data, newAttachmentRecords);
    } catch (emailErr) {
      Logger.log('[P2P] ⚠️ Resubmit email failed (non-fatal): ' + emailErr.message);
    }

    return createResponse(true, 'Đã gửi lại đề nghị thành công.', { prNo: prNo });

  } catch (error) {
    Logger.log('[P2P] ❌ ERROR in handleResubmitPurchaseRequest: ' + error.toString());
    return createResponse(false, 'Lỗi: ' + error.message);
  }
}

// ==================== SEND-BACK EMAIL HELPERS ====================

/**
 * Sends notification emails when a PR is sent back to an earlier step.
 * targetStep=1 → email to requester
 * targetStep=2 → email to budget + supplier approvers
 * targetStep=3 → email to contract approver
 */
function sendPurchaseRequestSendBackEmail_(row, prNo, targetStep, note, senderRole, metadata) {
  var companyName   = (row[1]  || '').toString();
  var requesterName = (row[4]  || '').toString();
  var purpose       = (row[7]  || '').toString();
  var grandTotal    = (parseFloat(row[13]) || 0).toLocaleString('vi-VN') + ' ₫';

  var senderRoleLabel = {
    budget: 'Người duyệt Ngân sách', supplier: 'Người duyệt NCC',
    contract: 'Người thẩm định Hợp đồng', purchasing: 'Người mua hàng'
  }[senderRole] || senderRole;

  var infoTable = '<table cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-size:13px;">'
    + '<tr><td style="font-weight:700;padding-right:16px;">Số phiếu:</td><td>' + prNo + '</td></tr>'
    + '<tr><td style="font-weight:700;padding-right:16px;">Công ty:</td><td>' + companyName + '</td></tr>'
    + '<tr><td style="font-weight:700;padding-right:16px;">Người đề nghị:</td><td>' + requesterName + '</td></tr>'
    + '<tr><td style="font-weight:700;padding-right:16px;">Mục đích:</td><td>' + purpose + '</td></tr>'
    + '<tr><td style="font-weight:700;padding-right:16px;">Tổng cộng:</td><td>' + grandTotal + '</td></tr>'
    + '</table>';

  var noteBox = '<div style="background:#fffbeb;border-left:4px solid #f59e0b;padding:10px 14px;margin:14px 0;border-radius:4px;">'
    + '<b>Lý do trả lại:</b><br>' + note
    + '</div>';

  if (targetStep === 1) {
    // Notify requester
    var recipientEmail = (metadata.requesterEmail || '').toString().trim();
    if (!recipientEmail) return;
    var subject = '[ĐỀ NGHỊ MUA HÀNG] Phiếu được trả lại để bổ sung - ' + prNo;
    var body = '<p>Kính gửi ' + requesterName + ',</p>'
      + '<p>Phiếu đề nghị mua hàng <b>' + prNo + '</b> đã được <b>' + senderRoleLabel + '</b> trả lại để bổ sung thông tin / tài liệu.</p>'
      + infoTable + noteBox
      + '<p>Vui lòng đăng nhập vào hệ thống, mở phiếu và chọn <b>"Chỉnh sửa & Gửi lại"</b> để cập nhật và gửi lại.</p>'
      + '<p>Trân trọng,<br>Hệ thống Workflow TLC Group</p>';
    GmailApp.sendEmail(recipientEmail, subject, '', { htmlBody: body, name: 'TLC Group Workflow' });
    Logger.log('[P2P] ✅ Send-back email (step 1) sent to: ' + recipientEmail);

  } else if (targetStep === 2) {
    // Notify budget + supplier approvers
    var recipients = [(row[10] || '').toString().trim(), (row[11] || '').toString().trim()].filter(Boolean);
    var subject2 = '[ĐỀ NGHỊ MUA HÀNG] Yêu cầu xem lại - Bước Ngân sách & NCC - ' + prNo;
    var body2 = '<p>Kính gửi,</p>'
      + '<p><b>' + senderRoleLabel + '</b> đã yêu cầu xem lại bước <b>Ngân sách & NCC</b> của phiếu đề nghị mua hàng <b>' + prNo + '</b>.</p>'
      + infoTable + noteBox
      + '<p>Vui lòng đăng nhập vào hệ thống để xem lại và phê duyệt.</p>'
      + '<p>Trân trọng,<br>Hệ thống Workflow TLC Group</p>';
    recipients.forEach(function(email) {
      try {
        GmailApp.sendEmail(email, subject2, '', { htmlBody: body2, name: 'TLC Group Workflow' });
        Logger.log('[P2P] ✅ Send-back email (step 2) sent to: ' + email);
      } catch (e) {
        Logger.log('[P2P] ⚠️ Send-back email to ' + email + ' failed: ' + e.message);
      }
    });

  } else if (targetStep === 3) {
    // Notify contract approver
    var contractEmail = (row[17] || '').toString().trim();
    if (!contractEmail) return;
    var subject3 = '[ĐỀ NGHỊ MUA HÀNG] Yêu cầu xem lại - Bước Thẩm định Hợp đồng - ' + prNo;
    var body3 = '<p>Kính gửi,</p>'
      + '<p><b>' + senderRoleLabel + '</b> đã yêu cầu xem lại bước <b>Thẩm định Hợp đồng</b> của phiếu đề nghị mua hàng <b>' + prNo + '</b>.</p>'
      + infoTable + noteBox
      + '<p>Vui lòng đăng nhập vào hệ thống để xem lại và phê duyệt.</p>'
      + '<p>Trân trọng,<br>Hệ thống Workflow TLC Group</p>';
    GmailApp.sendEmail(contractEmail, subject3, '', { htmlBody: body3, name: 'TLC Group Workflow' });
    Logger.log('[P2P] ✅ Send-back email (step 3) sent to: ' + contractEmail);
  }
}

// ==================== ACCEPTANCE MINUTES ====================
/**
 * Acceptance Minutes (Biên Bản Nghiệm Thu)
 * Sheet: Acceptance_Minutes_History
 * Columns: A=AM No, B=Company, C=PR No, D=Department, E=Receiver Name,
 *          F=Receiver Email, G=AM Date, H=Items Received (JSON), I=Status,
 *          J=Submitted At, K=Dept Head Approver Email, L=Metadata (JSON)
 */
var AM_SHEET_NAME = 'Acceptance_Minutes_History';
var AM_COL = {
  AM_NO:          0,
  COMPANY:        1,
  PR_NO:          2,
  DEPARTMENT:     3,
  RECEIVER_NAME:  4,
  RECEIVER_EMAIL: 5,
  AM_DATE:        6,
  ITEMS:          7,
  STATUS:         8,
  SUBMITTED_AT:   9,
  DEPT_HEAD_EMAIL: 10,
  METADATA:       11
};

/** Get or auto-create the AM sheet with headers. */
function getOrCreateAMSheet_() {
  var ss    = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sheet = ss.getSheetByName(AM_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(AM_SHEET_NAME);
    sheet.appendRow([
      'AM No', 'Company', 'PR No', 'Department', 'Receiver Name',
      'Receiver Email', 'AM Date', 'Items Received (JSON)', 'Status',
      'Submitted At', 'Dept Head Approver Email', 'Metadata (JSON)'
    ]);
    Logger.log('[AM] Created sheet: ' + AM_SHEET_NAME);
  }
  return sheet;
}

/** Find an AM row by amNo. Returns {rowIndex, row[], status, prNo} or null. */
function getAMByNo_(amNo) {
  if (!amNo) return null;
  try {
    var sheet = getOrCreateAMSheet_();
    var data  = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if ((data[i][AM_COL.AM_NO] || '').toString().trim() === amNo.trim()) {
        return {
          rowIndex: i + 1, // 1-based sheet row
          row: data[i],
          status:  (data[i][AM_COL.STATUS]  || '').toString().trim(),
          prNo:    (data[i][AM_COL.PR_NO]   || '').toString().trim(),
          company: (data[i][AM_COL.COMPANY] || '').toString().trim(),
          metadata: (function() {
            try { return JSON.parse(data[i][AM_COL.METADATA] || '{}'); } catch(_) { return {}; }
          })()
        };
      }
    }
  } catch (e) {
    Logger.log('[AM] getAMByNo_ error: ' + e.message);
  }
  return null;
}

/** Upload base64 file to the AM Drive folder. Returns Drive URL or ''. */
function uploadAMFile_(base64DataUrl, fileName, mimeType, amNo) {
  try {
    var folderId = getCfg_('ACCEPTANCE_MINUTES_FOLDER_ID', getCfg_('PURCHASE_REQUEST_FOLDER_ID', '1SJ-pUa6jg2rmJTzle-TvvSNrKMUduvx3'));
    var parent   = DriveApp.getFolderById(folderId);
    var sub      = parent.getFoldersByName('AM_Docs').hasNext()
      ? parent.getFoldersByName('AM_Docs').next()
      : parent.createFolder('AM_Docs');
    var amFolder = sub.getFoldersByName(amNo).hasNext()
      ? sub.getFoldersByName(amNo).next()
      : sub.createFolder(amNo);
    var b64  = base64DataUrl.includes(',') ? base64DataUrl.split(',')[1] : base64DataUrl;
    var blob = Utilities.newBlob(Utilities.base64Decode(b64), mimeType || 'application/octet-stream', fileName || 'file');
    var f    = amFolder.createFile(blob);
    try { f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (_) {}
    return f.getUrl();
  } catch (e) {
    Logger.log('[AM] uploadAMFile_ error: ' + e.message);
    return '';
  }
}

/** Create a new Acceptance Minutes record. */
function handleCreateAcceptanceMinutes(data) {
  try {
    var amNo         = (data.amNo          || '').toString().trim();
    var companyName  = (data.companyName   || '').toString().trim();
    var prNo         = (data.prNo          || '').toString().trim();
    var department   = (data.department    || '').toString().trim();
    var receiverName = (data.receiverName  || '').toString().trim();
    var receiverEmail= (data.receiverEmail || '').toString().trim().toLowerCase();
    var amDate       = (data.amDate        || '').toString().trim();
    var deptHeadEmail= (data.deptHeadEmail || '').toString().trim().toLowerCase();
    var itemsRaw     = (data.items         || '[]').toString();

    if (!companyName)   return createResponse(false, 'Thiếu tên công ty.');
    if (!prNo)          return createResponse(false, 'Thiếu số đề nghị mua hàng (PR No).');
    if (!receiverName)  return createResponse(false, 'Thiếu tên người nhận hàng.');
    if (!receiverEmail) return createResponse(false, 'Thiếu email người nhận hàng.');
    if (!deptHeadEmail) return createResponse(false, 'Vui lòng chọn người phụ trách xác nhận nghiệm thu.');
    if (!(data.receiverSignature || '').toString().trim())
      return createResponse(false, 'Chữ ký người nhận hàng là bắt buộc.');

    // Validate items
    var parsedItems;
    try { parsedItems = JSON.parse(itemsRaw); } catch (e) {
      return createResponse(false, 'Dữ liệu hàng hóa không hợp lệ: ' + e.message);
    }
    if (!Array.isArray(parsedItems) || parsedItems.length === 0)
      return createResponse(false, 'Vui lòng nhập ít nhất 1 hàng hóa / dịch vụ.');

    // Validate PR exists and is Hoàn thành
    var ss      = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    var prSheet = ss.getSheetByName(PR_SHEET_NAME);
    if (prSheet) {
      var prData = prSheet.getDataRange().getValues();
      var prFound = false;
      for (var pi = 1; pi < prData.length; pi++) {
        if ((prData[pi][0] || '').toString().trim() === prNo) {
          prFound = true;
          var prStatus = (prData[pi][14] || '').toString().trim();
          if (prStatus !== 'Hoàn thành') {
            return createResponse(false, 'Phiếu đề nghị ' + prNo + ' chưa hoàn thành phê duyệt (trạng thái: ' + prStatus + ').');
          }
          break;
        }
      }
      if (!prFound) return createResponse(false, 'Không tìm thấy phiếu đề nghị mua hàng: ' + prNo);
    }

    // Fallback AM number
    if (!amNo) {
      var now2    = new Date();
      var ds2     = Utilities.formatDate(now2, 'Asia/Ho_Chi_Minh', 'yyyyMMdd');
      amNo = 'AM-' + ds2 + '-' + Math.floor(Math.random() * 100000).toString().padStart(6, '0');
    }

    // Check duplicate
    if (getAMByNo_(amNo)) return createResponse(false, 'Số biên bản ' + amNo + ' đã tồn tại.');

    var submittedAt = new Date().toISOString();

    // Upload receiver signature
    var receiverSigUrl = uploadAMFile_(data.receiverSignature, 'receiver_sig.jpg', 'image/jpeg', amNo);

    // Upload attachments
    var attachmentRecords = [];
    try {
      var rawAtt = Array.isArray(data.attachments) ? data.attachments
        : (typeof data.attachments === 'string' ? JSON.parse(data.attachments || '[]') : []);
      (rawAtt || []).forEach(function(f) {
        if (!f.fileData) return;
        var url = uploadAMFile_(f.fileData, f.fileName || 'attachment', f.mimeType || 'application/octet-stream', amNo);
        attachmentRecords.push({ fileName: f.fileName, fileUrl: url });
      });
    } catch (ae) {
      Logger.log('[AM] Attachment upload error: ' + ae.message);
    }

    var metadata = {
      receiverSignature: receiverSigUrl,
      attachments:       attachmentRecords,
      deptHeadStatus:    'Pending',
      deptHeadApprovedAt: '',
      deptHeadSignature: '',
      deptHeadNote:      '',
      rejectionNote:     '',
      companyCode:       data.companyCode || '',
      requesterEmail:    receiverEmail
    };

    var sheet = getOrCreateAMSheet_();
    sheet.appendRow([
      amNo, companyName, prNo, department, receiverName,
      receiverEmail, amDate || submittedAt.substring(0,10),
      JSON.stringify(parsedItems),
      'Chờ xác nhận', submittedAt, deptHeadEmail,
      JSON.stringify(metadata)
    ]);
    Logger.log('[AM] Created: ' + amNo);

    // Email dept head
    sendAMApprovalRequestEmail_(amNo, companyName, prNo, receiverName, deptHeadEmail, parsedItems);

    return createResponse(true, 'Biên bản nghiệm thu đã được tạo thành công.', { amNo: amNo });
  } catch (e) {
    Logger.log('[AM] handleCreateAcceptanceMinutes error: ' + e.message);
    return createResponse(false, 'Lỗi khi tạo biên bản nghiệm thu: ' + e.message);
  }
}

/** Return AM history for the requesting user (receiver or dept head). */
function handleGetAcceptanceMinutesHistory(data) {
  try {
    var email = (data.email || data.requesterEmail || '').toString().trim().toLowerCase();
    var sheet = getOrCreateAMSheet_();
    var rows  = sheet.getDataRange().getValues();
    var results = [];
    for (var i = 1; i < rows.length; i++) {
      var r = rows[i];
      var rEmail = (r[AM_COL.RECEIVER_EMAIL] || '').toString().toLowerCase();
      var dhEmail= (r[AM_COL.DEPT_HEAD_EMAIL]|| '').toString().toLowerCase();
      if (!email || rEmail === email || dhEmail === email) {
        var meta = {};
        try { meta = JSON.parse(r[AM_COL.METADATA] || '{}'); } catch (_) {}
        results.push({
          amNo:          r[AM_COL.AM_NO],
          company:       r[AM_COL.COMPANY],
          prNo:          r[AM_COL.PR_NO],
          department:    r[AM_COL.DEPARTMENT],
          receiverName:  r[AM_COL.RECEIVER_NAME],
          receiverEmail: r[AM_COL.RECEIVER_EMAIL],
          amDate:        r[AM_COL.AM_DATE] ? r[AM_COL.AM_DATE].toString() : '',
          status:        r[AM_COL.STATUS],
          submittedAt:   r[AM_COL.SUBMITTED_AT] ? r[AM_COL.SUBMITTED_AT].toString() : '',
          deptHeadEmail: r[AM_COL.DEPT_HEAD_EMAIL],
          deptHeadStatus: meta.deptHeadStatus || 'Pending',
          items:         (function() { try { return JSON.parse(r[AM_COL.ITEMS] || '[]'); } catch(_) { return []; } })(),
          metadata:      meta
        });
      }
    }
    results.reverse(); // newest first
    return createResponse(true, 'OK', { acceptanceMinutes: results });
  } catch (e) {
    Logger.log('[AM] handleGetAcceptanceMinutesHistory error: ' + e.message);
    return createResponse(false, 'Lỗi: ' + e.message);
  }
}

/** Return a single AM record by amNo. */
function handleGetAcceptanceMinutesDetail(data) {
  try {
    var amNo = (data.amNo || '').toString().trim();
    if (!amNo) return createResponse(false, 'Thiếu amNo.');
    var rec = getAMByNo_(amNo);
    if (!rec) return createResponse(false, 'Không tìm thấy biên bản: ' + amNo);
    var r = rec.row;
    var meta = rec.metadata;
    return createResponse(true, 'OK', {
      am: {
        amNo:          r[AM_COL.AM_NO],
        company:       r[AM_COL.COMPANY],
        prNo:          r[AM_COL.PR_NO],
        department:    r[AM_COL.DEPARTMENT],
        receiverName:  r[AM_COL.RECEIVER_NAME],
        receiverEmail: r[AM_COL.RECEIVER_EMAIL],
        amDate:        r[AM_COL.AM_DATE] ? r[AM_COL.AM_DATE].toString() : '',
        status:        r[AM_COL.STATUS],
        submittedAt:   r[AM_COL.SUBMITTED_AT] ? r[AM_COL.SUBMITTED_AT].toString() : '',
        deptHeadEmail: r[AM_COL.DEPT_HEAD_EMAIL],
        items:         (function() { try { return JSON.parse(r[AM_COL.ITEMS] || '[]'); } catch(_) { return []; } })(),
        metadata:      meta
      }
    });
  } catch (e) {
    Logger.log('[AM] handleGetAcceptanceMinutesDetail error: ' + e.message);
    return createResponse(false, 'Lỗi: ' + e.message);
  }
}

/** Return all AMs linked to a given PR number — used by Payment Request validation. */
function handleGetAcceptanceMinutesByPR(data) {
  try {
    var prNo  = (data.prNo || '').toString().trim();
    if (!prNo) return createResponse(false, 'Thiếu prNo.');
    var sheet = getOrCreateAMSheet_();
    var rows  = sheet.getDataRange().getValues();
    var results = [];
    for (var i = 1; i < rows.length; i++) {
      if ((rows[i][AM_COL.PR_NO] || '').toString().trim() === prNo) {
        var meta = {};
        try { meta = JSON.parse(rows[i][AM_COL.METADATA] || '{}'); } catch (_) {}
        results.push({
          amNo:          rows[i][AM_COL.AM_NO],
          company:       rows[i][AM_COL.COMPANY],
          prNo:          rows[i][AM_COL.PR_NO],
          receiverName:  rows[i][AM_COL.RECEIVER_NAME],
          amDate:        rows[i][AM_COL.AM_DATE] ? rows[i][AM_COL.AM_DATE].toString() : '',
          status:        rows[i][AM_COL.STATUS],
          deptHeadEmail: rows[i][AM_COL.DEPT_HEAD_EMAIL],
          deptHeadStatus: meta.deptHeadStatus || 'Pending'
        });
      }
    }
    return createResponse(true, 'OK', { acceptanceMinutes: results });
  } catch (e) {
    Logger.log('[AM] handleGetAcceptanceMinutesByPR error: ' + e.message);
    return createResponse(false, 'Lỗi: ' + e.message);
  }
}

/** Dept head approves an AM → sets status to Đã nghiệm thu. */
function handleApproveAcceptanceMinutes(data) {
  try {
    var amNo          = (data.amNo          || '').toString().trim();
    var approverEmail = (data.approverEmail || '').toString().trim().toLowerCase();
    var approverSig   = (data.approverSignature || '').toString().trim();
    var note          = (data.note          || '').toString().trim();

    if (!amNo)          return createResponse(false, 'Thiếu amNo.');
    if (!approverEmail) return createResponse(false, 'Thiếu email người phê duyệt.');
    if (!approverSig)   return createResponse(false, 'Chữ ký người phê duyệt là bắt buộc.');

    var rec = getAMByNo_(amNo);
    if (!rec) return createResponse(false, 'Không tìm thấy biên bản: ' + amNo);

    var deptHead = (rec.row[AM_COL.DEPT_HEAD_EMAIL] || '').toString().trim().toLowerCase();
    if (approverEmail !== deptHead)
      return createResponse(false, 'Bạn không phải là người phụ trách xác nhận biên bản này.');
    if (rec.status === 'Đã nghiệm thu')
      return createResponse(false, 'Biên bản này đã được xác nhận rồi.');
    if (rec.status === 'Từ chối')
      return createResponse(false, 'Biên bản đã bị từ chối. Không thể phê duyệt.');

    // Upload signature
    var sigUrl = uploadAMFile_(approverSig, 'depthead_sig.jpg', 'image/jpeg', amNo);
    var approvedAt = new Date().toISOString();

    var meta = rec.metadata;
    meta.deptHeadStatus    = 'Approved';
    meta.deptHeadApprovedAt = approvedAt;
    meta.deptHeadSignature = sigUrl;
    meta.deptHeadNote      = note;

    var sheet = getOrCreateAMSheet_();
    sheet.getRange(rec.rowIndex, AM_COL.STATUS   + 1).setValue('Đã nghiệm thu');
    sheet.getRange(rec.rowIndex, AM_COL.METADATA + 1).setValue(JSON.stringify(meta));
    Logger.log('[AM] Approved: ' + amNo + ' by ' + approverEmail);

    // Email receiver
    var receiverEmail = (rec.row[AM_COL.RECEIVER_EMAIL] || '').toString().trim();
    var receiverName  = (rec.row[AM_COL.RECEIVER_NAME]  || '').toString().trim();
    sendAMOutcomeEmail_(amNo, rec.company, rec.prNo, receiverEmail, receiverName, true, note);

    return createResponse(true, 'Biên bản ' + amNo + ' đã được xác nhận.', { amNo: amNo, status: 'Đã nghiệm thu' });
  } catch (e) {
    Logger.log('[AM] handleApproveAcceptanceMinutes error: ' + e.message);
    return createResponse(false, 'Lỗi: ' + e.message);
  }
}

/** Dept head rejects an AM → sets status to Từ chối. */
function handleRejectAcceptanceMinutes(data) {
  try {
    var amNo          = (data.amNo          || '').toString().trim();
    var approverEmail = (data.approverEmail || '').toString().trim().toLowerCase();
    var note          = (data.note          || '').toString().trim();

    if (!amNo)          return createResponse(false, 'Thiếu amNo.');
    if (!approverEmail) return createResponse(false, 'Thiếu email người phê duyệt.');
    if (!note)          return createResponse(false, 'Vui lòng nhập lý do từ chối.');

    var rec = getAMByNo_(amNo);
    if (!rec) return createResponse(false, 'Không tìm thấy biên bản: ' + amNo);

    var deptHead = (rec.row[AM_COL.DEPT_HEAD_EMAIL] || '').toString().trim().toLowerCase();
    if (approverEmail !== deptHead)
      return createResponse(false, 'Bạn không phải là người phụ trách xác nhận biên bản này.');
    if (rec.status === 'Đã nghiệm thu')
      return createResponse(false, 'Biên bản này đã được xác nhận rồi.');

    var meta = rec.metadata;
    meta.deptHeadStatus = 'Rejected';
    meta.rejectionNote  = note;
    meta.deptHeadNote   = note;

    var sheet = getOrCreateAMSheet_();
    sheet.getRange(rec.rowIndex, AM_COL.STATUS   + 1).setValue('Từ chối');
    sheet.getRange(rec.rowIndex, AM_COL.METADATA + 1).setValue(JSON.stringify(meta));
    Logger.log('[AM] Rejected: ' + amNo + ' by ' + approverEmail);

    var receiverEmail = (rec.row[AM_COL.RECEIVER_EMAIL] || '').toString().trim();
    var receiverName  = (rec.row[AM_COL.RECEIVER_NAME]  || '').toString().trim();
    sendAMOutcomeEmail_(amNo, rec.company, rec.prNo, receiverEmail, receiverName, false, note);

    return createResponse(true, 'Biên bản ' + amNo + ' đã bị từ chối.', { amNo: amNo, status: 'Từ chối' });
  } catch (e) {
    Logger.log('[AM] handleRejectAcceptanceMinutes error: ' + e.message);
    return createResponse(false, 'Lỗi: ' + e.message);
  }
}

/** Email dept head requesting approval. */
function sendAMApprovalRequestEmail_(amNo, companyName, prNo, receiverName, deptHeadEmail, items) {
  if (!deptHeadEmail) return;
  var itemList = items.slice(0, 5).map(function(it) {
    return '<li>' + (it.desc || it.name || '—') + ' — Đặt: ' + (it.orderedQty || 0) + ' / Nhận: ' + (it.receivedQty || 0) + ' ' + (it.unit || '') + '</li>';
  }).join('') + (items.length > 5 ? '<li>... và ' + (items.length - 5) + ' dòng khác</li>' : '');
  var subject = '[BIÊN BẢN NGHIỆM THU] Yêu cầu xác nhận - ' + amNo;
  var body = '<p>Kính gửi,</p>'
    + '<p>Biên bản nghiệm thu <b>' + amNo + '</b> đã được tạo bởi <b>' + receiverName + '</b> và đang chờ xác nhận của bạn.</p>'
    + '<table cellpadding="6" style="border-collapse:collapse;font-size:13px;">'
    + '<tr><td style="font-weight:700;padding-right:16px;">Số biên bản:</td><td>' + amNo + '</td></tr>'
    + '<tr><td style="font-weight:700;">Công ty:</td><td>' + companyName + '</td></tr>'
    + '<tr><td style="font-weight:700;">Phiếu mua hàng:</td><td>' + prNo + '</td></tr>'
    + '<tr><td style="font-weight:700;">Người nhận hàng:</td><td>' + receiverName + '</td></tr>'
    + '</table>'
    + '<br><b>Danh sách hàng hóa:</b><ul>' + itemList + '</ul>'
    + '<p>Vui lòng đăng nhập vào hệ thống để xem chi tiết và xác nhận.</p>'
    + '<p>Trân trọng,<br>Hệ thống Workflow TLC Group</p>';
  try {
    GmailApp.sendEmail(deptHeadEmail, subject, '', { htmlBody: body, name: 'TLC Group Workflow' });
    Logger.log('[AM] ✅ Approval request email sent to: ' + deptHeadEmail);
  } catch (e) {
    Logger.log('[AM] ⚠️ Email to dept head failed: ' + e.message);
  }
}

/** Email receiver with approve/reject outcome. */
function sendAMOutcomeEmail_(amNo, companyName, prNo, receiverEmail, receiverName, approved, note) {
  if (!receiverEmail) return;
  var statusLabel = approved ? 'ĐÃ ĐƯỢC XÁC NHẬN ✅' : 'BỊ TỪ CHỐI ❌';
  var subject = '[BIÊN BẢN NGHIỆM THU] ' + statusLabel + ' - ' + amNo;
  var noteHtml = note ? '<div style="background:#fffbeb;border-left:4px solid #f59e0b;padding:10px 14px;margin:14px 0;border-radius:4px;"><b>Ghi chú:</b><br>' + note + '</div>' : '';
  var body = '<p>Kính gửi ' + receiverName + ',</p>'
    + '<p>Biên bản nghiệm thu <b>' + amNo + '</b> (phiếu mua hàng: <b>' + prNo + '</b>) '
    + (approved ? 'đã được <b>xác nhận</b>. Bạn có thể tiến hành tạo Đề nghị Thanh toán.' : 'đã <b>bị từ chối</b>. Vui lòng xem xét lại và tạo biên bản mới nếu cần.')
    + '</p>'
    + '<table cellpadding="6" style="border-collapse:collapse;font-size:13px;">'
    + '<tr><td style="font-weight:700;padding-right:16px;">Công ty:</td><td>' + companyName + '</td></tr>'
    + '<tr><td style="font-weight:700;">Số biên bản:</td><td>' + amNo + '</td></tr>'
    + '</table>'
    + noteHtml
    + '<p>Trân trọng,<br>Hệ thống Workflow TLC Group</p>';
  try {
    GmailApp.sendEmail(receiverEmail, subject, '', { htmlBody: body, name: 'TLC Group Workflow' });
    Logger.log('[AM] ✅ Outcome email sent to: ' + receiverEmail);
  } catch (e) {
    Logger.log('[AM] ⚠️ Outcome email failed: ' + e.message);
  }
}

/**
 * Notifies budget + supplier approvers when a PR is resubmitted after being sent back.
 */
function sendPurchaseRequestResubmitEmails_(prNo, data, attachmentRecords) {
  var companyName   = (data.companyName   || '').toString();
  var requesterName = (data.requesterName || '').toString();
  var purpose       = (data.purpose       || '').toString();
  var grandTotal    = (parseFloat(data.grandTotal) || 0).toLocaleString('vi-VN') + ' ₫';
  var requiredDate  = (data.requiredDate  || '').toString();

  var attachHtml = '';
  if (attachmentRecords && attachmentRecords.length > 0) {
    var links = attachmentRecords.filter(function(r){ return r.fileUrl; }).map(function(r){
      return '<li><a href="' + r.fileUrl + '">' + r.fileName + '</a></li>';
    }).join('');
    if (links) attachHtml = '<br><b>Tệp đính kèm:</b><ul>' + links + '</ul>';
  }

  var subject = '[ĐỀ NGHỊ MUA HÀNG] Phiếu đã được cập nhật và gửi lại - ' + prNo;
  var body = '<p>Kính gửi,</p>'
    + '<p>Phiếu đề nghị mua hàng <b>' + prNo + '</b> đã được người đề nghị cập nhật và gửi lại, đang chờ phê duyệt của bạn.</p>'
    + '<table cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-size:13px;">'
    + '<tr><td style="font-weight:700;padding-right:16px;">Số phiếu:</td><td>' + prNo + '</td></tr>'
    + '<tr><td style="font-weight:700;padding-right:16px;">Công ty:</td><td>' + companyName + '</td></tr>'
    + '<tr><td style="font-weight:700;padding-right:16px;">Người đề nghị:</td><td>' + requesterName + '</td></tr>'
    + '<tr><td style="font-weight:700;padding-right:16px;">Mục đích:</td><td>' + purpose + '</td></tr>'
    + '<tr><td style="font-weight:700;padding-right:16px;">Tổng cộng:</td><td>' + grandTotal + '</td></tr>'
    + '<tr><td style="font-weight:700;padding-right:16px;">Ngày cần hàng:</td><td>' + requiredDate + '</td></tr>'
    + '</table>'
    + attachHtml
    + '<p style="margin-top:16px;">Vui lòng đăng nhập vào hệ thống để xem chi tiết và phê duyệt.</p>'
    + '<p>Trân trọng,<br>Hệ thống Workflow TLC Group</p>';

  [data.budgetApprover, data.supplierApprover].forEach(function(email) {
    if (!email) return;
    try {
      GmailApp.sendEmail(email, subject, '', { htmlBody: body, name: 'TLC Group Workflow' });
      Logger.log('[P2P] ✅ Resubmit email sent to: ' + email);
    } catch (e) {
      Logger.log('[P2P] ⚠️ Resubmit email to ' + email + ' failed: ' + e.message);
    }
  });
}
