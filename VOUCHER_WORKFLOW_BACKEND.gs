/**
 * GOOGLE APPS SCRIPT - PHIẾU THU CHI
 */

// TLCG Master Data spreadsheet - contains both "Nhân viên" and "Voucher_History" sheets
const TLCG_MASTER_DATA_SHEET_ID = '1ujmPbtEdkGLgEshfhvV8gRB6R0GLI31jsZM5rDOJS0g';
const USERS_SHEET_ID = TLCG_MASTER_DATA_SHEET_ID; // Same spreadsheet
const VOUCHER_HISTORY_SHEET_ID = TLCG_MASTER_DATA_SHEET_ID; // Same spreadsheet
const VH_SHEET_NAME = 'Voucher_History';
const EMPLOYEES_SHEET_NAME = 'Master Employee';
const COMPANY_SHEET_NAME = 'Master Company';

/**
 * Helper function to safely open a spreadsheet with detailed error handling
 * @param {string} spreadsheetId - The ID of the spreadsheet to open
 * @param {string} context - Context description for logging (e.g., "handleLogin")
 * @returns {Spreadsheet|null} - The spreadsheet object or null if error
 * @throws {Error} - Throws detailed error if spreadsheet cannot be opened
 */
function safeOpenSpreadsheet(spreadsheetId, context) {
  try {
    Logger.log('[' + context + '] Attempting to open spreadsheet: ' + spreadsheetId);

    if (!spreadsheetId || spreadsheetId === '') {
      throw new Error('Spreadsheet ID không được định nghĩa hoặc rỗng');
    }

    const ss = SpreadsheetApp.openById(spreadsheetId);
    Logger.log('[' + context + '] ✅ Successfully opened spreadsheet');
    return ss;

  } catch (error) {
    Logger.log('[' + context + '] ❌ ERROR opening spreadsheet: ' + error.toString());
    Logger.log('[' + context + '] Error details: ' + error.message);

    // Provide specific, actionable error messages
    if (error.message.includes('openById') || error.message.includes('Unexpected error')) {
      throw new Error('Script chưa được cấp quyền truy cập Google Sheets.\n\nGiải pháp:\n1. Mở Apps Script editor\n2. Chạy function test (hoặc bất kỳ function nào) một lần\n3. Cấp quyền khi được yêu cầu\n4. Deploy lại web app: Deploy > New deployment\n5. Đặt "Execute as: Me" và "Who has access: Anyone"\n\nSpreadsheet ID: ' + spreadsheetId + '\nLỗi gốc: ' + error.message);
    } else if (error.message.includes('not found') || error.message.includes('does not exist')) {
      throw new Error('Không tìm thấy spreadsheet với ID: ' + spreadsheetId + '\n\nVui lòng kiểm tra:\n1. Spreadsheet có tồn tại không?\n2. ID có chính xác không?\n3. URL spreadsheet: https://docs.google.com/spreadsheets/d/' + spreadsheetId + '/edit');
    } else if (error.message.includes('permission') || error.message.includes('access') || error.message.includes('Authorization')) {
      throw new Error('Không có quyền truy cập spreadsheet.\n\nGiải pháp:\n1. Share spreadsheet với email account đang chạy script\n2. Hoặc đặt spreadsheet thành "Anyone with link can view/edit"\n3. Kiểm tra lại quyền trong spreadsheet settings\n\nSpreadsheet ID: ' + spreadsheetId);
    }

    throw new Error('Lỗi mở spreadsheet: ' + error.message + '\nSpreadsheet ID: ' + spreadsheetId);
  }
}

/**
 * Helper function to safely get a sheet by name with error handling
 * @param {Spreadsheet} spreadsheet - The spreadsheet object
 * @param {string} sheetName - Name of the sheet to get
 * @param {string} context - Context for logging
 * @returns {Sheet} - The sheet object
 * @throws {Error} - Throws error if sheet not found
 */
function safeGetSheet(spreadsheet, sheetName, context) {
  const sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    const availableSheets = spreadsheet.getSheets().map(function(s) { return s.getName(); }).join(', ');
    Logger.log('[' + context + '] ❌ Sheet "' + sheetName + '" not found');
    Logger.log('[' + context + '] Available sheets: ' + availableSheets);
    throw new Error('Không tìm thấy sheet "' + sheetName + '" trong spreadsheet.\n\nCác sheet có sẵn: ' + availableSheets + '\n\nVui lòng kiểm tra tên sheet có chính xác không.');
  }
  Logger.log('[' + context + '] ✅ Successfully got sheet: ' + sheetName);
  return sheet;
}

function doGet(e) {
  try {
    Logger.log('=== doGet called ===');
    Logger.log('e.parameter keys: ' + (e.parameter ? Object.keys(e.parameter).join(', ') : 'none'));
    
    const action = e.parameter ? e.parameter.action : null;
    Logger.log('Action from GET: ' + action);
    
    if (action === 'getVoucherSummary') {
      return handleGetVoucherSummary(e.parameter);
    } else if (action === 'getVoucherHistory') {
      return handleGetVoucherHistory(e.parameter);
    } else if (action === 'getEmployees') {
      return handleGetEmployees(e.parameter);
    } else if (action === 'getCompanyApprovers') {
      Logger.log('doGet: getCompanyApprovers called');
      Logger.log('e.parameter:', JSON.stringify(e.parameter));
      const companyName = e.parameter ? (e.parameter.companyName || e.parameter.company) : null;
      Logger.log('Extracted companyName from e.parameter:', companyName);
      return handleGetCompanyApprovers(e.parameter, companyName);
    } else if (action === 'getApprovalStatus') {
      Logger.log('doGet: getApprovalStatus called');
      return handleGetApprovalStatus(e.parameter);
    } else if (action === 'approveVoucher') {
      // Handle approve via GET (fallback, but POST is preferred for signature)
      Logger.log('⚠️ Handling approveVoucher via GET (signature may be missing)');
      Logger.log('⚠️ Note: Approve via POST is recommended to include signature');
      const requestBody = {
        action: 'approveVoucher',
        voucher: {
          voucherNumber: e.parameter.voucherNumber || '',
          voucherType: e.parameter.voucherType || '',
          company: e.parameter.company || '',
          employee: e.parameter.employee || '',
          amount: e.parameter.amount || '',
          requestorEmail: e.parameter.requestorEmail || '',
          approverEmail: e.parameter.approverEmail || '',
          approvedBy: e.parameter.approvedBy || e.parameter.approverEmail || '',
          approverSignature: e.parameter.approverSignature || '', // May be empty for GET (too large)
          submittedBy: e.parameter.submittedBy || ''
        }
      };
      Logger.log('Request body for approveVoucher (GET): ' + JSON.stringify(requestBody));
      return handleApproveVoucher(requestBody);
    } else if (action === 'rejectVoucher') {
      // Handle reject via GET (from email links)
      Logger.log('Handling rejectVoucher via GET');
      const requestBody = {
        action: 'rejectVoucher',
        voucher: {
          voucherNumber: e.parameter.voucherNumber || '',
          voucherType: e.parameter.voucherType || '',
          company: e.parameter.company || '',
          employee: e.parameter.employee || '',
          amount: e.parameter.amount || '',
          requestorEmail: e.parameter.requestorEmail || '',
          approverEmail: e.parameter.approverEmail || '',
          rejectReason: e.parameter.rejectReason || '',
          rejectedBy: e.parameter.rejectedBy || e.parameter.approverEmail || ''
        }
      };
      Logger.log('Request body for rejectVoucher: ' + JSON.stringify(requestBody));
      return handleRejectVoucher(requestBody);
    }
    
    // If no action or unknown action, return JSON (not HTML) for API calls
    if (action) {
      Logger.log('⚠️ WARNING: Unknown action in GET: ' + action);
      return createResponse(false, 'Action không hợp lệ trong GET: ' + action);
    }
    
  } catch (error) {
    Logger.log('❌ ERROR in doGet: ' + error.toString());
    Logger.log('❌ Error stack: ' + error.stack);
    return createResponse(false, 'Lỗi: ' + error.message);
  }
  
  // Default response for direct browser access (not API call)
  return HtmlService.createHtmlOutput("<h2>Backend đang chạy!</h2><p>Vui lòng gửi dữ liệu từ giao diện chính.</p>");
}

function doPost(e) {
  console.log('🔴🔴🔴 === doPost called === 🔴🔴🔴');
  Logger.log('🔴🔴🔴 === doPost called === 🔴🔴🔴');
  console.log('🔴 Event object e is: ' + (e ? 'defined' : 'UNDEFINED'));
  Logger.log('🔴 Event object e is: ' + (e ? 'defined' : 'UNDEFINED'));
  
  // CRITICAL: Check if e exists
  if (!e) {
    console.log('❌❌❌ CRITICAL: Event object is undefined! This is likely a test run from editor.');
    Logger.log('❌❌❌ CRITICAL: Event object is undefined! This is likely a test run from editor.');
    return createResponse(false, 'Internal error: No request data received. Please call this as a Web App, not from editor.');
  }
  
  // #region agent log
  try {
    UrlFetchApp.fetch('http://127.0.0.1:7242/ingest/cd238998-d527-4813-9e30-22fe3efc32e0', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({location: 'VOUCHER_WORKFLOW_BACKEND.gs:149', message: 'doPost entry', data: {hasParameter: !!e.parameter, hasPostData: !!e.postData}, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'A'})}).catch(() => {});
  } catch (err) {}
  // #endregion
  
  try {
    console.log('e.parameter keys: ' + (e.parameter ? Object.keys(e.parameter).join(', ') : 'none'));
    Logger.log('e.parameter keys: ' + (e.parameter ? Object.keys(e.parameter).join(', ') : 'none'));
    console.log('e.postData exists: ' + (e.postData ? 'yes' : 'no'));
    Logger.log('e.postData exists: ' + (e.postData ? 'yes' : 'no'));
    
    let requestBody;
    let action;

    // Parse FormData - frontend sends JSON in 'data' field as FormData
    if (e.parameter && e.parameter.data) {
      try {
        const dataString = e.parameter.data;
        // Check if data might be truncated (common issue with large payloads)
        if (typeof dataString === 'string') {
          Logger.log('Received data field length: ' + dataString.length + ' characters');
          
          // Check for unterminated strings (common JSON parse error with large payloads)
          if (dataString.length > 1000000) {
            Logger.log('⚠️ WARNING: Large payload detected (' + Math.round(dataString.length / 1024 / 1024) + 'MB). This may cause parsing issues.');
          }
          
          // Check for common truncation signs
          const openBraces = (dataString.match(/\{/g) || []).length;
          const closeBraces = (dataString.match(/\}/g) || []).length;
          if (Math.abs(openBraces - closeBraces) > 2) {
            Logger.log('⚠️ WARNING: JSON structure may be malformed. Open braces: ' + openBraces + ', Close braces: ' + closeBraces);
          }
        }
        
        requestBody = JSON.parse(e.parameter.data);
        action = requestBody.action;
        console.log('🟢🟢🟢 Parsed action from data field: ' + action);
        Logger.log('🟢🟢🟢 Parsed action from data field: ' + action);
      } catch (parseError) {
        Logger.log('❌ JSON Parse Error: ' + parseError.toString());
        Logger.log('❌ Data length: ' + (e.parameter.data ? e.parameter.data.length : 'N/A'));
        Logger.log('❌ Error position: ' + parseError.message);
        Logger.log('❌ First 200 chars of data: ' + (e.parameter.data ? e.parameter.data.substring(0, 200) : 'N/A'));
        Logger.log('❌ Last 200 chars of data: ' + (e.parameter.data && e.parameter.data.length > 200 ? e.parameter.data.substring(e.parameter.data.length - 200) : 'N/A'));
        
        // Return more detailed error message
        return createResponse(false, 'Lỗi parse dữ liệu: ' + parseError.message + '. Payload size: ' + (e.parameter.data ? Math.round(e.parameter.data.length / 1024) : 'unknown') + 'KB. Có thể payload quá lớn hoặc bị cắt.');
      }
    } else if (e.parameter && e.parameter.action) {
      // Extract action and ensure it's a clean string
      action = String(e.parameter.action).trim();
      requestBody = e.parameter;
      Logger.log('Using e.parameter directly, action: [' + action + ']');
      Logger.log('Action type: ' + typeof action);
      Logger.log('Action length: ' + action.length);
      Logger.log('e.parameter keys: ' + Object.keys(e.parameter).join(', '));
    } else {
      // FALLBACK: No data or action field found
      Logger.log('⚠️⚠️⚠️ WARNING: No data or action field in request! ⚠️⚠️⚠️');
      Logger.log('⚠️ e.parameter exists: ' + !!e.parameter);
      Logger.log('⚠️ e.parameter keys: ' + (e.parameter ? Object.keys(e.parameter).join(', ') : 'N/A'));
      Logger.log('⚠️ e.parameter.data exists: ' + !!(e.parameter && e.parameter.data));
      Logger.log('⚠️ e.parameter.action exists: ' + !!(e.parameter && e.parameter.action));
      Logger.log('⚠️ e.postData exists: ' + !!e.postData);
      if (e.postData) {
        Logger.log('⚠️ e.postData.type: ' + e.postData.type);
        Logger.log('⚠️ e.postData.contents (first 200 chars): ' + (e.postData.contents ? e.postData.contents.substring(0, 200) : 'N/A'));
      }
      
      // Try to extract from postData as last resort
      if (e.postData && e.postData.contents) {
        try {
          const postDataObj = JSON.parse(e.postData.contents);
          Logger.log('✅ Successfully parsed postData.contents');
          requestBody = postDataObj;
          action = postDataObj.action;
          Logger.log('✅ Action from postData: ' + action);
        } catch (postError) {
          Logger.log('❌ Failed to parse postData.contents: ' + postError.toString());
          return createResponse(false, 'Lỗi: Không tìm thấy dữ liệu yêu cầu (no data/action field)');
        }
      } else {
        return createResponse(false, 'Lỗi: Request không hợp lệ - thiếu dữ liệu');
      }
    }

    if (!action) {
      Logger.log('⚠️ WARNING: Action is null or undefined');
      return createResponse(false, 'Không tìm thấy action');
    }

    Logger.log('Processing action: ' + action);
    Logger.log('Action type: ' + typeof action);
    Logger.log('Action trimmed: "' + (action ? action.trim() : 'null') + '"');
    Logger.log('Action length: ' + (action ? action.length : 'null'));
    Logger.log('Action exact value: [' + action + ']');
    
    // Normalize action (trim whitespace and remove any invisible characters)
    const normalizedAction = action ? String(action).trim().replace(/[\u200B-\u200D\uFEFF]/g, '') : '';
    
    Logger.log('Normalized action: [' + normalizedAction + ']');
    Logger.log('Normalized action length: ' + normalizedAction.length);
    Logger.log('Will match getCompanyApprovers? ' + (normalizedAction === 'getCompanyApprovers'));
    Logger.log('Expected "getCompanyApprovers" length: ' + 'getCompanyApprovers'.length);
    Logger.log('Normalized action charCodeAt(0): ' + (normalizedAction.length > 0 ? normalizedAction.charCodeAt(0) : 'N/A'));
    Logger.log('Expected "getCompanyApprovers" charCodeAt(0): ' + 'getCompanyApprovers'.charCodeAt(0));
    
    // Debug: Check character by character if length matches
    if (normalizedAction.length === 'getCompanyApprovers'.length && normalizedAction !== 'getCompanyApprovers') {
      Logger.log('⚠️ Length matches but strings differ! Checking character by character...');
      for (let i = 0; i < normalizedAction.length; i++) {
        if (normalizedAction[i] !== 'getCompanyApprovers'[i]) {
          Logger.log('Mismatch at position ' + i + ': got "' + normalizedAction[i] + '" (charCode: ' + normalizedAction.charCodeAt(i) + ') expected "' + 'getCompanyApprovers'[i] + '" (charCode: ' + 'getCompanyApprovers'.charCodeAt(i) + ')');
        }
      }
    }
    
    // Pre-check for getCompanyApprovers before switch (for debugging)
    if (normalizedAction === 'getCompanyApprovers' || normalizedAction.toLowerCase() === 'getcompanyapprovers') {
      Logger.log('✅✅✅ PRE-CHECK: getCompanyApprovers detected before switch ✅✅✅');
      Logger.log('✅ Normalized action matches: ' + (normalizedAction === 'getCompanyApprovers'));
      Logger.log('✅ Case-insensitive matches: ' + (normalizedAction.toLowerCase() === 'getcompanyapprovers'));
    }
    
    switch (normalizedAction) {
      case 'login': return handleLogin_(requestBody);
      case 'sendApprovalEmail': 
        // #region agent log
        try {
          UrlFetchApp.fetch('http://127.0.0.1:7242/ingest/cd238998-d527-4813-9e30-22fe3efc32e0', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({location: 'VOUCHER_WORKFLOW_BACKEND.gs:258', message: 'Routing to handleSendEmail', data: {action: normalizedAction}, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'A'})}).catch(() => {});
        } catch (e) {}
        // #endregion
        return handleSendEmail(requestBody);
      case 'approveVoucher': return handleApproveVoucher(requestBody);
      case 'rejectVoucher': return handleRejectVoucher(requestBody);
      case 'getVoucherSummary': return handleGetVoucherSummary(requestBody);
      case 'getVoucherHistory': return handleGetVoucherHistory(requestBody);
      case 'getEmployees': return handleGetEmployees(requestBody);
      case 'getCompanyApprovers': 
        Logger.log('✅✅✅ MATCHED getCompanyApprovers case ✅✅✅');
        Logger.log('RequestBody for getCompanyApprovers type:', typeof requestBody);
        Logger.log('RequestBody for getCompanyApprovers is null/undefined:', requestBody == null);
        
        // Try to extract companyName before passing to function
        let companyNameParam = null;
        if (requestBody) {
          companyNameParam = requestBody.companyName || requestBody.company || null;
          Logger.log('Extracted companyName from requestBody:', companyNameParam || 'not found');
          
          // If requestBody is e.parameter, try to access it directly
          // e.parameter might not serialize with JSON.stringify but properties should be accessible
          if (!companyNameParam && typeof requestBody === 'object') {
            try {
              // Try accessing as if it's e.parameter directly
              companyNameParam = requestBody['companyName'] || requestBody['company'] || null;
            } catch (e) {
              Logger.log('Error accessing companyName with bracket notation');
            }
          }
        }
        
        try {
          Logger.log('RequestBody for getCompanyApprovers (JSON):', JSON.stringify(requestBody));
        } catch (e) {
          Logger.log('RequestBody for getCompanyApprovers (cannot stringify):', e.toString());
          // Try to access properties directly
          if (requestBody) {
            Logger.log('requestBody.action:', requestBody.action);
            Logger.log('requestBody.companyName:', requestBody.companyName);
            Logger.log('requestBody.company:', requestBody.company);
          }
        }
        
        // Pass both requestBody and extracted companyName
        return handleGetCompanyApprovers(requestBody, companyNameParam);
      case 'getApprovalStatus':
        Logger.log('✅ Matched getApprovalStatus case');
        return handleGetApprovalStatus(requestBody);
      case 'refreshApproverEmails':
        Logger.log('✅ Matched refreshApproverEmails case');
        return handleRefreshApproverEmails(requestBody);
      case 'fetchSignatureImage':
        Logger.log('✅ Matched fetchSignatureImage case');
        return handleFetchSignatureImage(requestBody);
      default: 
        Logger.log('⚠️ WARNING: Unknown action: "' + normalizedAction + '" (original: "' + action + '")');
        Logger.log('⚠️ Normalized action length: ' + normalizedAction.length);
        Logger.log('⚠️ Expected "getCompanyApprovers" length: ' + 'getCompanyApprovers'.length);
        Logger.log('⚠️ Are they equal? ' + (normalizedAction === 'getCompanyApprovers'));
        Logger.log('⚠️ Case-insensitive equal? ' + (normalizedAction.toLowerCase() === 'getcompanyapprovers'));
        
        // Fallback: Try case-insensitive match for getCompanyApprovers
        if (normalizedAction && normalizedAction.toLowerCase() === 'getcompanyapprovers') {
          Logger.log('⚠️ FALLBACK: Matched getCompanyApprovers case-insensitively, handling...');
          // Extract companyName
          let companyNameParam = null;
          if (requestBody) {
            companyNameParam = requestBody.companyName || requestBody.company || null;
          }
          return handleGetCompanyApprovers(requestBody, companyNameParam);
        }
        
        Logger.log('⚠️ Available actions: login, sendApprovalEmail, approveVoucher, rejectVoucher, getVoucherSummary, getVoucherHistory, getEmployees, getCompanyApprovers, getApprovalStatus, refreshApproverEmails');
        return createResponse(false, 'Action không hợp lệ: ' + normalizedAction + ' (length: ' + normalizedAction.length + ', expected: ' + 'getCompanyApprovers'.length + ')');
    }
  } catch (error) {
    // #region agent log
    try {
      UrlFetchApp.fetch('http://127.0.0.1:7242/ingest/cd238998-d527-4813-9e30-22fe3efc32e0', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({location: 'VOUCHER_WORKFLOW_BACKEND.gs:325', message: 'Error in doPost', data: {error: error.toString(), message: error.message}, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'G'})}).catch(() => {});
    } catch (e) {}
    // #endregion
    console.log('❌❌❌ CRITICAL ERROR in doPost: ' + error.toString());
    Logger.log('❌❌❌ CRITICAL ERROR in doPost: ' + error.toString());
    console.log('❌❌❌ Error stack: ' + error.stack);
    Logger.log('❌❌❌ Error stack: ' + error.stack);
    console.log('❌❌❌ Error message: ' + error.message);
    Logger.log('❌❌❌ Error message: ' + error.message);
    // Always return JSON, never HTML
    return createResponse(false, 'Lỗi Server: ' + error.message);
  }
}

/** HELPER FUNCTIONS FOR SEQUENTIAL APPROVAL */

/**
 * Initialize approvers meta structure with sequential approval order
 * Order: accountant (1) → legalRep (2) → treasurer (3)
 */
function initializeApproversMeta(companyApprovers) {
  if (!companyApprovers) {
    Logger.log('⚠️ No company approvers provided');
    return null;
  }
  
  return {
    approvers: {
      accountant: {
        email: companyApprovers.accountant ? companyApprovers.accountant.email : '',
        name: companyApprovers.accountant ? companyApprovers.accountant.name : '',
        status: 'pending',
        signature: '',
        approvedAt: null,
        rejectedAt: null,
        rejectReason: '',
        order: 1  // First approver
      },
      legalRep: {
        email: companyApprovers.legalRep ? companyApprovers.legalRep.email : '',
        name: companyApprovers.legalRep ? companyApprovers.legalRep.name : '',
        status: 'pending',
        signature: '',
        approvedAt: null,
        rejectedAt: null,
        rejectReason: '',
        order: 2  // Second approver (after accountant)
      },
      treasurer: {
        email: companyApprovers.treasurer ? companyApprovers.treasurer.email : '',
        name: companyApprovers.treasurer ? companyApprovers.treasurer.name : '',
        status: 'pending',
        signature: '',
        approvedAt: null,
        rejectedAt: null,
        rejectReason: '',
        order: 3  // Third approver (after legalRep) - Final
      }
    },
    overallStatus: 'Pending Approval',
    approvalProgress: '0/3',
    currentApprover: 'accountant',  // Who should approve next
    approvalSequence: ['accountant', 'legalRep', 'treasurer'],  // Order of approval
    displayStatus: 'Chờ duyệt',
    fullyApprovedAt: null,
    rejectedAt: null,
    rejectedBy: null
  };
}

/**
 * Get latest voucher entry from history
 */
function getVoucherFromHistory(voucherNumber) {
  try {
    const sheet = SpreadsheetApp.openById(VOUCHER_HISTORY_SHEET_ID).getSheetByName(VH_SHEET_NAME);
    if (!sheet) return null;
    
    const data = sheet.getDataRange().getValues();
    
    // Find FIRST entry (Submit row) to get base meta with companyApprovers
    // Column structure: A(0)=voucher_number, B(1)=voucher_type, C(2)=company_name,
    //   D(3)=company_key_or_taxid, E(4)=employee_name, F(5)=submited_email,
    //   G(6)=submitted_by, H(7)=submitted_at, I(8)=amount, J(9)=status,
    //   K(10)=due_date, L(11)=action, M(12)=attachments, N(13)=description,
    //   O(14)=note, P(15)=approver_email, Q(16)=approved_at, R(17)=MetaJSON
    let baseVoucher = null;
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === voucherNumber) {
        const metaJson = (data[i][17] || '').toString().trim();  // R = MetaJSON

        baseVoucher = {
          row: i + 1,
          voucherNumber: data[i][0],
          voucherType: data[i][1],
          company: data[i][2],
          companyKey: data[i][3] || '',
          employee: data[i][4],
          requestorEmail: data[i][5],
          submittedBy: data[i][6] || '',
          timestamp: data[i][7],        // H = submitted_at
          amount: data[i][8],
          status: data[i][9],
          dueDate: data[i][10] || '',
          action: data[i][11],
          attachments: data[i][12] || '',
          description: data[i][13] || '',
          note: data[i][14] || '',
          approverEmail: data[i][15],
          approvedAt: data[i][16] || '',
          meta: metaJson || null
        };
        break; // Found first row, stop
      }
    }
    
    if (!baseVoucher) return null;
    
    // Parse meta and update with approval status from subsequent rows
    if (baseVoucher.meta) {
      try {
        const meta = JSON.parse(baseVoucher.meta);
        
        // If has companyApprovers, scan all rows to update approval status
        if (meta.companyApprovers && meta.companyApprovers.approvers) {
          let approvalCount = 0;
          
          // Scan all rows for this voucher to find approvals
          for (let i = 1; i < data.length; i++) {
            if (data[i][0] === voucherNumber) {
              const rowAction = (data[i][11] || '').toString();  // L(11) = action
              const rowMetaJson = (data[i][17] || '').toString(); // R(17) = MetaJSON

              // Check if this row is an approval
              if (rowAction.includes('Approved')) {
                // Extract approvedBy email from MetaJSON column
                let rowApproverEmail = null;
                let rowMeta = null;
                if (rowMetaJson) {
                  try {
                    rowMeta = JSON.parse(rowMetaJson);
                    rowApproverEmail = rowMeta.approvedBy || null;
                    Logger.log(`Found approval row - approvedBy: ${rowApproverEmail}`);
                  } catch (e) {
                    Logger.log(`Failed to parse MetaJSON from approval row: ${e.toString()}`);
                  }
                }

                // If we found an approver email, match it to an approver role
                if (rowApproverEmail) {
                  for (const role in meta.companyApprovers.approvers) {
                    const approver = meta.companyApprovers.approvers[role];
                    if (approver.email === rowApproverEmail && approver.status !== 'approved') {
                      approver.status = 'approved';
                      approver.approvedAt = data[i][7]; // H(7) = submitted_at
                      approvalCount++;
                      Logger.log(`✅ Updated ${role} (${approver.name}) approval status from history scan`);
                      break;
                    }
                  }
                }
                // ✅ FALLBACK: If approvedBy not found, check rowMeta.companyApprovers directly
                else if (rowMeta && rowMeta.companyApprovers && rowMeta.companyApprovers.approvers) {
                  const rowApprovers = rowMeta.companyApprovers.approvers;
                  for (const role in rowApprovers) {
                    if (rowApprovers[role].status === 'approved' &&
                        meta.companyApprovers.approvers[role] &&
                        meta.companyApprovers.approvers[role].status !== 'approved') {
                      meta.companyApprovers.approvers[role].status = 'approved';
                      meta.companyApprovers.approvers[role].approvedAt = rowApprovers[role].approvedAt || data[i][7];
                      approvalCount++;
                      Logger.log(`✅ Updated ${role} approval status from rowMeta.companyApprovers (fallback)`);
                    }
                  }
                }
              }
            }
          }
          
          // Update approval progress
          meta.companyApprovers.approvalProgress = `${approvalCount}/3`;
          
          // Update currentApprover based on sequence
          const sequence = meta.companyApprovers.approvalSequence || ['accountant', 'legalRep', 'treasurer'];
          let nextApprover = null;
          for (const role of sequence) {
            if (meta.companyApprovers.approvers[role].status !== 'approved') {
              nextApprover = role;
              break;
            }
          }
          meta.companyApprovers.currentApprover = nextApprover;
          
          // Update overall status
          if (approvalCount === 3) {
            meta.companyApprovers.overallStatus = 'Approved';
            meta.companyApprovers.displayStatus = 'Đã duyệt';
          } else if (approvalCount > 0) {
            meta.companyApprovers.overallStatus = 'Partially Approved';
            meta.companyApprovers.displayStatus = `Đang duyệt (${approvalCount}/3)`;
          }
          
          // Update meta string with merged data
          baseVoucher.meta = JSON.stringify(meta);
        }
      } catch (parseError) {
        Logger.log('Error parsing/updating meta: ' + parseError.toString());
      }
    }
    
    return baseVoucher;
  } catch (error) {
    Logger.log('Error in getVoucherFromHistory: ' + error.toString());
    return null;
  }
}

/**
 * Count how many approvers have approved
 */
function countApprovals(approvers) {
  if (!approvers) return 0;
  let count = 0;
  if (approvers.accountant && approvers.accountant.status === 'approved') count++;
  if (approvers.legalRep && approvers.legalRep.status === 'approved') count++;
  if (approvers.treasurer && approvers.treasurer.status === 'approved') count++;
  return count;
}

/**
 * Get Vietnamese role name for approver
 */
function getApproverRoleName(role) {
  const roleMap = {
    'accountant': 'Kế toán trưởng',
    'legalRep': 'Đại diện pháp luật',
    'treasurer': 'Thủ quỹ'
  };
  return roleMap[role] || role;
}

/** 1. XỬ LÝ GỬI EMAIL & SUBMIT */
function handleSendEmail(requestBody) {
  // #region agent log
  try {
    UrlFetchApp.fetch('http://127.0.0.1:7242/ingest/cd238998-d527-4813-9e30-22fe3efc32e0', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({location: 'VOUCHER_WORKFLOW_BACKEND.gs:454', message: 'handleSendEmail entry', data: {hasEmail: !!requestBody.email, hasVoucher: !!requestBody.voucher, voucherNo: requestBody.voucher?.voucherNumber || 'N/A'}, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'A'})}).catch(() => {});
  } catch (e) {}
  // #endregion
  try {
    const emailData = requestBody.email;
    const requesterEmailData = requestBody.requesterEmail || null;
    const voucher = requestBody.voucher || {};
    if (!emailData || !emailData.to) return createResponse(false, 'Thiếu người nhận');

    const voucherNo = voucher.voucherNumber || 'AUTO-' + new Date().getTime();
    
    // ✅ CRITICAL FIX: Check for duplicate submission BEFORE processing
    Logger.log('🔍 Checking for duplicate submission: ' + voucherNo);
    // #region agent log
    try {
      UrlFetchApp.fetch('http://127.0.0.1:7242/ingest/cd238998-d527-4813-9e30-22fe3efc32e0', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({location: 'VOUCHER_WORKFLOW_BACKEND.gs:465', message: 'Before sheet access', data: {voucherNo: voucherNo, sheetId: VOUCHER_HISTORY_SHEET_ID, sheetName: VH_SHEET_NAME}, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'B'})}).catch(() => {});
    } catch (e) {}
    // #endregion
    const sheet = SpreadsheetApp.openById(VOUCHER_HISTORY_SHEET_ID).getSheetByName(VH_SHEET_NAME);
    
    if (!sheet) {
      Logger.log('❌ ERROR: Sheet "' + VH_SHEET_NAME + '" not found');
      // #region agent log
      try {
        UrlFetchApp.fetch('http://127.0.0.1:7242/ingest/cd238998-d527-4813-9e30-22fe3efc32e0', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({location: 'VOUCHER_WORKFLOW_BACKEND.gs:467', message: 'Sheet not found error', data: {sheetName: VH_SHEET_NAME}, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'B'})}).catch(() => {});
      } catch (e) {}
      // #endregion
      return createResponse(false, 'Lỗi: Không tìm thấy sheet lịch sử. Vui lòng kiểm tra cấu hình.');
    }
    
    // #region agent log
    try {
      UrlFetchApp.fetch('http://127.0.0.1:7242/ingest/cd238998-d527-4813-9e30-22fe3efc32e0', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({location: 'VOUCHER_WORKFLOW_BACKEND.gs:472', message: 'After sheet access, before getDataRange', data: {sheetFound: true}, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'B'})}).catch(() => {});
    } catch (e) {}
    // #endregion
    const data = sheet.getDataRange().getValues();
    const rows = data.slice(1); // Skip header
    
    // Check if this voucher was already submitted (action = 'Submit')
    for (let i = 0; i < rows.length; i++) {
      const rowVoucherNo = rows[i][0]; // A(0) = voucher_number
      const rowAction = rows[i][11];   // L(11) = action
      
      if (rowVoucherNo === voucherNo && rowAction === 'Submit') {
        Logger.log('⚠️ DUPLICATE SUBMISSION DETECTED: ' + voucherNo);
        Logger.log('⚠️ Found existing submission at row: ' + (i + 2)); // +2 for header and 0-index
        return createResponse(false, 'Phiếu này đã được gửi trước đó (số phiếu: ' + voucherNo + '). Vui lòng kiểm tra lại lịch sử phiếu.');
      }
    }
    
    Logger.log('✅ No duplicate found, proceeding with submission: ' + voucherNo);
    
    // #region agent log
    try {
      UrlFetchApp.fetch('http://127.0.0.1:7242/ingest/cd238998-d527-4813-9e30-22fe3efc32e0', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({location: 'VOUCHER_WORKFLOW_BACKEND.gs:487', message: 'After duplicate check, before file handling', data: {voucherNo: voucherNo, hasFiles: !!(voucher.files && voucher.files.length > 0)}, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'C'})}).catch(() => {});
    } catch (e) {}
    // #endregion
    
    let fileLinks = "";

    // Handle files - check if using Drive API or legacy base64
    if (voucher.files && voucher.files.length > 0) {
      Logger.log('📁 Files received: ' + voucher.files.length);
      Logger.log('📁 useDriveAPI value: ' + voucher.useDriveAPI);
      Logger.log('📁 useDriveAPI type: ' + typeof voucher.useDriveAPI);
      const useDriveAPI = voucher.useDriveAPI || false;
      Logger.log('📁 useDriveAPI after || false: ' + useDriveAPI);
      
      if (useDriveAPI) {
        // NEW: Files already uploaded to Drive by frontend
        // Just format the URLs for email/sheet
        Logger.log('✅ Using Drive API - files already uploaded by frontend');
        if (voucher.files.length > 0) {
          Logger.log('📄 First file structure: ' + JSON.stringify({
            fileName: voucher.files[0].fileName,
            hasFileUrl: !!voucher.files[0].fileUrl,
            fileUrl: voucher.files[0].fileUrl ? voucher.files[0].fileUrl.substring(0, 50) + '...' : 'MISSING',
            fileSize: voucher.files[0].fileSize
          }));
        }
        fileLinks = voucher.files.map(f => {
          const sizeMB = f.fileSize ? (f.fileSize / (1024 * 1024)).toFixed(2) + " MB" : '';
          const fileNameWithSize = sizeMB ? f.fileName + " (" + sizeMB + ")" : f.fileName;
          return fileNameWithSize + "\n" + f.fileUrl;
        }).join('\n\n');
      } else {
        // LEGACY: Upload base64 files to Drive (old method)
        Logger.log('⚠️ Using legacy base64 upload method');
        
        // Deduplicate files by fileName before uploading
        const uniqueFiles = [];
        const seenFileNames = new Set();
        for (const file of voucher.files) {
          if (!seenFileNames.has(file.fileName)) {
            seenFileNames.add(file.fileName);
            uniqueFiles.push(file);
          }
        }
        
        if (uniqueFiles.length > 0) {
          const uploaded = uploadFilesToDrive_(uniqueFiles, voucherNo);
          fileLinks = uploaded.map(f => {
            if (f.error) {
              return f.fileName + " (Lỗi upload)";
            }
            // Format: "filename.pdf (2.45 MB)\nhttps://drive.google.com/file/..."
            const sizeMB = f.fileSize ? (f.fileSize / (1024 * 1024)).toFixed(2) + " MB" : '';
            const fileNameWithSize = sizeMB ? f.fileName + " (" + sizeMB + ")" : f.fileName;
            return fileNameWithSize + "\n" + f.fileUrl;
          }).join('\n\n');
        }
      }
    }

    // #region agent log
    try {
      UrlFetchApp.fetch('http://127.0.0.1:7242/ingest/cd238998-d527-4813-9e30-22fe3efc32e0', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({location: 'VOUCHER_WORKFLOW_BACKEND.gs:543', message: 'After file handling, before approvers init', data: {fileLinksLength: fileLinks.length, hasCompanyApprovers: !!voucher.companyApprovers}, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'C'})}).catch(() => {});
    } catch (e) {}
    // #endregion

    // ✅ SEQUENTIAL APPROVAL: Initialize approvers meta if companyApprovers provided
    let approversMeta = null;
    if (voucher.companyApprovers) {
      approversMeta = initializeApproversMeta(voucher.companyApprovers);
      Logger.log('✅ Initialized approvers meta: ' + JSON.stringify({
        currentApprover: approversMeta.currentApprover,
        sequence: approversMeta.approvalSequence
      }));
      
      // ✅ SEQUENTIAL APPROVAL: Send email ONLY to first approver (Chief Accountant)
      if (approversMeta && approversMeta.approvers.accountant && approversMeta.approvers.accountant.email) {
        const firstApprover = approversMeta.approvers.accountant;
        Logger.log('📧 Sending email to first approver (Chief Accountant): ' + firstApprover.email);
        
        // Update emailData.to to send only to first approver
        emailData.to = firstApprover.email;
        
        Logger.log('✅ Updated emailData.to to first approver: ' + emailData.to);
      } else {
        Logger.log('⚠️ WARNING: Sequential approval enabled but Chief Accountant email not found!');
        Logger.log('approversMeta:', approversMeta ? 'exists' : 'null');
        if (approversMeta && approversMeta.approvers) {
          Logger.log('accountant exists:', approversMeta.approvers.accountant ? 'yes' : 'no');
          if (approversMeta.approvers.accountant) {
            Logger.log('accountant.email:', approversMeta.approvers.accountant.email || 'MISSING');
          }
        }
        // Don't fail - let it use original emailData.to as fallback
      }
      
      // Update requester notification to mention sequential approval (if approversMeta was created)
      if (requesterEmailData && requesterEmailData.body && approversMeta) {
        requesterEmailData.body = requesterEmailData.body.replace(
          /đã được gửi phê duyệt/g,
          'đã được gửi phê duyệt. Đã gửi email đến Kế toán trưởng để bắt đầu phê duyệt.'
        );
        
        // Add status review link
        const statusLink = 'https://workflow.egg-ventures.com/phieu_thu_chi.html?viewStatus=' + voucherNo;
        requesterEmailData.body += `
          <p style="margin-top: 15px;">
            <a href="${statusLink}" style="background: #4285f4; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
              🔍 Xem trạng thái phê duyệt
            </a>
          </p>
        `;
      }
    }

    // Validate emailData.to before sending
    if (!emailData.to || emailData.to.trim() === '') {
      Logger.log('❌ ERROR: emailData.to is empty or invalid');
      Logger.log('emailData:', emailData);
      return createResponse(false, 'Thiếu địa chỉ email người nhận. Vui lòng kiểm tra thông tin công ty và người phê duyệt.');
    }

    // Gửi email bằng GmailApp - to approvers
    try {
      Logger.log('📧 Preparing to send email to: ' + emailData.to);
      Logger.log('📧 Email subject: ' + emailData.subject);
      
      // #region agent log
      try {
        UrlFetchApp.fetch('http://127.0.0.1:7242/ingest/cd238998-d527-4813-9e30-22fe3efc32e0', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({location: 'VOUCHER_WORKFLOW_BACKEND.gs:601', message: 'Before GmailApp.sendEmail', data: {to: emailData.to, subject: emailData.subject?.substring(0, 50) || 'N/A', bodyLength: emailData.body?.length || 0}, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'D'})}).catch(() => {});
      } catch (e) {}
      // #endregion
      
      let options = { htmlBody: emailData.body };
      if (emailData.cc && emailData.cc.trim() !== "") options.cc = emailData.cc.trim();
      // Use logged-in user's email as reply-to (instead of script owner's email)
      if (emailData.replyTo && emailData.replyTo.trim() !== "") {
        options.replyTo = emailData.replyTo.trim();
        Logger.log('Setting reply-to to logged-in user email: ' + options.replyTo);
      }
      
      GmailApp.sendEmail(emailData.to, emailData.subject, '', options);
      Logger.log('✅ Email sent successfully to: ' + emailData.to);
      
      // #region agent log
      try {
        UrlFetchApp.fetch('http://127.0.0.1:7242/ingest/cd238998-d527-4813-9e30-22fe3efc32e0', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({location: 'VOUCHER_WORKFLOW_BACKEND.gs:614', message: 'After GmailApp.sendEmail', data: {success: true}, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'D'})}).catch(() => {});
      } catch (e) {}
      // #endregion
    } catch (emailError) {
      Logger.log('❌ ERROR sending email: ' + emailError.toString());
      Logger.log('❌ Error details: ' + JSON.stringify({
        message: emailError.message,
        stack: emailError.stack
      }));
      return createResponse(false, 'Lỗi gửi email đến người phê duyệt: ' + emailError.message);
    }

    // Gửi email thông báo cho requester
    if (requesterEmailData && requesterEmailData.to && requesterEmailData.to.trim() !== '') {
      try {
        // #region agent log
        try {
          UrlFetchApp.fetch('http://127.0.0.1:7242/ingest/cd238998-d527-4813-9e30-22fe3efc32e0', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({location: 'VOUCHER_WORKFLOW_BACKEND.gs:625', message: 'Before requester email send', data: {to: requesterEmailData.to}, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'D'})}).catch(() => {});
        } catch (e) {}
        // #endregion
        let requesterOptions = { htmlBody: requesterEmailData.body || '' };
        // Use logged-in user's email as reply-to for requester email too
        if (emailData.replyTo && emailData.replyTo.trim() !== "") {
          requesterOptions.replyTo = emailData.replyTo.trim();
          Logger.log('Setting reply-to for requester email: ' + requesterOptions.replyTo);
        }
        GmailApp.sendEmail(
          requesterEmailData.to,
          requesterEmailData.subject || '[THÔNG BÁO] Phiếu đã được gửi phê duyệt',
          '',
          requesterOptions
        );
        // #region agent log
        try {
          UrlFetchApp.fetch('http://127.0.0.1:7242/ingest/cd238998-d527-4813-9e30-22fe3efc32e0', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({location: 'VOUCHER_WORKFLOW_BACKEND.gs:634', message: 'After requester email send', data: {success: true}, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'D'})}).catch(() => {});
        } catch (e) {}
        // #endregion
      } catch (requesterEmailError) {
        // Log but don't fail - requester email is secondary
        Logger.log('Warning: Failed to send requester email: ' + requesterEmailError.toString());
        // #region agent log
        try {
          UrlFetchApp.fetch('http://127.0.0.1:7242/ingest/cd238998-d527-4813-9e30-22fe3efc32e0', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({location: 'VOUCHER_WORKFLOW_BACKEND.gs:640', message: 'Requester email send error', data: {error: requesterEmailError.toString()}, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'D'})}).catch(() => {});
        } catch (e) {}
        // #endregion
      }
    }

    // Store requester signature and other metadata in note field as JSON
    const submitMetaData = {
      requesterSignature: voucher.requesterSignature || '',
      reason: voucher.reason || '',
      voucherDate: voucher.voucherDate || '',
      department: voucher.department || '',
      payeeName: voucher.payeeName || '',
      amountInWords: voucher.amountInWords || '',
      expenseItems: voucher.expenseItems || [],
      submittedAt: new Date().toISOString()
    };
    
    // Include approvers meta in submit meta (for sequential approval)
    if (approversMeta) {
      submitMetaData.companyApprovers = approversMeta;
    }
    
    // #region agent log
    try {
      UrlFetchApp.fetch('http://127.0.0.1:7242/ingest/cd238998-d527-4813-9e30-22fe3efc32e0', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({location: 'VOUCHER_WORKFLOW_BACKEND.gs:662', message: 'Before appendHistory_', data: {voucherNo: voucherNo, action: 'Submit'}, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'E'})}).catch(() => {});
    } catch (e) {}
    // #endregion

    // Look up authoritative Company_Key_Or_Taxid from Master Company sheet col C
    let verifiedCompanyKey = voucher.companyKey || '';
    try {
      const compSheet = safeOpenSpreadsheet(TLCG_MASTER_DATA_SHEET_ID, 'verifyCompanyKey').getSheetByName(COMPANY_SHEET_NAME);
      if (compSheet) {
        const compData = compSheet.getDataRange().getValues().slice(1); // skip header row
        const searchName = (voucher.company || '').trim();
        for (let ci = 0; ci < compData.length; ci++) {
          if ((compData[ci][0] || '').toString().trim() === searchName) {
            const sheetKey = (compData[ci][2] || '').toString().trim(); // col C = Company_Key_Or_Taxid
            if (sheetKey) verifiedCompanyKey = sheetKey;
            break;
          }
        }
      }
    } catch (keyLookupErr) {
      Logger.log('⚠️ Could not verify companyKey from Master Company sheet: ' + keyLookupErr);
    }

    appendHistory_({
      voucherNumber: voucherNo,
      voucherType: voucher.voucherType || '',
      company: voucher.company || '',
      companyKey: verifiedCompanyKey,
      employee: voucher.employee || '',
      amount: voucher.amount || 0,
      status: 'Pending',
      action: 'Submit',
      requestorEmail: voucher.requestorEmail || '',
      submittedBy: voucher.submittedBy || voucher.employee || '',
      approverEmail: emailData.to,
      attachments: fileLinks,
      description: voucher.reason || voucher.description || '',
      note: 'Gửi phê duyệt',
      metaJson: JSON.stringify(submitMetaData)
    });

    // #region agent log
    try {
      UrlFetchApp.fetch('http://127.0.0.1:7242/ingest/cd238998-d527-4813-9e30-22fe3efc32e0', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({location: 'VOUCHER_WORKFLOW_BACKEND.gs:676', message: 'After appendHistory_, before return', data: {voucherNo: voucherNo}, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'E'})}).catch(() => {});
    } catch (e) {}
    // #endregion

    // #region agent log
    try {
      UrlFetchApp.fetch('http://127.0.0.1:7242/ingest/cd238998-d527-4813-9e30-22fe3efc32e0', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({location: 'VOUCHER_WORKFLOW_BACKEND.gs:678', message: 'Returning success response', data: {voucherNo: voucherNo}, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'F'})}).catch(() => {});
    } catch (e) {}
    // #endregion
    
    return createResponse(true, 'Đã gửi yêu cầu phê duyệt thành công');
  } catch (error) {
    // #region agent log
    try {
      UrlFetchApp.fetch('http://127.0.0.1:7242/ingest/cd238998-d527-4813-9e30-22fe3efc32e0', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({location: 'VOUCHER_WORKFLOW_BACKEND.gs:679', message: 'Error caught in handleSendEmail', data: {error: error.toString(), message: error.message}, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'G'})}).catch(() => {});
    } catch (e) {}
    // #endregion
    return createResponse(false, 'Lỗi gửi mail: ' + error.message);
  }
}

/** 2. PHÊ DUYỆT / TỪ CHỐI - SEQUENTIAL APPROVAL */

/**
 * Handle voucher approval with sequential workflow
 * Order: accountant → legalRep → treasurer
 */
function handleApproveVoucher(requestBody) {
  console.log('🟢 === APPROVE VOUCHER START ===');
  Logger.log('🟢 === APPROVE VOUCHER START ===');
  
  try {
    const v = requestBody.voucher || {};
    const voucherNumber = v.voucherNumber || '';
    const approverEmail = v.approverEmail || '';
    
    console.log('🟢 Voucher Number: ' + voucherNumber);
    console.log('🟢 Approver Email: ' + approverEmail);
    Logger.log('🟢 Voucher Number: ' + voucherNumber);
    Logger.log('🟢 Approver Email: ' + approverEmail);
    
    if (!voucherNumber) {
      return createResponse(false, 'Thiếu số phiếu');
    }
    
    // Get existing voucher data from history
    const existingVoucher = getVoucherFromHistory(voucherNumber);
    if (!existingVoucher) {
      return createResponse(false, 'Không tìm thấy phiếu: ' + voucherNumber);
    }
    
    // Parse meta from note field (getVoucherFromHistory now uses substring for full JSON)
    let meta = {};
    if (existingVoucher.meta) {
      try {
        meta = JSON.parse(existingVoucher.meta);
      } catch (e) {
        Logger.log('Error parsing meta: ' + e.toString());
        // Fallback: extract from note after "Meta: " (capture full string including newlines)
        const note = existingVoucher.note || '';
        const metaIdx = note.indexOf('Meta: ');
        if (metaIdx >= 0) {
          try {
            meta = JSON.parse(note.substring(metaIdx + 6).trim());
          } catch (e2) {
            Logger.log('Error parsing meta from note: ' + e2.toString());
          }
        }
      }
    }
    
    // Check if using sequential approval (has companyApprovers in meta)
    const companyApprovers = meta.companyApprovers;
    if (!companyApprovers || !companyApprovers.approvers) {
      // Fallback to old single-approval workflow
      Logger.log('⚠️ No companyApprovers found, using legacy single-approval workflow');
      return handleApproveVoucherLegacy(requestBody, existingVoucher);
    }
    
    // ✅ SEQUENTIAL APPROVAL WORKFLOW
    
    // 1. Identify which approver is approving
    let approverRole = null;
    if (companyApprovers.approvers.accountant && companyApprovers.approvers.accountant.email === approverEmail) {
      approverRole = 'accountant';
    } else if (companyApprovers.approvers.legalRep && companyApprovers.approvers.legalRep.email === approverEmail) {
      approverRole = 'legalRep';
    } else if (companyApprovers.approvers.treasurer && companyApprovers.approvers.treasurer.email === approverEmail) {
      approverRole = 'treasurer';
    }
    
    if (!approverRole) {
      return createResponse(false, 'Không tìm thấy thông tin người phê duyệt.');
    }

    // 1b. SECURITY: Prevent self-approval (requester cannot approve their own voucher)
    const requestorEmail = (v.requestorEmail || existingVoucher.requestorEmail || '').toLowerCase().trim();
    const currentApproverEmail = approverEmail.toLowerCase().trim();
    if (requestorEmail && currentApproverEmail && requestorEmail === currentApproverEmail) {
      Logger.log('❌ Self-approval attempt blocked: ' + approverEmail + ' tried to approve their own voucher');
      return createResponse(false, 'Người đề nghị không thể phê duyệt phiếu của chính họ.');
    }

    // 2. Check if this approver already approved
    if (companyApprovers.approvers[approverRole].status === 'approved') {
      return createResponse(false, 'Bạn đã phê duyệt phiếu này rồi.');
    }
    
    // 3. Check if voucher was already rejected
    if (companyApprovers.overallStatus === 'Rejected') {
      return createResponse(false, 'Phiếu này đã bị từ chối. Không thể phê duyệt.');
    }
    
    // 4. ✅ VALIDATE APPROVAL ORDER - Check if this is the current approver
    const currentApprover = companyApprovers.currentApprover || 'accountant';
    if (approverRole !== currentApprover) {
      const currentApproverName = companyApprovers.approvers[currentApprover] 
        ? companyApprovers.approvers[currentApprover].name 
        : getApproverRoleName(currentApprover);
      return createResponse(false, 
        `Vui lòng đợi ${currentApproverName} phê duyệt trước. ` +
        `Thứ tự phê duyệt: Kế toán trưởng → Đại diện pháp luật → Thủ quỹ.`
      );
    }
    
    // 5. Check if signature provided
    if (!v.approverSignature || v.approverSignature.trim() === '') {
      return createResponse(false, 'Vui lòng tải lên chữ ký trước khi phê duyệt');
    }
    
    // 6. Update this approver's status
    companyApprovers.approvers[approverRole].status = 'approved';
    companyApprovers.approvers[approverRole].signature = v.approverSignature;
    companyApprovers.approvers[approverRole].approvedAt = new Date().toISOString();

    // 6b. Store role-specific signature and name in meta for print template
    // Frontend expects meta.accountantSignature, meta.legalRepSignature, meta.treasurerSignature
    const approverName = v.approverName || companyApprovers.approvers[approverRole].name || v.approvedBy || '';
    if (approverRole === 'accountant') {
      meta.accountantSignature = v.approverSignature;
      meta.accountantName = approverName;
    } else if (approverRole === 'legalRep') {
      meta.legalRepSignature = v.approverSignature;
      meta.legalRepName = approverName;
    } else if (approverRole === 'treasurer') {
      meta.treasurerSignature = v.approverSignature;
      meta.treasurerName = approverName;
    }
    Logger.log('✅ Stored role-specific signature for: ' + approverRole + ', name: ' + approverName);

    // 6c. CRITICAL FIX: Enforce signature verification result
    if (v.signatureVerification) {
      Logger.log('🔍 Signature verification result: ' + JSON.stringify(v.signatureVerification));

      // CRITICAL FIX: Enforce verification result - block if not verified
      if (v.signatureVerification.verified !== true) {
        Logger.log('❌ Signature verification failed - blocking approval');
        return createResponse(false,
          'Chữ ký không hợp lệ. ' +
          'Lý do: ' + (v.signatureVerification.reason || 'unknown') + '. ' +
          (v.signatureVerification.similarity ?
            'Độ tương đồng: ' + v.signatureVerification.similarity + '% (yêu cầu: 75%)' :
            'Vui lòng sử dụng chữ ký mẫu đã đăng ký.')
        );
      }

      // Store verification result for audit trail
      meta.signatureVerification = meta.signatureVerification || {};
      meta.signatureVerification[approverRole] = {
        verified: v.signatureVerification.verified,
        similarity: v.signatureVerification.similarity,
        reason: v.signatureVerification.reason,
        verifiedAt: new Date().toISOString()
      };
    }

    // CRITICAL FIX: Require verification object to be present
    if (!v.signatureVerification || typeof v.signatureVerification !== 'object') {
      Logger.log('❌ Missing signature verification data');
      return createResponse(false,
        'Thiếu dữ liệu xác thực chữ ký. Vui lòng thử lại hoặc liên hệ quản trị viên.'
      );
    }

    // 7. Count approvals
    const approvalCount = countApprovals(companyApprovers.approvers);
    companyApprovers.approvalProgress = `${approvalCount}/3`;
    
    // 8. Update display status (user-friendly Vietnamese)
    if (approvalCount === 0) {
      companyApprovers.displayStatus = 'Chờ duyệt';
    } else if (approvalCount === 1) {
      companyApprovers.displayStatus = 'Đang duyệt (1/3)';
    } else if (approvalCount === 2) {
      companyApprovers.displayStatus = 'Đang duyệt (2/3)';
    } else if (approvalCount === 3) {
      companyApprovers.displayStatus = 'Đã duyệt';
    }
    
    // 9. Determine next approver in sequence
    const sequence = companyApprovers.approvalSequence || ['accountant', 'legalRep', 'treasurer'];
    const currentIndex = sequence.indexOf(approverRole);
    const nextIndex = currentIndex + 1;
    
    // 10. Check if this is the final approver (Treasurer)
    if (approverRole === 'treasurer' || approvalCount === 3) {
      // Final approval - All 3 have approved
      companyApprovers.overallStatus = 'Approved';
      companyApprovers.displayStatus = 'Đã duyệt';
      companyApprovers.currentApprover = null;
      companyApprovers.fullyApprovedAt = new Date().toISOString();

      // Update meta
      meta.companyApprovers = companyApprovers;
      // ✅ CRITICAL: Add approvedBy at root level for history scanning
      meta.approvedBy = approverEmail;

      // Append final approval entry
      appendHistory_({
        voucherNumber: voucherNumber,
        voucherType: v.voucherType || existingVoucher.voucherType || '',
        company: v.company || existingVoucher.company || '',
        companyKey: v.companyKey || existingVoucher.companyKey || '',
        employee: v.employee || existingVoucher.employee || '',
        amount: v.amount || existingVoucher.amount || 0,
        status: 'Approved',
        action: 'Fully Approved',
        requestorEmail: v.requestorEmail || existingVoucher.requestorEmail || '',
        submittedBy: v.submittedBy || existingVoucher.submittedBy || '',
        approverEmail: approverEmail,
        attachments: "",
        description: v.description || existingVoucher.description || '',
        note: 'Tất cả 3 người phê duyệt đã duyệt',
        approvedAt: new Date().toISOString(),
        metaJson: JSON.stringify(meta)
      });
      
      // Send final approval email to requester
      sendFinalApprovalEmail(v, companyApprovers, voucherNumber);
      
      Logger.log('✅ Voucher fully approved: ' + voucherNumber);
      return createResponse(true, 'Đã phê duyệt thành công. Phiếu đã được duyệt hoàn toàn.');
      
    } else {
      // Not final - Update current approver and send email to next
      const nextApproverRole = sequence[nextIndex];
      companyApprovers.currentApprover = nextApproverRole;
      companyApprovers.overallStatus = 'Partially Approved';

      // Update meta
      meta.companyApprovers = companyApprovers;
      // ✅ CRITICAL: Add approvedBy at root level for history scanning
      meta.approvedBy = approverEmail;

      // Append partial approval entry
      appendHistory_({
        voucherNumber: voucherNumber,
        voucherType: v.voucherType || existingVoucher.voucherType || '',
        company: v.company || existingVoucher.company || '',
        companyKey: v.companyKey || existingVoucher.companyKey || '',
        employee: v.employee || existingVoucher.employee || '',
        amount: v.amount || existingVoucher.amount || 0,
        status: companyApprovers.displayStatus,
        action: 'Approved by ' + companyApprovers.approvers[approverRole].name,
        requestorEmail: v.requestorEmail || existingVoucher.requestorEmail || '',
        submittedBy: v.submittedBy || existingVoucher.submittedBy || '',
        approverEmail: approverEmail,
        attachments: "",
        description: v.description || existingVoucher.description || '',
        note: `Đã duyệt bởi ${getApproverRoleName(approverRole)} (${approvalCount}/3)`,
        approvedAt: new Date().toISOString(),
        metaJson: JSON.stringify(meta)
      });
      
      // Send email to next approver in sequence
      Logger.log('🔍 Debug - nextApproverRole: ' + nextApproverRole);
      Logger.log('🔍 Debug - companyApprovers.approvers: ' + JSON.stringify(companyApprovers.approvers));
      Logger.log('🔍 Debug - sequence: ' + JSON.stringify(sequence));
      Logger.log('🔍 Debug - nextIndex: ' + nextIndex);
      
      const nextApprover = companyApprovers.approvers[nextApproverRole];
      if (nextApprover && nextApprover.email) {
        sendApprovalEmailToNextApprover(v, nextApprover, nextApproverRole, companyApprovers, voucherNumber, existingVoucher);
      } else {
        Logger.log('⚠️ Next approver not found or missing email for role: ' + nextApproverRole);
        Logger.log('⚠️ Available approvers: ' + Object.keys(companyApprovers.approvers || {}).join(', '));
      }
      
      // Send progress email to requester
      sendProgressEmail(v, approvalCount, companyApprovers, voucherNumber, existingVoucher);
      
      Logger.log('✅ Partial approval: ' + voucherNumber + ' - ' + approvalCount + '/3');
      return createResponse(true, 
        `Đã phê duyệt thành công. Đã gửi email đến ${nextApprover.name} để tiếp tục phê duyệt.`
      );
    }
    
  } catch (error) {
    console.log('❌❌❌ Error approving voucher: ' + error.toString());
    Logger.log('❌❌❌ Error approving voucher: ' + error.toString());
    console.log('❌❌❌ Error stack: ' + error.stack);
    Logger.log('❌❌❌ Error stack: ' + error.stack);
    console.log('❌❌❌ Error at line: ' + (error.lineNumber || 'unknown'));
    Logger.log('❌❌❌ Error at line: ' + (error.lineNumber || 'unknown'));
    return createResponse(false, 'Lỗi: ' + error.message);
  }
}

/**
 * Legacy single-approval workflow (backward compatibility)
 */
function handleApproveVoucherLegacy(requestBody, existingVoucher) {
  const v = requestBody.voucher || {};
  const voucherNumber = v.voucherNumber || '';

  // SECURITY: Prevent self-approval (requester cannot approve their own voucher)
  const requestorEmail = (v.requestorEmail || existingVoucher.requestorEmail || '').toLowerCase().trim();
  const currentApproverEmail = (v.approverEmail || '').toLowerCase().trim();
  if (requestorEmail && currentApproverEmail && requestorEmail === currentApproverEmail) {
    Logger.log('❌ Self-approval attempt blocked (legacy): ' + currentApproverEmail + ' tried to approve their own voucher');
    return createResponse(false, 'Người đề nghị không thể phê duyệt phiếu của chính họ.');
  }

  // Check if already approved or rejected
  const sheet = SpreadsheetApp.openById(VOUCHER_HISTORY_SHEET_ID).getSheetByName(VH_SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const rows = data.slice(1);
  
  let latestStatus = null;
  let latestAction = null;
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i][0] === voucherNumber) {
      latestStatus = rows[i][9] || '';   // J(9) = status
      latestAction = rows[i][11] || '';  // L(11) = action
      break;
    }
  }

  if (latestStatus === 'Approved' || latestAction === 'Approved') {
    return createResponse(false, 'Phiếu này đã được duyệt trước đó.');
  }
  
  if (latestStatus === 'Rejected' || latestAction === 'Rejected') {
    return createResponse(false, 'Phiếu này đã được từ chối trước đó.');
  }
  
  if (!v.approverSignature || v.approverSignature.trim() === '') {
    return createResponse(false, 'Vui lòng tải lên chữ ký trước khi phê duyệt');
  }
  
  const metaData = {
    approverSignature: v.approverSignature || '',
    approvedAt: new Date().toISOString(),
    approvedBy: v.approvedBy || v.approverEmail || ''
  };
  
  appendHistory_({
    voucherNumber: voucherNumber,
    voucherType: v.voucherType || existingVoucher.voucherType || '',
    company: v.company || existingVoucher.company || '',
    companyKey: v.companyKey || existingVoucher.companyKey || '',
    employee: v.employee || existingVoucher.employee || '',
    amount: v.amount || existingVoucher.amount || 0,
    status: 'Approved',
    action: 'Approved',
    requestorEmail: v.requestorEmail || existingVoucher.requestorEmail || '',
    approverEmail: v.approverEmail || '',
    attachments: "",
    description: v.description || existingVoucher.description || '',
    note: 'Duyệt qua Email',
    approvedAt: new Date().toISOString(),
    metaJson: JSON.stringify(metaData)
  });
  
  if (v.requestorEmail) {
    try {
      const emailSubject = "[ĐÃ DUYỆT] " + voucherNumber;
      const emailBody = `
        <p>Phiếu <strong>${voucherNumber}</strong> của bạn đã được duyệt.</p>
        <p>Được duyệt bởi: ${v.approvedBy || v.approverEmail || 'Người phê duyệt'}</p>
        <p>Thời gian: ${new Date().toLocaleString('vi-VN')}</p>
      `;
      GmailApp.sendEmail(v.requestorEmail, emailSubject, '', { htmlBody: emailBody });
    } catch (emailError) {
      Logger.log('Warning: Failed to send approval email: ' + emailError.toString());
    }
  }
  
  return createResponse(true, 'Đã duyệt thành công');
}

/**
 * Send approval email to next approver in sequence
 */
function sendApprovalEmailToNextApprover(voucher, nextApprover, approverRole, meta, voucherNumber, existingVoucher) {
  try {
    // Safety check
    if (!nextApprover || !nextApprover.email) {
      Logger.log('⚠️ Cannot send email: nextApprover or email is missing');
      Logger.log('⚠️ nextApprover:', nextApprover);
      Logger.log('⚠️ approverRole:', approverRole);
      return;
    }
    
    const baseUrl = 'https://workflow.egg-ventures.com';

    // Get voucher details from existingVoucher or voucher object
    const voucherType = voucher.voucherType || existingVoucher.voucherType || '';
    const companyName = voucher.company || existingVoucher.company || '';
    const employeeName = voucher.employee || existingVoucher.employee || '';
    const voucherAmount = voucher.amount || existingVoucher.amount || '';
    const requesterEmail = voucher.requestorEmail || existingVoucher.requestorEmail || '';

    // Build approval URL with all required parameters
    const approveUrl = `${baseUrl}/approve_voucher.html?` +
      `voucherNumber=${encodeURIComponent(voucherNumber)}&` +
      `voucherType=${encodeURIComponent(voucherType)}&` +
      `company=${encodeURIComponent(companyName)}&` +
      `employee=${encodeURIComponent(employeeName)}&` +
      `amount=${encodeURIComponent(voucherAmount)}&` +
      `requestorEmail=${encodeURIComponent(requesterEmail)}&` +
      `approverEmail=${encodeURIComponent(nextApprover.email)}&` +
      `approverRole=${approverRole}`;

    // Build reject URL with all required parameters
    const rejectUrl = `${baseUrl}/reject_voucher.html?` +
      `voucherNumber=${encodeURIComponent(voucherNumber)}&` +
      `voucherType=${encodeURIComponent(voucherType)}&` +
      `company=${encodeURIComponent(companyName)}&` +
      `employee=${encodeURIComponent(employeeName)}&` +
      `amount=${encodeURIComponent(voucherAmount)}&` +
      `requestorEmail=${encodeURIComponent(requesterEmail)}&` +
      `approverEmail=${encodeURIComponent(nextApprover.email)}&` +
      `approverRole=${approverRole}`;
    
    const statusLink = `${baseUrl}/phieu_thu_chi.html?viewStatus=${voucherNumber}`;
    const roleName = getApproverRoleName(approverRole);
    
    // Get previous approver info
    const previousApprover = approverRole === 'legalRep' 
      ? meta.approvers.accountant 
      : meta.approvers.legalRep;
    const previousRoleName = approverRole === 'legalRep' 
      ? 'Kế toán trưởng' 
      : 'Đại diện pháp luật';
    
    // Get previous approver details (date/time, email)
    const previousApprovedAt = previousApprover && previousApprover.approvedAt 
      ? new Date(previousApprover.approvedAt).toLocaleString('vi-VN') 
      : 'N/A';
    const previousApproverEmail = previousApprover && previousApprover.email 
      ? previousApprover.email 
      : 'N/A';
    
    const emailSubject = `[PHÊ DUYỆT] Phiếu ${voucherNumber} - ${roleName}`;
    const emailBody = `
      <p>Kính gửi ${nextApprover.name},</p>
      <p>Phiếu <strong>${voucherNumber}</strong> đã được phê duyệt bởi ${previousRoleName} ${previousApprover.name}.</p>
      
      ${previousApprover ? `
        <div style="background: #f0f9ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 15px 0; border-radius: 4px;">
          <h4 style="margin-top: 0; color: #1e40af;">Thông tin người đã duyệt:</h4>
          <ul style="margin: 10px 0; padding-left: 20px;">
            <li><strong>Tên:</strong> ${previousApprover.name}</li>
            <li><strong>Email:</strong> ${previousApproverEmail}</li>
            <li><strong>Vai trò:</strong> ${previousRoleName}</li>
            <li><strong>Ngày giờ duyệt:</strong> ${previousApprovedAt}</li>
          </ul>
        </div>
      ` : ''}
      
      <p>Vui lòng xem xét và phê duyệt phiếu này.</p>
      
      <h3>Thông tin phiếu:</h3>
      <ul>
        <li><strong>Số phiếu:</strong> ${voucherNumber}</li>
        <li><strong>Loại phiếu:</strong> ${voucher.voucherType || existingVoucher.voucherType || 'N/A'}</li>
        <li><strong>Công ty:</strong> ${voucher.company || existingVoucher.company || 'N/A'}</li>
        <li><strong>Người đề nghị:</strong> ${employeeName}</li>
        ${(voucher.submittedBy || existingVoucher.submittedBy || '') && (voucher.submittedBy || existingVoucher.submittedBy) !== employeeName ? `<li><strong>Người nộp phiếu:</strong> ${voucher.submittedBy || existingVoucher.submittedBy}</li>` : ''}
        <li><strong>Số tiền:</strong> ${typeof voucher.amount === 'number' ? voucher.amount.toLocaleString('vi-VN') + ' ₫' : voucher.amount || existingVoucher.amount || '0 ₫'}</li>
      </ul>
      
      <h3>Tiến độ phê duyệt:</h3>
      <p>${meta.displayStatus} (${meta.approvalProgress})</p>
      
      <p>
        <a href="${approveUrl}" style="background: #34A853; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin-right: 10px;">
          ✅ Phê duyệt
        </a>
        <a href="${rejectUrl}" style="background: #EA4335; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          ❌ Từ chối
        </a>
      </p>
      
      <p style="margin-top: 15px;">
        <a href="${statusLink}" style="background: #4285f4; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
          🔍 Xem trạng thái chi tiết
        </a>
      </p>
      
      <p>Trân trọng,<br>Hệ thống Workflow TLC Group</p>
    `;
    
    GmailApp.sendEmail(nextApprover.email, emailSubject, '', { htmlBody: emailBody });
    Logger.log('✅ Sent approval email to next approver: ' + nextApprover.email);
  } catch (error) {
    Logger.log('❌ Error sending email to next approver: ' + error.toString());
  }
}

/**
 * Send progress update email to requester
 */
function sendProgressEmail(voucher, approvalCount, meta, voucherNumber, existingVoucher) {
  try {
    const requesterEmail = voucher.requestorEmail || existingVoucher.requestorEmail;
    if (!requesterEmail) {
      Logger.log('⚠️ No requester email, skipping progress email');
      return;
    }
    
    const statusLink = `https://workflow.egg-ventures.com/phieu_thu_chi.html?viewStatus=${voucherNumber}`;
    const roleName = meta.currentApprover ? getApproverRoleName(meta.currentApprover) : '';
    
    // Update subject format: [ĐANG DUYỆT (X/3)] instead of [TIẾN ĐỘ PHÊ DUYỆT]
    const emailSubject = `[ĐANG DUYỆT (${approvalCount}/3)] Phiếu ${voucherNumber}`;
    
    // Tìm người đã duyệt gần nhất
    let lastApprover = null;
    let lastApproverRole = null;
    const sequence = ['accountant', 'legalRep', 'treasurer'];
    for (let i = sequence.length - 1; i >= 0; i--) {
      const role = sequence[i];
      if (meta.approvers[role] && meta.approvers[role].status === 'approved') {
        lastApprover = meta.approvers[role];
        lastApproverRole = role;
        break;
      }
    }
    
    // Build approvers status list
    let approversListHtml = '';
    if (meta.approvers.accountant) {
      const acc = meta.approvers.accountant;
      const accStatus = acc.status === 'approved' ? '✅' : (meta.currentApprover === 'accountant' ? '⏳' : '⏳');
      const accText = acc.status === 'approved' 
        ? `Đã duyệt lúc: ${new Date(acc.approvedAt).toLocaleString('vi-VN')}`
        : (meta.currentApprover === 'accountant' ? 'Đang chờ phê duyệt...' : 'Chưa đến lượt');
      approversListHtml += `<li>${accStatus} <strong>Kế toán trưởng:</strong> ${acc.name}<br>${accText}</li>`;
    }
    
    if (meta.approvers.legalRep) {
      const legal = meta.approvers.legalRep;
      const legalStatus = legal.status === 'approved' ? '✅' : (meta.currentApprover === 'legalRep' ? '⏳' : '⏳');
      const legalText = legal.status === 'approved' 
        ? `Đã duyệt lúc: ${new Date(legal.approvedAt).toLocaleString('vi-VN')}`
        : (meta.currentApprover === 'legalRep' ? 'Đang chờ phê duyệt...' : 'Chưa đến lượt');
      approversListHtml += `<li>${legalStatus} <strong>Đại diện pháp luật:</strong> ${legal.name}<br>${legalText}</li>`;
    }
    
    if (meta.approvers.treasurer) {
      const treas = meta.approvers.treasurer;
      const treasStatus = treas.status === 'approved' ? '✅' : (meta.currentApprover === 'treasurer' ? '⏳' : '⏳');
      const treasText = treas.status === 'approved' 
        ? `Đã duyệt lúc: ${new Date(treas.approvedAt).toLocaleString('vi-VN')}`
        : (meta.currentApprover === 'treasurer' ? 'Đang chờ phê duyệt...' : 'Chưa đến lượt');
      approversListHtml += `<li>${treasStatus} <strong>Thủ quỹ:</strong> ${treas.name}<br>${treasText}</li>`;
    }
    
    // Build last approver details section
    let lastApproverDetailsHtml = '';
    if (lastApprover && lastApproverRole) {
      const lastApproverRoleName = getApproverRoleName(lastApproverRole);
      const approvedAt = lastApprover.approvedAt ? new Date(lastApprover.approvedAt).toLocaleString('vi-VN') : 'N/A';
      lastApproverDetailsHtml = `
        <div style="background: #f0f9ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; border-radius: 4px;">
          <h3 style="margin-top: 0; color: #1e40af;">✅ Người đã duyệt gần nhất:</h3>
          <ul style="margin: 10px 0; padding-left: 20px;">
            <li><strong>Tên:</strong> ${lastApprover.name}</li>
            <li><strong>Email:</strong> ${lastApprover.email || 'N/A'}</li>
            <li><strong>Vai trò:</strong> ${lastApproverRoleName}</li>
            <li><strong>Ngày giờ duyệt:</strong> ${approvedAt}</li>
            <li><strong>Số phiếu:</strong> ${voucherNumber}</li>
          </ul>
        </div>
      `;
    }
    
    const emailBody = `
      <p>Kính gửi Anh/Chị,</p>
      <p>Phiếu <strong>${voucherNumber}</strong> của Anh/Chị đang được xử lý:</p>
      
      <h3>📊 Tiến độ phê duyệt: ${approvalCount}/3 người đã duyệt</h3>
      
      ${lastApproverDetailsHtml}
      
      <h4>Danh sách người phê duyệt:</h4>
      <ul>
        ${approversListHtml}
      </ul>
      
      ${meta.currentApprover ? `
        <p>⏳ <strong>Đang chờ:</strong> ${meta.approvers[meta.currentApprover].name} (${roleName}) phê duyệt</p>
      ` : ''}
      
      <p>Thứ tự phê duyệt: Kế toán trưởng → Đại diện pháp luật → Thủ quỹ</p>
      
      <p style="margin-top: 15px;">
        <a href="${statusLink}" style="background: #4285f4; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
          🔍 Xem trạng thái chi tiết
        </a>
      </p>
      
      <p>Trân trọng,<br>Hệ thống Workflow TLC Group</p>
    `;
    
    GmailApp.sendEmail(requesterEmail, emailSubject, '', { htmlBody: emailBody });
    Logger.log('✅ Sent progress email to requester: ' + requesterEmail);
  } catch (error) {
    Logger.log('❌ Error sending progress email: ' + error.toString());
  }
}

/**
 * Send final approval email to requester
 */
function sendFinalApprovalEmail(voucher, meta, voucherNumber) {
  try {
    const requesterEmail = voucher.requestorEmail;
    if (!requesterEmail) {
      Logger.log('⚠️ No requester email, skipping final approval email');
      return;
    }
    
    const emailSubject = `[ĐÃ DUYỆT HOÀN TOÀN] Phiếu ${voucherNumber}`;
    
    let approversListHtml = '';
    if (meta.approvers.accountant && meta.approvers.accountant.status === 'approved') {
      approversListHtml += `<li>✅ <strong>Bước 1: Kế toán trưởng</strong> - ${meta.approvers.accountant.name}<br>Đã duyệt lúc: ${new Date(meta.approvers.accountant.approvedAt).toLocaleString('vi-VN')}</li>`;
    }
    if (meta.approvers.legalRep && meta.approvers.legalRep.status === 'approved') {
      approversListHtml += `<li>✅ <strong>Bước 2: Đại diện pháp luật</strong> - ${meta.approvers.legalRep.name}<br>Đã duyệt lúc: ${new Date(meta.approvers.legalRep.approvedAt).toLocaleString('vi-VN')}</li>`;
    }
    if (meta.approvers.treasurer && meta.approvers.treasurer.status === 'approved') {
      approversListHtml += `<li>✅ <strong>Bước 3: Thủ quỹ</strong> - ${meta.approvers.treasurer.name}<br>Đã duyệt lúc: ${new Date(meta.approvers.treasurer.approvedAt).toLocaleString('vi-VN')} (Duyệt cuối cùng)</li>`;
    }
    
    const emailBody = `
      <p>Kính gửi Anh/Chị,</p>
      <p>Phiếu <strong>${voucherNumber}</strong> của Anh/Chị đã được tất cả 3 người phê duyệt theo thứ tự:</p>
      
      <ul>
        ${approversListHtml}
      </ul>
      
      <p><strong>Phiếu đã được duyệt hoàn toàn và sẵn sàng để xử lý.</strong></p>
      
      <p>Trân trọng,<br>Hệ thống Workflow TLC Group</p>
    `;
    
    GmailApp.sendEmail(requesterEmail, emailSubject, '', { htmlBody: emailBody });
    Logger.log('✅ Sent final approval email to requester: ' + requesterEmail);
  } catch (error) {
    Logger.log('❌ Error sending final approval email: ' + error.toString());
  }
}

function handleRejectVoucher(requestBody) {
  try {
    const v = requestBody.voucher || {};
    const voucherNumber = v.voucherNumber || '';
    const approverEmail = v.approverEmail || '';
    
    if (!voucherNumber) {
      return createResponse(false, 'Thiếu số phiếu');
    }
    
    // Validate reject reason
    const rejectReason = v.rejectReason || '';
    if (!rejectReason || rejectReason.trim() === '') {
      return createResponse(false, 'Vui lòng nhập lý do từ chối');
    }
    
    // Get existing voucher data
    const existingVoucher = getVoucherFromHistory(voucherNumber);
    if (!existingVoucher) {
      return createResponse(false, 'Không tìm thấy phiếu: ' + voucherNumber);
    }
    
    // Parse meta (full JSON after "Meta: " from getVoucherFromHistory)
    let meta = {};
    if (existingVoucher.meta) {
      try {
        meta = JSON.parse(existingVoucher.meta);
      } catch (e) {
        const note = existingVoucher.note || '';
        const metaIdx = note.indexOf('Meta: ');
        if (metaIdx >= 0) {
          try {
            meta = JSON.parse(note.substring(metaIdx + 6).trim());
          } catch (e2) {
            Logger.log('Error parsing meta from note: ' + e2.toString());
          }
        }
      }
    }
    
    // Check if using sequential approval
    const companyApprovers = meta.companyApprovers;
    if (companyApprovers && companyApprovers.approvers) {
      // ✅ SEQUENTIAL APPROVAL REJECTION
      
      // Identify which approver is rejecting
      let approverRole = null;
      if (companyApprovers.approvers.accountant && companyApprovers.approvers.accountant.email === approverEmail) {
        approverRole = 'accountant';
      } else if (companyApprovers.approvers.legalRep && companyApprovers.approvers.legalRep.email === approverEmail) {
        approverRole = 'legalRep';
      } else if (companyApprovers.approvers.treasurer && companyApprovers.approvers.treasurer.email === approverEmail) {
        approverRole = 'treasurer';
      }
      
      if (!approverRole) {
        return createResponse(false, 'Không tìm thấy thông tin người từ chối.');
      }
      
      // Check if already rejected
      if (companyApprovers.overallStatus === 'Rejected') {
        return createResponse(false, 'Phiếu này đã được từ chối trước đó.');
      }
      
      // Update approver status to rejected
      companyApprovers.approvers[approverRole].status = 'rejected';
      companyApprovers.approvers[approverRole].rejectedAt = new Date().toISOString();
      companyApprovers.approvers[approverRole].rejectReason = rejectReason;
      
      // Set overall status to Rejected (stops workflow)
      companyApprovers.overallStatus = 'Rejected';
      companyApprovers.displayStatus = 'Đã từ chối';
      companyApprovers.rejectedAt = new Date().toISOString();
      companyApprovers.rejectedBy = approverEmail;
      companyApprovers.currentApprover = null; // Stop workflow
      
      // Update meta
      meta.companyApprovers = companyApprovers;
      
      // Append rejection entry
      appendHistory_({
        voucherNumber: voucherNumber,
        voucherType: v.voucherType || existingVoucher.voucherType || '',
        company: v.company || existingVoucher.company || '',
        companyKey: v.companyKey || existingVoucher.companyKey || '',
        employee: v.employee || existingVoucher.employee || '',
        amount: v.amount || existingVoucher.amount || 0,
        status: 'Rejected',
        action: 'Rejected by ' + companyApprovers.approvers[approverRole].name,
        requestorEmail: v.requestorEmail || existingVoucher.requestorEmail || '',
        submittedBy: v.submittedBy || existingVoucher.submittedBy || '',
        approverEmail: approverEmail,
        attachments: "",
        description: v.description || existingVoucher.description || '',
        note: `Từ chối bởi ${getApproverRoleName(approverRole)}\nLý do: ${rejectReason}`,
        approvedAt: '',
        metaJson: JSON.stringify(meta)
      });
      
      // Send rejection email to requester
      const requesterEmail = v.requestorEmail || existingVoucher.requestorEmail;
      if (requesterEmail) {
        try {
          const statusLink = `https://workflow.egg-ventures.com/phieu_thu_chi.html?viewStatus=${voucherNumber}`;
          const emailSubject = "[TỪ CHỐI] Phiếu " + voucherNumber;
          const emailBody = `
            <p>Kính gửi Anh/Chị,</p>
            <p>Phiếu <strong>${voucherNumber}</strong> đã bị từ chối.</p>
            <p><strong>Người từ chối:</strong> ${companyApprovers.approvers[approverRole].name} (${getApproverRoleName(approverRole)})</p>
            <p><strong>Lý do:</strong> ${rejectReason}</p>
            <p><strong>Thời gian:</strong> ${new Date().toLocaleString('vi-VN')}</p>
            <p style="margin-top: 15px;">
              <a href="${statusLink}" style="background: #4285f4; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
                🔍 Xem trạng thái chi tiết
              </a>
            </p>
            <p>Trân trọng,<br>Hệ thống Workflow TLC Group</p>
          `;
          GmailApp.sendEmail(requesterEmail, emailSubject, '', { htmlBody: emailBody });
        } catch (emailError) {
          Logger.log('Warning: Failed to send rejection email: ' + emailError.toString());
        }
      }
      
      Logger.log('✅ Voucher rejected successfully: ' + voucherNumber);
      return createResponse(true, 'Đã từ chối phiếu');
    } else {
      // Legacy single-approval rejection
      const sheet = SpreadsheetApp.openById(VOUCHER_HISTORY_SHEET_ID).getSheetByName(VH_SHEET_NAME);
      const data = sheet.getDataRange().getValues();
      const rows = data.slice(1);
      
      let latestStatus = null;
      let latestAction = null;
      for (let i = rows.length - 1; i >= 0; i--) {
        if (rows[i][0] === voucherNumber) {
          latestStatus = rows[i][9] || '';   // J(9) = status
          latestAction = rows[i][11] || '';  // L(11) = action
          break;
        }
      }
      
      if (latestStatus === 'Approved' || latestAction === 'Approved') {
        return createResponse(false, 'Phiếu này đã được duyệt. Không thể từ chối.');
      }
      
      if (latestStatus === 'Rejected' || latestAction === 'Rejected') {
        return createResponse(false, 'Phiếu này đã được từ chối trước đó.');
      }
      
      appendHistory_({
        voucherNumber: v.voucherNumber || '',
        voucherType: v.voucherType || '',
        company: v.company || '',
        employee: v.employee || '',
        amount: v.amount || 0,
        status: 'Rejected',
        action: 'Rejected',
        requestorEmail: v.requestorEmail || '',
        approverEmail: v.approverEmail || '',
        attachments: "",
        note: v.rejectReason || 'Từ chối',
        approvedAt: '',
        metaJson: ''
      });
      
      if (v.requestorEmail) {
        GmailApp.sendEmail(v.requestorEmail, "[TỪ CHỐI] " + (v.voucherNumber || ''), "Lý do: " + (v.rejectReason || ''));
      }
      
      return createResponse(true, 'Đã từ chối phiếu');
    }
  } catch (error) {
    Logger.log('❌ Error rejecting voucher: ' + error.toString());
    return createResponse(false, 'Lỗi: ' + error.message);
  }
}

/** 3. STATUS REVIEW */
function handleGetApprovalStatus(requestBody) {
  try {
    const voucherNumber = requestBody.voucherNumber || '';

    if (!voucherNumber) {
      return createResponse(false, 'Thiếu số phiếu');
    }

    // Get latest voucher entry from history
    const existingVoucher = getVoucherFromHistory(voucherNumber);
    if (!existingVoucher) {
      return createResponse(false, 'Không tìm thấy phiếu: ' + voucherNumber);
    }

    // Parse meta from note field (full JSON after "Meta: " from getVoucherFromHistory)
    let meta = {};
    if (existingVoucher.meta) {
      try {
        meta = JSON.parse(existingVoucher.meta);
      } catch (e) {
        Logger.log('Error parsing meta: ' + e.toString());
        // Fallback: extract from note after "Meta: "
        const note = existingVoucher.note || '';
        const metaIdx = note.indexOf('Meta: ');
        if (metaIdx >= 0) {
          try {
            meta = JSON.parse(note.substring(metaIdx + 6).trim());
          } catch (e2) {
            Logger.log('Error parsing meta from note: ' + e2.toString());
          }
        }
      }
    }

    // Get companyApprovers from meta
    let companyApprovers = meta.companyApprovers || {};

    // ✅ NEW: If approvers data is missing or empty, fetch from company master data
    const hasApprovers = companyApprovers.approvers &&
                        typeof companyApprovers.approvers === 'object' &&
                        Object.keys(companyApprovers.approvers).length > 0;

    if (!hasApprovers) {
      Logger.log('⚠️ Approvers data missing in voucher meta, fetching from company master data');
      Logger.log('🔍 Debug - companyApprovers:', JSON.stringify(companyApprovers));
      Logger.log('🔍 Debug - meta:', JSON.stringify(meta));

      const companyName = existingVoucher.company;
      Logger.log('🔍 Company name from voucher:', companyName);

      if (companyName) {
        try {
          Logger.log('🔄 Attempting to fetch company approvers...');
          // Fetch company approvers using existing function
          const companyResult = handleGetCompanyApprovers({ companyName: companyName }, companyName);
          Logger.log('🔍 Company approvers fetch result:', JSON.stringify(companyResult));

          if (companyResult.success && companyResult.data && companyResult.data.approvers) {
            Logger.log('✅ Successfully fetched company approvers for: ' + companyName);
            Logger.log('🔍 Fetched approvers:', JSON.stringify(companyResult.data.approvers));

            // Initialize approvers structure with fetched data
            const fetchedApprovers = companyResult.data.approvers;
            companyApprovers = {
              approvers: {
                accountant: {
                  email: fetchedApprovers.accountant ? fetchedApprovers.accountant.email : '',
                  name: fetchedApprovers.accountant ? fetchedApprovers.accountant.name : '',
                  status: 'pending',
                  signature: '',
                  approvedAt: null,
                  order: 1
                },
                legalRep: {
                  email: fetchedApprovers.legalRep ? fetchedApprovers.legalRep.email : '',
                  name: fetchedApprovers.legalRep ? fetchedApprovers.legalRep.name : '',
                  status: 'pending',
                  signature: '',
                  approvedAt: null,
                  order: 2
                },
                treasurer: {
                  email: fetchedApprovers.treasurer ? fetchedApprovers.treasurer.email : '',
                  name: fetchedApprovers.treasurer ? fetchedApprovers.treasurer.name : '',
                  status: 'pending',
                  signature: '',
                  approvedAt: null,
                  order: 3
                }
              },
              overallStatus: existingVoucher.status || 'Pending Approval',
              approvalProgress: '0/3',
              currentApprover: 'accountant',
              displayStatus: 'Chờ duyệt'
            };

            Logger.log('✅ Initialized approvers structure with company data');
            Logger.log('🔍 Final companyApprovers:', JSON.stringify(companyApprovers));
          } else {
            Logger.log('⚠️ Could not fetch company approvers: ' + (companyResult.message || 'Unknown error'));
            Logger.log('⚠️ companyResult.success:', companyResult.success);
            Logger.log('⚠️ companyResult.data:', companyResult.data ? 'exists' : 'null');
            if (companyResult.data) {
              Logger.log('⚠️ companyResult.data.approvers:', companyResult.data.approvers ? 'exists' : 'null');
              // Even if fetch failed, try to extract accountant name if available
              if (companyResult.data.approvers && companyResult.data.approvers.accountant) {
                const fetchedAccountant = companyResult.data.approvers.accountant;
                if (fetchedAccountant.name) {
                  // Set minimal approvers structure with just accountant name
                  companyApprovers.approvers = {
                    accountant: {
                      name: fetchedAccountant.name,
                      email: fetchedAccountant.email || '',
                      status: 'pending',
                      signature: '',
                      approvedAt: null,
                      order: 1
                    }
                  };
                  companyApprovers.currentApprover = 'accountant';
                  Logger.log('✅ Extracted accountant name from failed fetch: ' + fetchedAccountant.name);
                }
              }
            }
            // If still no approvers, set currentApprover to 'accountant' for 0/3 status
            if (!companyApprovers.approvers || Object.keys(companyApprovers.approvers).length === 0) {
              const progress = companyApprovers.approvalProgress || '0/3';
              const progressNum = parseInt(progress.split('/')[0]) || 0;
              if (progressNum === 0) {
                companyApprovers.currentApprover = 'accountant';
                Logger.log('✅ Set currentApprover to accountant for 0/3 status');
              }
            }
          }
        } catch (fetchError) {
          Logger.log('❌ Error fetching company approvers: ' + fetchError.toString());
          Logger.log('❌ Error stack:', fetchError.stack);
          // Set currentApprover to 'accountant' for 0/3 status even on error
          const progress = companyApprovers.approvalProgress || '0/3';
          const progressNum = parseInt(progress.split('/')[0]) || 0;
          if (progressNum === 0) {
            companyApprovers.currentApprover = 'accountant';
            Logger.log('✅ Set currentApprover to accountant for 0/3 status (after error)');
          }
        }
      } else {
        Logger.log('⚠️ No company name in voucher, cannot fetch approvers');
        // Set currentApprover to 'accountant' for 0/3 status
        const progress = companyApprovers.approvalProgress || '0/3';
        const progressNum = parseInt(progress.split('/')[0]) || 0;
        if (progressNum === 0) {
          companyApprovers.currentApprover = 'accountant';
        }
      }
    } else {
      Logger.log('✅ Approvers data already exists in voucher meta');
      Logger.log('🔍 Existing approvers:', JSON.stringify(companyApprovers.approvers));
      // Ensure currentApprover is set for 0/3 status
      if (!companyApprovers.currentApprover) {
        const progress = companyApprovers.approvalProgress || '0/3';
        const progressNum = parseInt(progress.split('/')[0]) || 0;
        if (progressNum === 0) {
          companyApprovers.currentApprover = 'accountant';
        }
      }
    }

    // Build status response
    // Try to get currentApproverName even if approvers is partially populated
    let currentApproverName = null;
    if (companyApprovers.currentApprover && companyApprovers.approvers) {
      const currentApproverData = companyApprovers.approvers[companyApprovers.currentApprover];
      if (currentApproverData && currentApproverData.name) {
        currentApproverName = currentApproverData.name;
      }
    }
    
    // ✅ If currentApproverName is still null but we have currentApprover='accountant' for 0/3,
    // try to fetch company approvers one more time to get just the accountant name
    if (!currentApproverName && companyApprovers.currentApprover === 'accountant') {
      const progress = companyApprovers.approvalProgress || '0/3';
      const progressNum = parseInt(progress.split('/')[0]) || 0;
      if (progressNum === 0) {
        const companyName = existingVoucher.company;
        if (companyName) {
          try {
            Logger.log('🔄 Retrying to fetch accountant name for currentApproverName...');
            const companyResult = handleGetCompanyApprovers({ companyName: companyName }, companyName);
            if (companyResult.success && companyResult.data && companyResult.data.approvers) {
              const accountant = companyResult.data.approvers.accountant;
              if (accountant && accountant.name) {
                currentApproverName = accountant.name;
                Logger.log('✅ Successfully fetched accountant name for currentApproverName: ' + accountant.name);
                
                // Also update approvers if it's empty
                if (!companyApprovers.approvers || Object.keys(companyApprovers.approvers).length === 0) {
                  companyApprovers.approvers = {
                    accountant: {
                      name: accountant.name,
                      email: accountant.email || '',
                      status: 'pending',
                      signature: '',
                      approvedAt: null,
                      order: 1
                    }
                  };
                  Logger.log('✅ Updated approvers with accountant data');
                }
              }
            }
          } catch (retryError) {
            Logger.log('⚠️ Retry fetch failed: ' + retryError.toString());
          }
        }
      }
    }
    
    const statusData = {
      voucherNumber: voucherNumber,
      overallStatus: companyApprovers.overallStatus || existingVoucher.status || 'Pending Approval',
      displayStatus: companyApprovers.displayStatus || 'Chờ duyệt',
      approvalProgress: companyApprovers.approvalProgress || '0/3',
      currentApprover: companyApprovers.currentApprover || null,
      currentApproverName: currentApproverName,
      approvers: companyApprovers.approvers || {},
      requesterEmail: existingVoucher.requestorEmail || '',
      submittedAt: existingVoucher.timestamp || '',
      lastUpdatedAt: new Date().toISOString()
    };

    return createResponse(true, 'Thành công', statusData);
  } catch (error) {
    Logger.log('❌ Error in handleGetApprovalStatus: ' + error.toString());
    return createResponse(false, 'Lỗi: ' + error.message);
  }
}

/** 4. LOGIN & THỐNG KÊ */
function handleLogin_(requestBody) {
  try {
    Logger.log('=== handleLogin_ called ===');
    Logger.log('USERS_SHEET_ID: ' + USERS_SHEET_ID);
    Logger.log('EMPLOYEES_SHEET_NAME: ' + EMPLOYEES_SHEET_NAME);
    Logger.log('Email attempting login: ' + (requestBody.email || 'undefined'));

    // Check if USERS_SHEET_ID is defined
    if (!USERS_SHEET_ID || USERS_SHEET_ID === '') {
      Logger.log('❌ ERROR: USERS_SHEET_ID is not defined');
      return createResponse(false, 'Cấu hình không đúng: USERS_SHEET_ID không được định nghĩa. Vui lòng kiểm tra cấu hình spreadsheet ID trong script.');
    }

    // Try to open the spreadsheet with detailed error handling
    let ss;
    try {
      Logger.log('Attempting to open spreadsheet with ID: ' + USERS_SHEET_ID);
      ss = SpreadsheetApp.openById(USERS_SHEET_ID);
      Logger.log('✅ Successfully opened spreadsheet');
    } catch (openError) {
      Logger.log('❌ ERROR opening spreadsheet: ' + openError.toString());
      Logger.log('Error name: ' + openError.name);
      Logger.log('Error message: ' + openError.message);
      Logger.log('Error stack: ' + openError.stack);

      // Provide specific error messages based on the error type
      if (openError.message.includes('openById') || openError.message.includes('Unexpected error')) {
        return createResponse(false, 'Lỗi truy cập spreadsheet: Script chưa được cấp quyền truy cập Google Sheets. Vui lòng:\n1. Mở Apps Script editor\n2. Chạy function handleLogin_ một lần\n3. Cấp quyền truy cập khi được yêu cầu\n4. Deploy lại web app với "Execute as: Me"\n\nSpreadsheet ID: ' + USERS_SHEET_ID);
      } else if (openError.message.includes('not found') || openError.message.includes('does not exist')) {
        return createResponse(false, 'Lỗi: Không tìm thấy spreadsheet với ID: ' + USERS_SHEET_ID + '. Vui lòng kiểm tra lại spreadsheet ID.');
      } else if (openError.message.includes('permission') || openError.message.includes('access')) {
        return createResponse(false, 'Lỗi quyền truy cập: Script không có quyền truy cập spreadsheet. Vui lòng:\n1. Share spreadsheet với account đang chạy script\n2. Hoặc đặt spreadsheet thành "Anyone with link can view"\n\nSpreadsheet ID: ' + USERS_SHEET_ID);
      }

      return createResponse(false, 'Lỗi mở spreadsheet: ' + openError.message + '\nSpreadsheet ID: ' + USERS_SHEET_ID);
    }

    // Try to get the sheet
    const sheet = ss.getSheetByName(EMPLOYEES_SHEET_NAME);
    if (!sheet) {
      Logger.log('❌ ERROR: Sheet "' + EMPLOYEES_SHEET_NAME + '" not found');
      const availableSheets = ss.getSheets().map(s => s.getName()).join(', ');
      Logger.log('Available sheets: ' + availableSheets);
      return createResponse(false, 'Lỗi: Không tìm thấy sheet "' + EMPLOYEES_SHEET_NAME + '" trong spreadsheet. Các sheet có sẵn: ' + availableSheets);
    }

    Logger.log('✅ Successfully got sheet: ' + EMPLOYEES_SHEET_NAME);

    // Get data and search for user
    const data = sheet.getDataRange().getValues();
    Logger.log('Total rows in sheet: ' + data.length);

    for (let i = 1; i < data.length; i++) {
      if (data[i][4] == requestBody.email) {
        Logger.log('✅ User found at row ' + (i + 1));
        return createResponse(true, 'Thành công', { name: data[i][0], email: data[i][4], role: data[i][1] });
      }
    }

    Logger.log('❌ User not found with email: ' + requestBody.email);
    return createResponse(false, 'Tài khoản không tồn tại');
  } catch (error) {
    Logger.log('❌ UNEXPECTED ERROR in handleLogin_: ' + error.toString());
    Logger.log('Error stack: ' + error.stack);
    return createResponse(false, 'Lỗi không mong đợi: ' + error.message + '\n\nVui lòng kiểm tra Apps Script logs để biết chi tiết.');
  }
}

/**
 * Fetch all employees from "Nhân viên" sheet
 * Returns employee data with name, email, department (column C - Phòng ban), company, etc.
 */
function handleGetEmployees(requestBody) {
  try {
    Logger.log('=== handleGetEmployees called ===');

    const ss = safeOpenSpreadsheet(USERS_SHEET_ID, 'handleGetEmployees');
    const sheet = safeGetSheet(ss, EMPLOYEES_SHEET_NAME, 'handleGetEmployees');
    
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) {
      Logger.log('⚠️ No employee data found (only header row)');
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
    
    Logger.log('✅ Found ' + employees.length + ' active employees');
    return createResponse(true, 'Thành công', { employees: employees });
  } catch (error) {
    Logger.log('❌ ERROR in handleGetEmployees: ' + error.toString());
    Logger.log('❌ Error stack: ' + error.stack);
    return createResponse(false, 'Lỗi: ' + error.message);
  }
}

/**
 * Get company approvers from "Công ty" sheet
 * Returns the 3 approvers (Đại diện pháp luật, Kế toán trưởng, Thủ quỹ) for a given company
 * Can also be called with direct parameters: handleGetCompanyApprovers(companyName)
 */
function handleGetCompanyApprovers(requestBody, directCompanyName) {
  try {
    Logger.log('=== handleGetCompanyApprovers called ===');
    Logger.log('Request body type:', typeof requestBody);
    
    // Try to serialize requestBody safely
    try {
      Logger.log('Request body (JSON):', JSON.stringify(requestBody));
    } catch (e) {
      Logger.log('Request body (cannot stringify):', requestBody);
    }
    
    // Get company name from request
    // When called from doPost with URL-encoded form: e.parameter.companyName
    // When called from doGet: e.parameter.companyName
    // requestBody should be e.parameter object directly (but might not serialize well)
    let companyName = '';
    let companyKey = '';
    
    if (requestBody) {
      if (typeof requestBody === 'object') {
        // Google Apps Script e.parameter is a special object
        // Access properties directly - might not show up in Object.keys()
        companyName = requestBody.companyName || 
                     requestBody.company || 
                     (requestBody.hasOwnProperty ? (requestBody.hasOwnProperty('companyName') ? requestBody.companyName : '') : '') ||
                     '';
        companyKey = requestBody.companyKey || '';
        
        // Try accessing as dictionary-style
        if (!companyName) {
          try {
            companyName = requestBody['companyName'] || requestBody['company'] || '';
          } catch (e) {
            Logger.log('Error accessing companyName with bracket notation:', e);
          }
        }
        if (!companyKey) {
          try {
            companyKey = requestBody['companyKey'] || '';
          } catch (e) {}
        }
        
        Logger.log('Extracted companyName from object:', companyName || '(empty)');
        Logger.log('Extracted companyKey from object:', companyKey || '(empty)');
        
        // Log all keys for debugging (might not work for e.parameter)
        try {
          const keys = Object.keys(requestBody || {});
          Logger.log('Available keys in requestBody:', keys.length > 0 ? keys.join(', ') : 'none (might be e.parameter special object)');
        } catch (e) {
          Logger.log('Cannot get keys from requestBody:', e.toString());
        }
        
        // Try to access specific properties directly
        Logger.log('requestBody.companyName direct access:', requestBody.companyName || 'undefined');
        Logger.log('requestBody.company direct access:', requestBody.company || 'undefined');
        Logger.log('requestBody.action:', requestBody.action || 'undefined');
        
      } else if (typeof requestBody === 'string') {
        // If it's a string, try to parse it as JSON
        try {
          const parsed = JSON.parse(requestBody);
          companyName = parsed.companyName || parsed.company || '';
          companyKey = parsed.companyKey || '';
          Logger.log('Parsed companyName from JSON string:', companyName);
        } catch (e) {
          // Not JSON, treat as company name directly
          companyName = requestBody;
          Logger.log('Treated requestBody as company name directly:', companyName);
        }
      }
    } else {
      Logger.log('⚠️ requestBody is null/undefined/empty');
    }
    
    // Allow direct companyName parameter as fallback
    if ((!companyName || companyName.trim() === '') && directCompanyName) {
      companyName = directCompanyName;
      Logger.log('Using directCompanyName parameter:', companyName);
    }
    
    Logger.log('Final companyName value:', companyName || '(empty - will fail validation)');
    
    if (!companyName || companyName.trim() === '') {
      Logger.log('❌ Company name is missing');
      Logger.log('Debug info - requestBody:', requestBody);
      Logger.log('Debug info - directCompanyName:', directCompanyName);
      return createResponse(false, 'Tên công ty là bắt buộc. Received requestBody: ' + (requestBody ? 'exists' : 'null/undefined'));
    }
    
    Logger.log('Looking for company: ' + companyName);
    
    // Use safe helper functions for better error handling
    const ss = safeOpenSpreadsheet(TLCG_MASTER_DATA_SHEET_ID, 'handleGetCompanyApprovers');
    const sheet = safeGetSheet(ss, COMPANY_SHEET_NAME, 'handleGetCompanyApprovers');
    
    if (!sheet) {
      Logger.log('❌ Sheet "' + COMPANY_SHEET_NAME + '" not found');
      return createResponse(false, 'Sheet "' + COMPANY_SHEET_NAME + '" không tồn tại');
    }
    
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) {
      Logger.log('⚠️ No company data found (only header row)');
      return createResponse(false, 'Không tìm thấy dữ liệu công ty');
    }
    
    // Column mapping based on new "Master Company" sheet structure:
    // A: Company_Name - index 0 (MATCH HERE)
    // B: Company_Code - index 1
    // C: Company_Key_Or_Taxid - index 2 (ALSO MATCH HERE for uniqueness)
    // D: Legal_Representative_Name - index 3
    // E: Legal_Representative_Email - index 4
    // F: Legal_Representative_Signature - index 5
    // G: Email_Director - index 6
    // H: Chief_Accountant_Name - index 7
    // I: Chief_Accountant_Email - index 8
    // J: Chief_Accountant_Signature - index 9
    // K: Effective_Date - index 10
    // L: Treasurer_Name - index 11
    // M: Treasurer_Email - index 12
    // N: Treasurer_Signature - index 13
    // O: Company_Full_Name - index 14
    // P: Tax_ID - index 15
    // Q: Address - index 16
    
    Logger.log('Searching for company: "' + companyName + '" key: "' + companyKey + '" in column A (index 0) + C (index 2)');
    
    // Find the company row (skip header row at index 0)
    let companyRow = null;
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowName = (row[0] || '').toString().trim(); // Column A (index 0): Company_Name
      const rowKey  = (row[2] || '').toString().trim(); // Column C (index 2): Company_Key_Or_Taxid
      
      Logger.log('Row ' + (i + 1) + ' - Name: "' + rowName + '" Key: "' + rowKey + '"');
      
      const searchName = companyName.trim();
      const searchKey  = companyKey.trim();
      
      const isMatch = searchKey
        ? rowName === searchName && rowKey === searchKey
        : rowName === searchName;
      
      if (isMatch) {
        companyRow = row;
        Logger.log('✅ Found company match at row ' + (i + 1) + ': "' + rowName + '" / "' + rowKey + '"');
        break;
      }
    }
    
    if (!companyRow) {
      Logger.log('❌ Company not found: ' + companyName);
      return createResponse(false, 'Không tìm thấy công ty: ' + companyName);
    }
    
    // Extract approver data
    // New column structure: A=Company_Name(0), B=Company_Code(1), C=Company_Key(2),
    // D=LegalRep_Name(3), E=LegalRep_Email(4), F=LegalRep_Sig(5), G=Director_Email(6),
    // H=Accountant_Name(7), I=Accountant_Email(8), J=Accountant_Sig(9), K=Effective_Date(10),
    // L=Treasurer_Name(11), M=Treasurer_Email(12), N=Treasurer_Sig(13),
    // O=Company_Full_Name(14), P=Tax_ID(15), Q=Address(16)
    const approvers = {
      legalRep: {
        name: (companyRow[3] || '').toString().trim(),        // Column D: Legal_Representative_Name
        email: (companyRow[4] || '').toString().trim(),       // Column E: Legal_Representative_Email
        signature: (companyRow[5] || '').toString().trim(),   // Column F: Legal_Representative_Signature
        role: 'Đại diện pháp luật'
      },
      accountant: {
        name: (companyRow[7] || '').toString().trim(),        // Column H: Chief_Accountant_Name
        email: (companyRow[8] || '').toString().trim(),       // Column I: Chief_Accountant_Email
        signature: (companyRow[9] || '').toString().trim(),   // Column J: Chief_Accountant_Signature
        role: 'Kế toán trưởng'
      },
      treasurer: {
        name: (companyRow[11] || '').toString().trim(),       // Column L: Treasurer_Name
        email: (companyRow[12] || '').toString().trim(),      // Column M: Treasurer_Email
        signature: (companyRow[13] || '').toString().trim(),  // Column N: Treasurer_Signature
        role: 'Thủ quỹ'
      }
    };
    
    Logger.log('✅ Approvers found for company: ' + companyName);
    Logger.log('   - Legal Rep: ' + approvers.legalRep.name + ' (' + approvers.legalRep.email + ')');
    Logger.log('   - Accountant: ' + approvers.accountant.name + ' (' + approvers.accountant.email + ')');
    Logger.log('   - Treasurer: ' + approvers.treasurer.name + ' (' + approvers.treasurer.email + ')');
    
    return createResponse(true, 'Thành công', {
      companyName: companyName,
      approvers: approvers
    });
  } catch (error) {
    Logger.log('❌ ERROR in handleGetCompanyApprovers: ' + error.toString());
    Logger.log('❌ Error stack: ' + error.stack);
    return createResponse(false, 'Lỗi: ' + error.message);
  }
}

function handleGetVoucherSummary(requestBody) {
  try {
    Logger.log('=== GET VOUCHER SUMMARY ===');
    Logger.log('VOUCHER_HISTORY_SHEET_ID: ' + VOUCHER_HISTORY_SHEET_ID);
    Logger.log('VH_SHEET_NAME: ' + VH_SHEET_NAME);

    const ss = safeOpenSpreadsheet(VOUCHER_HISTORY_SHEET_ID, 'handleGetVoucherSummary');
    const sheet = safeGetSheet(ss, VH_SHEET_NAME, 'handleGetVoucherSummary');
    
    // Get data with error handling
    let data;
    try {
      const range = sheet.getDataRange();
      if (!range) {
        return createResponse(true, 'Thành công', {
          total: 0,
          pending: 0,
          approved: 0,
          rejected: 0,
          recent: []
        });
      }
      data = range.getValues();
    } catch (dataError) {
      Logger.log('Error getting data: ' + dataError.toString());
      return createResponse(false, 'Không thể đọc dữ liệu từ sheet: ' + dataError.message);
    }
    
    if (!data || data.length <= 1) {
      return createResponse(true, 'Thành công', {
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        recent: []
      });
    }
    
    // Column structure: A=voucher_number, B=voucher_type, C=company_name, D=company_key_or_taxid,
    //   E=employee_name, F=submited_email, G=submitted_by, H=submitted_at, I=amount, J=status,
    //   K=due_date, L=action, M=attachments, N=description, O=note, P=approver_email, Q=approved_at, R=MetaJSON
    const headers = data[0];
    const rows = data.slice(1);
    
    Logger.log('Total rows in sheet (excluding header): ' + rows.length);
    
    // Get latest entry for each voucher number
    const voucherMap = new Map();
    rows.forEach(row => {
      const voucherNumber = row[0]; // Column A
      if (!voucherNumber || voucherNumber.toString().trim() === '') return; // Skip empty voucher numbers
      
      const timestamp = row[7] || new Date(0); // H(7) = submitted_at
      // Convert timestamp to Date for comparison
      const timestampDate = timestamp instanceof Date ? timestamp : new Date(timestamp);
      
      if (!voucherMap.has(voucherNumber)) {
        // First occurrence of this voucher number
        voucherMap.set(voucherNumber, {
          voucherNumber: voucherNumber.toString().trim(),
          voucherType: row[1] || '',     // B
          company: row[2] || '',         // C
          companyKey: row[3] || '',      // D
          employee: row[4] || '',        // E
          requestorEmail: row[5] || '',  // F
          submittedBy: row[6] || '',     // G
          amount: row[8] || 0,           // I
          status: row[9] || '',          // J
          dueDate: row[10] || '',        // K
          action: row[11] || '',         // L
          attachments: row[12] || '',    // M
          description: row[13] || '',    // N
          note: row[14] || '',           // O
          approverEmail: row[15] || '',  // P
          approvedAt: row[16] || '',     // Q
          timestamp: timestampDate
        });
      } else {
        // Compare timestamps to keep the latest one
        const existingTimestamp = voucherMap.get(voucherNumber).timestamp;
        const existingTimestampDate = existingTimestamp instanceof Date ? existingTimestamp : new Date(existingTimestamp);
        
        if (timestampDate.getTime() > existingTimestampDate.getTime()) {
          // This row is newer, replace the existing entry
          voucherMap.set(voucherNumber, {
            voucherNumber: voucherNumber.toString().trim(),
            voucherType: row[1] || '',     // B
            company: row[2] || '',         // C
            companyKey: row[3] || '',      // D
            employee: row[4] || '',        // E
            requestorEmail: row[5] || '',  // F
            submittedBy: row[6] || '',     // G
            amount: row[8] || 0,           // I
            status: row[9] || '',          // J
            dueDate: row[10] || '',        // K
            action: row[11] || '',         // L
            attachments: row[12] || '',    // M
            description: row[13] || '',    // N
            note: row[14] || '',           // O
            approverEmail: row[15] || '',  // P
            approvedAt: row[16] || '',     // Q
            timestamp: timestampDate
          });
        }
      }
    });
    
    const vouchers = Array.from(voucherMap.values());
    
    Logger.log('Total unique vouchers found: ' + vouchers.length);
    Logger.log('Voucher numbers: ' + Array.from(voucherMap.keys()).join(', '));
    
    // Sort by timestamp descending (newest first)
    vouchers.sort((a, b) => {
      const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
      const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
      return timeB - timeA;
    });
    
    // Count by status
    const pending = vouchers.filter(v => v.status === 'Pending').length;
    const approved = vouchers.filter(v => v.status === 'Approved').length;
    const rejected = vouchers.filter(v => v.status === 'Rejected').length;
    
    Logger.log('Vouchers by status - Pending: ' + pending + ', Approved: ' + approved + ', Rejected: ' + rejected);
    
    // Get all vouchers (no limit)
    const recent = vouchers.map(v => ({
      voucherNumber: v.voucherNumber,
      voucherType: v.voucherType,
      company: v.company,
      employee: v.employee,
      amount: v.amount,
      status: v.status,
      action: v.action,
      by: v.by,
      timestamp: v.timestamp instanceof Date ? v.timestamp.toISOString() : v.timestamp,
      timestampFormatted: formatTimestamp(v.timestamp)
    }));
    
    return createResponse(true, 'Thành công', {
      total: vouchers.length,
      pending: pending,
      approved: approved,
      rejected: rejected,
      recent: recent
    });
  } catch (error) {
    return createResponse(false, 'Lỗi: ' + error.message);
  }
}

function handleGetVoucherHistory(requestBody) {
  try {
    const voucherNumber = (requestBody && requestBody.voucherNumber) || '';
    if (!voucherNumber) {
      return createResponse(false, 'Thiếu voucher number');
    }
    
    const sheet = SpreadsheetApp.openById(VOUCHER_HISTORY_SHEET_ID).getSheetByName(VH_SHEET_NAME);
    if (!sheet) {
      return createResponse(false, 'Sheet không tồn tại');
    }
    
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      return createResponse(true, 'Thành công', []);
    }
    
    const rows = data.slice(1);
    const history = [];
    
    rows.forEach(row => {
      if (row[0] === voucherNumber) {
        const noteField = (row[14] || '').toString(); // O(14) = note
        const metaJsonStr = (row[17] || '').toString(); // R(17) = MetaJSON
        let meta = {};

        if (metaJsonStr) {
          try {
            meta = JSON.parse(metaJsonStr);
          } catch (parseError) {
            Logger.log('Warning: Failed to parse MetaJSON: ' + parseError.toString());
          }
        }
        
        history.push({
          voucherNumber: row[0] || '',
          voucherType: row[1] || '',
          company: row[2] || '',
          companyKey: row[3] || '',
          employee: row[4] || '',
          requestorEmail: row[5] || '',
          submittedBy: row[6] || '',
          timestamp: row[7] || new Date(),
          amount: row[8] || 0,
          status: row[9] || '',
          dueDate: row[10] || '',
          action: row[11] || '',
          attachments: row[12] || '',
          description: row[13] || '',
          note: noteField,
          meta: meta,
          approverEmail: row[15] || '',
          approvedAt: row[16] || '',
        });
      }
    });
    
    // Sort by timestamp descending (newest first)
    history.sort((a, b) => {
      const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp).getTime();
      const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp).getTime();
      return timeB - timeA;
    });
    
    return createResponse(true, 'Thành công', history);
  } catch (error) {
    return createResponse(false, 'Lỗi: ' + error.message);
  }
}

/** HÀM PHỤ TRỢ */
function uploadFilesToDrive_(files, folderName) {
  const DRIVE_FOLDER_ID = '1RBBUUAQIrYTWeBONIgkMtELL0hxZhtqG';
  const parent = DriveApp.getFolderById(DRIVE_FOLDER_ID);
  let folder = parent.getFoldersByName(folderName).hasNext() ? parent.getFoldersByName(folderName).next() : parent.createFolder(folderName);
  return files.map(file => {
    try {
      let data = file.fileData.includes(',') ? file.fileData.split(',')[1] : file.fileData;
      const blob = Utilities.newBlob(Utilities.base64Decode(data), file.mimeType, file.fileName);
      const f = folder.createFile(blob);
      f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      // Return file info including size if available
      return { 
        fileName: file.fileName, 
        fileUrl: f.getUrl(),
        fileSize: file.fileSize || blob.getBytes().length // Use provided size or calculate from blob
      };
    } catch (e) { 
      return { 
        fileName: file.fileName, 
        error: true,
        fileSize: file.fileSize || 0
      }; 
    }
  });
}

function appendHistory_(entry) {
  // #region agent log
  try {
    UrlFetchApp.fetch('http://127.0.0.1:7242/ingest/cd238998-d527-4813-9e30-22fe3efc32e0', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({location: 'VOUCHER_WORKFLOW_BACKEND.gs:1925', message: 'appendHistory_ entry', data: {voucherNumber: entry.voucherNumber, action: entry.action}, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'E'})}).catch(() => {});
  } catch (e) {}
  // #endregion
  try {
    Logger.log('📝 Attempting to append history for voucher: ' + entry.voucherNumber);
    
    // #region agent log
    try {
      UrlFetchApp.fetch('http://127.0.0.1:7242/ingest/cd238998-d527-4813-9e30-22fe3efc32e0', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({location: 'VOUCHER_WORKFLOW_BACKEND.gs:1929', message: 'Before sheet access in appendHistory_', data: {sheetId: VOUCHER_HISTORY_SHEET_ID, sheetName: VH_SHEET_NAME}, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'E'})}).catch(() => {});
    } catch (e) {}
    // #endregion
    
    const sheet = SpreadsheetApp.openById(VOUCHER_HISTORY_SHEET_ID).getSheetByName(VH_SHEET_NAME);
    
    if (!sheet) {
      const errorMsg = 'Sheet "' + VH_SHEET_NAME + '" not found in spreadsheet ID: ' + VOUCHER_HISTORY_SHEET_ID;
      Logger.log('❌ ERROR: ' + errorMsg);
      throw new Error(errorMsg);
    }
    
    // Validate entry data
    if (!entry.voucherNumber) {
      Logger.log('⚠️ WARNING: Voucher number is missing in entry');
    }
    
    // #region agent log
    try {
      UrlFetchApp.fetch('http://127.0.0.1:7242/ingest/cd238998-d527-4813-9e30-22fe3efc32e0', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({location: 'VOUCHER_WORKFLOW_BACKEND.gs:1942', message: 'Before appendRow', data: {voucherNumber: entry.voucherNumber}, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'E'})}).catch(() => {});
    } catch (e) {}
    // #endregion
    
    sheet.appendRow([
      entry.voucherNumber || '',                       // A (0):  voucher_number
      entry.voucherType || '',                         // B (1):  voucher_type
      entry.company || '',                             // C (2):  company_name
      entry.companyKey || '',                          // D (3):  company_key_or_taxid
      entry.employee || '',                            // E (4):  employee_name
      entry.requestorEmail || '',                      // F (5):  submited_email
      entry.submittedBy || entry.employee || '',       // G (6):  submitted_by
      new Date(),                                      // H (7):  submitted_at
      parseFloat((entry.amount || '0').toString().replace(/[^0-9.]/g, '')) || 0,  // I (8):  amount
      entry.status || '',                              // J (9):  status
      entry.dueDate || '',                             // K (10): due_date
      entry.action || '',                              // L (11): action
      entry.attachments || '',                         // M (12): attachments
      entry.description || '',                         // N (13): description
      entry.note || '',                                // O (14): note
      entry.approverEmail || '',                       // P (15): approver_email
      entry.approvedAt || '',                          // Q (16): approved_at
      entry.metaJson || ''                             // R (17): MetaJSON
    ]);
    
    // #region agent log
    try {
      UrlFetchApp.fetch('http://127.0.0.1:7242/ingest/cd238998-d527-4813-9e30-22fe3efc32e0', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({location: 'VOUCHER_WORKFLOW_BACKEND.gs:1957', message: 'After appendRow', data: {voucherNumber: entry.voucherNumber, success: true}, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'E'})}).catch(() => {});
    } catch (e) {}
    // #endregion
    
    Logger.log('✅ History appended successfully for voucher: ' + entry.voucherNumber);
    Logger.log('   - Action: ' + entry.action);
    Logger.log('   - Status: ' + entry.status);
    Logger.log('   - By: ' + entry.by);
    
    return true;
  } catch (error) {
    // #region agent log
    try {
      UrlFetchApp.fetch('http://127.0.0.1:7242/ingest/cd238998-d527-4813-9e30-22fe3efc32e0', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({location: 'VOUCHER_WORKFLOW_BACKEND.gs:1964', message: 'Error in appendHistory_', data: {error: error.toString(), message: error.message, voucherNumber: entry.voucherNumber}, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId: 'E'})}).catch(() => {});
    } catch (e) {}
    // #endregion
    Logger.log('❌ CRITICAL ERROR in appendHistory_: ' + error.toString());
    Logger.log('❌ Error stack: ' + error.stack);
    Logger.log('❌ Entry data: ' + JSON.stringify({
      voucherNumber: entry.voucherNumber,
      action: entry.action,
      status: entry.status
    }));
    
    // Re-throw error so parent function can handle it
    throw new Error('Failed to append history: ' + error.message);
  }
}

function formatTimestamp(timestamp) {
  if (!timestamp) return '';
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

function createResponse(success, message, data) {
  return ContentService.createTextOutput(JSON.stringify({ success, message, data })).setMimeType(ContentService.MimeType.JSON);
}

function grantPermissionFinal() {
  GmailApp.sendEmail(Session.getActiveUser().getEmail(), "Xác nhận quyền", "Backend đã sẵn sàng!");
}

// Test function - can be run directly from editor
function testGetVoucherSummary() {
  try {
    Logger.log('=== TESTING handleGetVoucherSummary ===');
    const result = handleGetVoucherSummary({});
    Logger.log('Result: ' + JSON.stringify(result));
    return result;
  } catch (error) {
    Logger.log('❌ Test failed: ' + error.toString());
    Logger.log('❌ Error stack: ' + error.stack);
    return null;
  }
}

// Diagnostic function to test spreadsheet access
function testSpreadsheetAccess() {
  try {
    Logger.log('=== TESTING SPREADSHEET ACCESS ===');
    Logger.log('TLCG_MASTER_DATA_SHEET_ID: ' + TLCG_MASTER_DATA_SHEET_ID);
    Logger.log('VOUCHER_HISTORY_SHEET_ID: ' + VOUCHER_HISTORY_SHEET_ID);
    Logger.log('USERS_SHEET_ID: ' + USERS_SHEET_ID);
    Logger.log('VH_SHEET_NAME: ' + VH_SHEET_NAME);
    Logger.log('EMPLOYEES_SHEET_NAME: ' + EMPLOYEES_SHEET_NAME);
    
    // Test 1: Check if SpreadsheetApp is available
    Logger.log('Test 1: Checking SpreadsheetApp...');
    if (typeof SpreadsheetApp === 'undefined') {
      Logger.log('❌ SpreadsheetApp is undefined!');
      return;
    }
    Logger.log('✅ SpreadsheetApp is available');
    
    // Test 2: Check if openById method exists
    Logger.log('Test 2: Checking openById method...');
    if (typeof SpreadsheetApp.openById !== 'function') {
      Logger.log('❌ SpreadsheetApp.openById is not a function!');
      Logger.log('Available methods: ' + Object.keys(SpreadsheetApp).join(', '));
      return;
    }
    Logger.log('✅ SpreadsheetApp.openById is available');
    
    // Test 3: Try to open the spreadsheet using direct ID string
    Logger.log('Test 3: Opening spreadsheet with direct ID string...');
    const spreadsheetId = '1ujmPbtEdkGLgEshfhV8gRB6R0GLI31jsZM5rDOJS0g';
    Logger.log('Using ID: ' + spreadsheetId);
    let ss;
    try {
      ss = SpreadsheetApp.openById(spreadsheetId);
      Logger.log('✅ Spreadsheet opened successfully');
      Logger.log('Spreadsheet name: ' + ss.getName());
    } catch (error) {
      Logger.log('❌ Failed to open spreadsheet: ' + error.toString());
      Logger.log('Error message: ' + error.message);
      Logger.log('Error name: ' + error.name);
      Logger.log('Trying alternative: Testing if handleGetEmployees works...');
      // Try to test if handleGetEmployees works (which uses same pattern)
      try {
        const empResult = handleGetEmployees({});
        Logger.log('handleGetEmployees result: ' + (empResult ? 'success' : 'failed'));
      } catch (empError) {
        Logger.log('handleGetEmployees also failed: ' + empError.toString());
      }
      return;
    }
    
    // Test 4: Try to get Voucher_History sheet
    Logger.log('Test 4: Getting Voucher_History sheet...');
    try {
      const voucherSheet = ss.getSheetByName(VH_SHEET_NAME);
      if (voucherSheet) {
        Logger.log('✅ Voucher_History sheet found');
        Logger.log('Sheet name: ' + voucherSheet.getName());
        const rowCount = voucherSheet.getLastRow();
        Logger.log('Rows in sheet: ' + rowCount);
      } else {
        Logger.log('❌ Voucher_History sheet not found');
        Logger.log('Available sheets: ' + ss.getSheets().map(s => s.getName()).join(', '));
      }
    } catch (error) {
      Logger.log('❌ Failed to get Voucher_History sheet: ' + error.toString());
    }
    
    // Test 5: Try to get Nhân viên sheet
    Logger.log('Test 5: Getting Nhân viên sheet...');
    try {
      const employeeSheet = ss.getSheetByName(EMPLOYEES_SHEET_NAME);
      if (employeeSheet) {
        Logger.log('✅ Nhân viên sheet found');
        Logger.log('Sheet name: ' + employeeSheet.getName());
      } else {
        Logger.log('❌ Nhân viên sheet not found');
      }
    } catch (error) {
      Logger.log('❌ Failed to get Nhân viên sheet: ' + error.toString());
    }
    
    Logger.log('=== DIAGNOSTIC TEST COMPLETE ===');
  } catch (error) {
    Logger.log('❌ Diagnostic test failed: ' + error.toString());
    Logger.log('❌ Error stack: ' + error.stack);
  }
}

/**
 * Refresh approver emails for all pending vouchers
 * This function updates the Meta JSON in Voucher_History with current approver emails from Công ty sheet
 * Call this after updating approver emails in the Công ty master data
 */
function handleRefreshApproverEmails(requestBody) {
  try {
    Logger.log('=== REFRESH APPROVER EMAILS ===');

    const ss = SpreadsheetApp.openById(VOUCHER_HISTORY_SHEET_ID);
    const voucherSheet = ss.getSheetByName(VH_SHEET_NAME);
    const companySheet = ss.getSheetByName(COMPANY_SHEET_NAME);

    if (!voucherSheet || !companySheet) {
      return createResponse(false, 'Không tìm thấy sheet cần thiết');
    }

    const voucherData = voucherSheet.getDataRange().getValues();
    const companyData = companySheet.getDataRange().getValues();

    // Build company approvers lookup (Master Company sheet structure)
    const companyApproversMap = {};
    for (let i = 1; i < companyData.length; i++) {
      const row = companyData[i];
      const companyName = (row[0] || '').toString().trim(); // A(0): Company_Name
      if (companyName) {
        companyApproversMap[companyName.toLowerCase()] = {
          legalRep: {
            name: (row[3] || '').toString().trim(),
            email: (row[4] || '').toString().trim(),
            signature: (row[5] || '').toString().trim(),
            role: 'Đại diện pháp luật'
          },
          accountant: {
            name: (row[7] || '').toString().trim(),
            email: (row[8] || '').toString().trim(),
            signature: (row[9] || '').toString().trim(),
            role: 'Kế toán trưởng'
          },
          treasurer: {
            name: (row[11] || '').toString().trim(),
            email: (row[12] || '').toString().trim(),
            signature: (row[13] || '').toString().trim(),
            role: 'Thủ quỹ'
          }
        };
      }
    }

    let updatedCount = 0;
    const updatedVouchers = [];

    // Process each voucher row (skip header)
    // Column structure: A=VoucherNumber(0), B=VoucherType(1), C=Company(2), D=Employee(3),
    //                   E=Amount(4), F=Status(5), G=Action(6), H=By(7), I=Note(8)
    for (let i = 1; i < voucherData.length; i++) {
      const row = voucherData[i];
      const voucherNo = (row[0] || '').toString().trim(); // A(0): voucher_number
      const companyName = (row[2] || '').toString().trim(); // C(2): company_name
      const status = (row[9] || '').toString().trim(); // J(9): status
      const action = (row[11] || '').toString().trim(); // L(11): action
      const metaJson = (row[17] || '').toString().trim(); // R(17): MetaJSON

      // Only process pending/partially approved vouchers (not fully approved or rejected)
      const isPending = status === 'Pending' ||
                       status === 'Chờ Duyệt' ||
                       status.includes('Đang duyệt') ||
                       status.includes('Partially');
      const isRejectedOrApproved = status === 'Approved' || status === 'Rejected' ||
                                   action === 'Fully Approved' || action === 'Rejected';

      if (!isPending || isRejectedOrApproved) {
        continue;
      }

      Logger.log('Processing voucher ' + voucherNo + ' (company: ' + companyName + ', status: ' + status + ')');

      // Find company approvers
      const approvers = companyApproversMap[companyName.toLowerCase()];
      if (!approvers) {
        Logger.log('⚠️ Company not found: ' + companyName + ' for voucher ' + voucherNo);
        continue;
      }

      // Parse existing MetaJSON from column R
      let meta = {};
      try {
        if (metaJson) {
          meta = JSON.parse(metaJson);
        }
      } catch (e) {
        Logger.log('⚠️ Cannot parse MetaJSON for voucher ' + voucherNo + ': ' + e.message);
        continue;
      }

      // Update approver emails in meta
      if (meta.companyApprovers && meta.companyApprovers.approvers) {
        const metaApprovers = meta.companyApprovers.approvers;
        let changed = false;

        // Update accountant
        if (metaApprovers.accountant && approvers.accountant.email) {
          if (metaApprovers.accountant.email !== approvers.accountant.email) {
            Logger.log('Updating accountant email for ' + voucherNo + ': ' + metaApprovers.accountant.email + ' → ' + approvers.accountant.email);
            metaApprovers.accountant.email = approvers.accountant.email;
            metaApprovers.accountant.name = approvers.accountant.name;
            changed = true;
          }
        }

        // Update legalRep
        if (metaApprovers.legalRep && approvers.legalRep.email) {
          if (metaApprovers.legalRep.email !== approvers.legalRep.email) {
            Logger.log('Updating legalRep email for ' + voucherNo + ': ' + metaApprovers.legalRep.email + ' → ' + approvers.legalRep.email);
            metaApprovers.legalRep.email = approvers.legalRep.email;
            metaApprovers.legalRep.name = approvers.legalRep.name;
            changed = true;
          }
        }

        // Update treasurer
        if (metaApprovers.treasurer && approvers.treasurer.email) {
          if (metaApprovers.treasurer.email !== approvers.treasurer.email) {
            Logger.log('Updating treasurer email for ' + voucherNo + ': ' + metaApprovers.treasurer.email + ' → ' + approvers.treasurer.email);
            metaApprovers.treasurer.email = approvers.treasurer.email;
            metaApprovers.treasurer.name = approvers.treasurer.name;
            changed = true;
          }
        }

        if (changed) {
          // Save updated meta back to MetaJSON column (R = column 18, 1-based)
          voucherSheet.getRange(i + 1, 18).setValue(JSON.stringify(meta)); // R(18): MetaJSON
          updatedCount++;
          updatedVouchers.push({
            voucherNo: voucherNo,
            company: companyName,
            newApprovers: {
              accountant: approvers.accountant.email,
              legalRep: approvers.legalRep.email,
              treasurer: approvers.treasurer.email
            }
          });
          Logger.log('✅ Updated voucher: ' + voucherNo);
        }
      }
    }

    Logger.log('=== REFRESH COMPLETE: Updated ' + updatedCount + ' vouchers ===');

    return createResponse(true, 'Đã cập nhật ' + updatedCount + ' phiếu với email người duyệt mới', {
      updatedCount: updatedCount,
      updatedVouchers: updatedVouchers
    });

  } catch (error) {
    Logger.log('❌ ERROR in handleRefreshApproverEmails: ' + error.toString());
    return createResponse(false, 'Lỗi: ' + error.message);
  }
}

/**
 * Manual function to refresh approver emails - run from Apps Script editor
 */
function refreshApproverEmails() {
  const result = handleRefreshApproverEmails({});
  Logger.log('Result: ' + JSON.stringify(result));
  return result;
}

/**
 * Fetch signature image from URL (handles Google Drive) and return as base64
 * Used as backend proxy to avoid CORS issues when frontend needs to compare signatures
 */
function handleFetchSignatureImage(requestBody) {
  try {
    const imageUrl = requestBody.imageUrl || '';
    if (!imageUrl) {
      Logger.log('❌ fetchSignatureImage: Missing image URL');
      return createResponse(false, 'Missing image URL');
    }

    Logger.log('🖼️ Fetching signature image: ' + imageUrl);

    // Handle Google Drive URLs - convert sharing URL to direct download URL
    let fetchUrl = imageUrl;
    if (imageUrl.includes('drive.google.com')) {
      // Extract file ID from various Google Drive URL formats
      // Format 1: https://drive.google.com/file/d/FILE_ID/view
      // Format 2: https://drive.google.com/open?id=FILE_ID
      // Format 3: https://drive.google.com/uc?id=FILE_ID
      let fileId = null;

      const fileIdMatch = imageUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (fileIdMatch) {
        fileId = fileIdMatch[1];
      } else {
        const idMatch = imageUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if (idMatch) {
          fileId = idMatch[1];
        }
      }

      if (fileId) {
        fetchUrl = 'https://drive.google.com/uc?export=download&id=' + fileId;
        Logger.log('🔗 Converted to direct download URL: ' + fetchUrl);
      }
    }

    // Fetch the image
    const response = UrlFetchApp.fetch(fetchUrl, {
      muteHttpExceptions: true,
      followRedirects: true
    });

    const responseCode = response.getResponseCode();
    if (responseCode !== 200) {
      Logger.log('❌ Failed to fetch image: HTTP ' + responseCode);
      return createResponse(false, 'Failed to fetch image: HTTP ' + responseCode);
    }

    // Convert to base64
    const blob = response.getBlob();
    const base64 = Utilities.base64Encode(blob.getBytes());
    const mimeType = blob.getContentType() || 'image/png';
    const dataUrl = 'data:' + mimeType + ';base64,' + base64;

    Logger.log('✅ Signature image fetched successfully, size: ' + Math.round(base64.length / 1024) + 'KB');

    return createResponse(true, 'Success', { imageBase64: dataUrl });
  } catch (error) {
    Logger.log('❌ Error fetching signature image: ' + error.toString());
    Logger.log('❌ Error stack: ' + error.stack);
    return createResponse(false, 'Error: ' + error.message);
  }
}
