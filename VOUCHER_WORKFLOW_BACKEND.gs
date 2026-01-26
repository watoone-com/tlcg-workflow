/**
 * GOOGLE APPS SCRIPT - PHIẾU THU CHI
 */

// TLCG Master Data spreadsheet - contains both "Nhân viên" and "Voucher_History" sheets
const TLCG_MASTER_DATA_SHEET_ID = '1ujmPbtEdkGLgEshfhV8gRB6R0GLI31jsZM5rDOJS0g';
const USERS_SHEET_ID = TLCG_MASTER_DATA_SHEET_ID; // Same spreadsheet
const VOUCHER_HISTORY_SHEET_ID = TLCG_MASTER_DATA_SHEET_ID; // Same spreadsheet
const VH_SHEET_NAME = 'Voucher_History';
const EMPLOYEES_SHEET_NAME = 'Nhân viên';
const COMPANY_SHEET_NAME = 'Công ty';

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
          approverSignature: e.parameter.approverSignature || '' // May be empty for GET (too large)
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
  try {
    Logger.log('=== doPost called ===');
    Logger.log('e.parameter keys: ' + (e.parameter ? Object.keys(e.parameter).join(', ') : 'none'));
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
        Logger.log('Parsed action from data field: ' + action);
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
      Logger.log('e.parameter.companyName: ' + (e.parameter.companyName || 'not found'));
      Logger.log('e.parameter.companyName type: ' + (typeof e.parameter.companyName));
    } else if (e.postData && e.postData.contents) {
      try {
        requestBody = JSON.parse(e.postData.contents);
        action = requestBody.action;
        Logger.log('Parsed from e.postData.contents, action: ' + action);
      } catch (parseError) {
        Logger.log('❌ Error parsing e.postData.contents: ' + parseError.toString());
        return createResponse(false, 'Lỗi parse dữ liệu từ postData: ' + parseError.message);
      }
    } else {
      Logger.log('⚠️ WARNING: No data found in e.parameter or e.postData');
      Logger.log('e.parameter: ' + JSON.stringify(e.parameter));
      Logger.log('e.postData: ' + JSON.stringify(e.postData));
      return createResponse(false, 'Không tìm thấy dữ liệu trong request');
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
      case 'sendApprovalEmail': return handleSendEmail(requestBody);
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
        
        Logger.log('⚠️ Available actions: login, sendApprovalEmail, approveVoucher, rejectVoucher, getVoucherSummary, getVoucherHistory, getEmployees, getCompanyApprovers, getApprovalStatus');
        return createResponse(false, 'Action không hợp lệ: ' + normalizedAction + ' (length: ' + normalizedAction.length + ', expected: ' + 'getCompanyApprovers'.length + ')');
    }
  } catch (error) {
    Logger.log('❌ CRITICAL ERROR in doPost: ' + error.toString());
    Logger.log('❌ Error stack: ' + error.stack);
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
    
    // Find latest entry for this voucher (search from bottom up)
    for (let i = data.length - 1; i >= 1; i--) {
      if (data[i][0] === voucherNumber) {
        const note = data[i][7] || ''; // Column H = Note
        const metaMatch = note.match(/Meta: (.+)/);
        
        return {
          row: i + 1,
          voucherNumber: data[i][0],
          voucherType: data[i][1],
          company: data[i][2],
          employee: data[i][3],
          amount: data[i][4],
          status: data[i][5],
          action: data[i][6],
          note: note,
          timestamp: data[i][8],
          requestorEmail: data[i][9],
          approverEmail: data[i][10],
          meta: metaMatch ? metaMatch[1] : null
        };
      }
    }
    return null;
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
  try {
    const emailData = requestBody.email;
    const requesterEmailData = requestBody.requesterEmail || null;
    const voucher = requestBody.voucher || {};
    if (!emailData || !emailData.to) return createResponse(false, 'Thiếu người nhận');

    const voucherNo = voucher.voucherNumber || 'AUTO-' + new Date().getTime();
    
    // ✅ CRITICAL FIX: Check for duplicate submission BEFORE processing
    Logger.log('🔍 Checking for duplicate submission: ' + voucherNo);
    const sheet = SpreadsheetApp.openById(VOUCHER_HISTORY_SHEET_ID).getSheetByName(VH_SHEET_NAME);
    
    if (!sheet) {
      Logger.log('❌ ERROR: Sheet "' + VH_SHEET_NAME + '" not found');
      return createResponse(false, 'Lỗi: Không tìm thấy sheet lịch sử. Vui lòng kiểm tra cấu hình.');
    }
    
    const data = sheet.getDataRange().getValues();
    const rows = data.slice(1); // Skip header
    
    // Check if this voucher was already submitted (action = 'Submit')
    for (let i = 0; i < rows.length; i++) {
      const rowVoucherNo = rows[i][0]; // Column A = Voucher Number
      const rowAction = rows[i][6];    // Column G = Action
      
      if (rowVoucherNo === voucherNo && rowAction === 'Submit') {
        Logger.log('⚠️ DUPLICATE SUBMISSION DETECTED: ' + voucherNo);
        Logger.log('⚠️ Found existing submission at row: ' + (i + 2)); // +2 for header and 0-index
        return createResponse(false, 'Phiếu này đã được gửi trước đó (số phiếu: ' + voucherNo + '). Vui lòng kiểm tra lại lịch sử phiếu.');
      }
    }
    
    Logger.log('✅ No duplicate found, proceeding with submission: ' + voucherNo);
    
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
      
      let options = { htmlBody: emailData.body };
      if (emailData.cc && emailData.cc.trim() !== "") options.cc = emailData.cc.trim();
      // Use logged-in user's email as reply-to (instead of script owner's email)
      if (emailData.replyTo && emailData.replyTo.trim() !== "") {
        options.replyTo = emailData.replyTo.trim();
        Logger.log('Setting reply-to to logged-in user email: ' + options.replyTo);
      }
      
      GmailApp.sendEmail(emailData.to, emailData.subject, '', options);
      Logger.log('✅ Email sent successfully to: ' + emailData.to);
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
      } catch (requesterEmailError) {
        // Log but don't fail - requester email is secondary
        Logger.log('Warning: Failed to send requester email: ' + requesterEmailError.toString());
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
    
    appendHistory_({
      voucherNumber: voucherNo,
      voucherType: voucher.voucherType || '',
      company: voucher.company || '',
      employee: voucher.employee || '',
      amount: voucher.amount || 0,
      status: 'Pending',
      action: 'Submit',
      by: voucher.employee || 'User',
      note: 'Gửi phê duyệt\nMeta: ' + JSON.stringify(submitMetaData), // Store all metadata including signature and approvers meta
      requestorEmail: voucher.requestorEmail || '',
      approverEmail: emailData.to,
      attachments: fileLinks
    });

    return createResponse(true, 'Đã gửi yêu cầu phê duyệt thành công');
  } catch (error) {
    return createResponse(false, 'Lỗi gửi mail: ' + error.message);
  }
}

/** 2. PHÊ DUYỆT / TỪ CHỐI - SEQUENTIAL APPROVAL */

/**
 * Handle voucher approval with sequential workflow
 * Order: accountant → legalRep → treasurer
 */
function handleApproveVoucher(requestBody) {
  try {
    const v = requestBody.voucher || {};
    const voucherNumber = v.voucherNumber || '';
    const approverEmail = v.approverEmail || '';
    
    if (!voucherNumber) {
      return createResponse(false, 'Thiếu số phiếu');
    }
    
    // Get existing voucher data from history
    const existingVoucher = getVoucherFromHistory(voucherNumber);
    if (!existingVoucher) {
      return createResponse(false, 'Không tìm thấy phiếu: ' + voucherNumber);
    }
    
    // Parse meta from note field
    let meta = {};
    if (existingVoucher.meta) {
      try {
        meta = JSON.parse(existingVoucher.meta);
      } catch (e) {
        Logger.log('Error parsing meta: ' + e.toString());
        // Fallback: try to parse from full note
        const metaMatch = existingVoucher.note.match(/Meta: (.+)/);
        if (metaMatch) {
          try {
            meta = JSON.parse(metaMatch[1]);
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
      
      // Append final approval entry
      appendHistory_({
        voucherNumber: voucherNumber,
        voucherType: v.voucherType || existingVoucher.voucherType || '',
        company: v.company || existingVoucher.company || '',
        employee: v.employee || existingVoucher.employee || '',
        amount: v.amount || existingVoucher.amount || 0,
        status: 'Approved',
        action: 'Fully Approved',
        by: companyApprovers.approvers[approverRole].name,
        note: 'Tất cả 3 người phê duyệt đã duyệt\nMeta: ' + JSON.stringify(meta),
        requestorEmail: v.requestorEmail || existingVoucher.requestorEmail || '',
        approverEmail: approverEmail,
        attachments: ""
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
      
      // Append partial approval entry
      appendHistory_({
        voucherNumber: voucherNumber,
        voucherType: v.voucherType || existingVoucher.voucherType || '',
        company: v.company || existingVoucher.company || '',
        employee: v.employee || existingVoucher.employee || '',
        amount: v.amount || existingVoucher.amount || 0,
        status: companyApprovers.displayStatus,
        action: 'Approved by ' + companyApprovers.approvers[approverRole].name,
        by: companyApprovers.approvers[approverRole].name,
        note: `Đã duyệt bởi ${getApproverRoleName(approverRole)} (${approvalCount}/3)\nMeta: ` + JSON.stringify(meta),
        requestorEmail: v.requestorEmail || existingVoucher.requestorEmail || '',
        approverEmail: approverEmail,
        attachments: ""
      });
      
      // Send email to next approver in sequence
      const nextApprover = companyApprovers.approvers[nextApproverRole];
      sendApprovalEmailToNextApprover(v, nextApprover, nextApproverRole, companyApprovers, voucherNumber, existingVoucher);
      
      // Send progress email to requester
      sendProgressEmail(v, approvalCount, companyApprovers, voucherNumber, existingVoucher);
      
      Logger.log('✅ Partial approval: ' + voucherNumber + ' - ' + approvalCount + '/3');
      return createResponse(true, 
        `Đã phê duyệt thành công. Đã gửi email đến ${nextApprover.name} để tiếp tục phê duyệt.`
      );
    }
    
  } catch (error) {
    Logger.log('❌ Error approving voucher: ' + error.toString());
    Logger.log('❌ Error stack: ' + error.stack);
    return createResponse(false, 'Lỗi: ' + error.message);
  }
}

/**
 * Legacy single-approval workflow (backward compatibility)
 */
function handleApproveVoucherLegacy(requestBody, existingVoucher) {
  const v = requestBody.voucher || {};
  const voucherNumber = v.voucherNumber || '';
  
  // Check if already approved or rejected
  const sheet = SpreadsheetApp.openById(VOUCHER_HISTORY_SHEET_ID).getSheetByName(VH_SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const rows = data.slice(1);
  
  let latestStatus = null;
  let latestAction = null;
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i][0] === voucherNumber) {
      latestStatus = rows[i][5] || '';
      latestAction = rows[i][6] || '';
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
    employee: v.employee || existingVoucher.employee || '',
    amount: v.amount || existingVoucher.amount || 0,
    status: 'Approved', 
    action: 'Approved', 
    by: v.approvedBy || v.approverEmail || '', 
    note: 'Duyệt qua Email\nMeta: ' + JSON.stringify(metaData),
    requestorEmail: v.requestorEmail || existingVoucher.requestorEmail || '',
    approverEmail: v.approverEmail || '',
    attachments: "" 
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
    const baseUrl = 'https://workflow.egg-ventures.com';
    const approveUrl = `${baseUrl}/approve_voucher.html?` +
      `voucherNumber=${voucherNumber}&` +
      `approverEmail=${encodeURIComponent(nextApprover.email)}&` +
      `approverRole=${approverRole}`;
    
    const rejectUrl = `${baseUrl}/reject_voucher.html?` +
      `voucherNumber=${voucherNumber}&` +
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
    
    const emailSubject = `[PHÊ DUYỆT] Phiếu ${voucherNumber} - ${roleName}`;
    const emailBody = `
      <p>Kính gửi ${nextApprover.name},</p>
      <p>Phiếu <strong>${voucherNumber}</strong> đã được phê duyệt bởi ${previousRoleName} ${previousApprover.name}.</p>
      <p>Vui lòng xem xét và phê duyệt phiếu này.</p>
      
      <h3>Thông tin phiếu:</h3>
      <ul>
        <li><strong>Số phiếu:</strong> ${voucherNumber}</li>
        <li><strong>Loại phiếu:</strong> ${voucher.voucherType || existingVoucher.voucherType || 'N/A'}</li>
        <li><strong>Công ty:</strong> ${voucher.company || existingVoucher.company || 'N/A'}</li>
        <li><strong>Người đề nghị:</strong> ${voucher.employee || existingVoucher.employee || 'N/A'}</li>
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
    
    const emailSubject = `[TIẾN ĐỘ PHÊ DUYỆT] Phiếu ${voucherNumber} - Đã có ${approvalCount}/3 người duyệt`;
    
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
    
    const emailBody = `
      <p>Kính gửi Anh/Chị,</p>
      <p>Phiếu <strong>${voucherNumber}</strong> của Anh/Chị đang được xử lý:</p>
      
      <h3>📊 Tiến độ phê duyệt: ${approvalCount}/3 người đã duyệt</h3>
      
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
    
    // Parse meta
    let meta = {};
    if (existingVoucher.meta) {
      try {
        meta = JSON.parse(existingVoucher.meta);
      } catch (e) {
        const metaMatch = existingVoucher.note.match(/Meta: (.+)/);
        if (metaMatch) {
          try {
            meta = JSON.parse(metaMatch[1]);
          } catch (e2) {
            Logger.log('Error parsing meta: ' + e2.toString());
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
        employee: v.employee || existingVoucher.employee || '',
        amount: v.amount || existingVoucher.amount || 0,
        status: 'Rejected',
        action: 'Rejected by ' + companyApprovers.approvers[approverRole].name,
        by: companyApprovers.approvers[approverRole].name,
        note: `Từ chối bởi ${getApproverRoleName(approverRole)}\nLý do: ${rejectReason}\nMeta: ` + JSON.stringify(meta),
        requestorEmail: v.requestorEmail || existingVoucher.requestorEmail || '',
        approverEmail: approverEmail,
        attachments: ""
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
          latestStatus = rows[i][5] || '';
          latestAction = rows[i][6] || '';
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
        by: v.rejectedBy || v.approverEmail || '', 
        note: v.rejectReason || 'Từ chối', 
        requestorEmail: v.requestorEmail || '',
        approverEmail: v.approverEmail || '',
        attachments: "" 
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
    
    // Parse meta from note field
    let meta = {};
    if (existingVoucher.meta) {
      try {
        meta = JSON.parse(existingVoucher.meta);
      } catch (e) {
        Logger.log('Error parsing meta: ' + e.toString());
      }
    }
    
    // Get companyApprovers from meta
    const companyApprovers = meta.companyApprovers || {};
    
    // Build status response
    const statusData = {
      voucherNumber: voucherNumber,
      overallStatus: companyApprovers.overallStatus || existingVoucher.status || 'Pending Approval',
      displayStatus: companyApprovers.displayStatus || 'Chờ duyệt',
      approvalProgress: companyApprovers.approvalProgress || '0/3',
      currentApprover: companyApprovers.currentApprover || null,
      currentApproverName: companyApprovers.currentApprover && companyApprovers.approvers
        ? (companyApprovers.approvers[companyApprovers.currentApprover] 
          ? companyApprovers.approvers[companyApprovers.currentApprover].name 
          : null)
        : null,
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
    
    if (requestBody) {
      if (typeof requestBody === 'object') {
        // Google Apps Script e.parameter is a special object
        // Access properties directly - might not show up in Object.keys()
        companyName = requestBody.companyName || 
                     requestBody.company || 
                     (requestBody.hasOwnProperty ? (requestBody.hasOwnProperty('companyName') ? requestBody.companyName : '') : '') ||
                     '';
        
        // Try accessing as dictionary-style
        if (!companyName) {
          try {
            companyName = requestBody['companyName'] || requestBody['company'] || '';
          } catch (e) {
            Logger.log('Error accessing companyName with bracket notation:', e);
          }
        }
        
        Logger.log('Extracted companyName from object:', companyName || '(empty)');
        
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
    
    // Column mapping based on "Công ty" sheet structure:
    // A: Tên công ty viết tắt - index 0
    // B: Tên công ty - index 1 (THIS IS WHERE WE MATCH - Column B)
    // C: Địa chỉ - index 2
    // D: Mã số thuế - index 3
    // 
    // Legal Representative (Đại diện pháp luật):
    //   E: Email - index 4
    //   F: Name - index 5
    //   G: Signature URL - index 6
    // 
    // Chief Accountant (Kế toán trưởng):
    //   H: Email - index 7
    //   I: Name - index 8
    //   J: Signature URL - index 9
    // 
    // Treasurer (Thủ quỹ):
    //   K: Email - index 10
    //   L: Name - index 11
    //   M: Signature URL - index 12
    
    Logger.log('Searching for company: "' + companyName + '" in column B (index 1)');
    
    // Find the company row (skip header row at index 0)
    let companyRow = null;
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowCompanyName = (row[1] || '').toString().trim(); // Column B (index 1): Tên công ty
      
      Logger.log('Row ' + (i + 1) + ' - Column B value: "' + rowCompanyName + '"');
      
      // Exact match or case-insensitive match
      const searchName = companyName.trim();
      const searchNameLower = searchName.toLowerCase();
      const rowNameLower = rowCompanyName.toLowerCase();
      
      if (rowCompanyName === searchName || rowNameLower === searchNameLower) {
        companyRow = row;
        Logger.log('✅ Found company match at row ' + (i + 1) + ': "' + rowCompanyName + '"');
        break;
      }
    }
    
    if (!companyRow) {
      Logger.log('❌ Company not found: ' + companyName);
      return createResponse(false, 'Không tìm thấy công ty: ' + companyName);
    }
    
    // Extract approver data
    const approvers = {
      legalRep: {
        name: (companyRow[5] || '').toString().trim(),        // Column F: Đại diện pháp luật
        email: (companyRow[4] || '').toString().trim(),       // Column E: Email Đại diện pháp luật
        signature: (companyRow[6] || '').toString().trim(),   // Column G: Chữ ký (URL)
        role: 'Đại diện pháp luật'
      },
      accountant: {
        name: (companyRow[8] || '').toString().trim(),        // Column I: Kế toán trưởng
        email: (companyRow[7] || '').toString().trim(),       // Column H: Email Kế toán trưởng
        signature: (companyRow[9] || '').toString().trim(),   // Column J: Chữ ký (URL)
        role: 'Kế toán trưởng'
      },
      treasurer: {
        name: (companyRow[11] || '').toString().trim(),       // Column L: Thủ quỹ
        email: (companyRow[10] || '').toString().trim(),      // Column K: Email Thủ quỹ
        signature: (companyRow[12] || '').toString().trim(),  // Column M: Chữ ký (URL)
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
    
    // Column structure: A=VoucherNumber, B=VoucherType, C=Company, D=Employee, E=Amount, F=Status, G=Action, H=By, I=Note, J=Attachments, K=RequestorEmail, L=ApproverEmail, M=Timestamp
    const headers = data[0];
    const rows = data.slice(1);
    
    Logger.log('Total rows in sheet (excluding header): ' + rows.length);
    
    // Get latest entry for each voucher number
    const voucherMap = new Map();
    rows.forEach(row => {
      const voucherNumber = row[0]; // Column A
      if (!voucherNumber || voucherNumber.toString().trim() === '') return; // Skip empty voucher numbers
      
      const timestamp = row[12] || new Date(0); // Column M
      // Convert timestamp to Date for comparison
      const timestampDate = timestamp instanceof Date ? timestamp : new Date(timestamp);
      
      if (!voucherMap.has(voucherNumber)) {
        // First occurrence of this voucher number
        voucherMap.set(voucherNumber, {
          voucherNumber: voucherNumber.toString().trim(),
          voucherType: row[1] || '', // Column B
          company: row[2] || '', // Column C
          employee: row[3] || '', // Column D
          amount: row[4] || 0, // Column E
          status: row[5] || '', // Column F
          action: row[6] || '', // Column G
          by: row[7] || '', // Column H
          note: row[8] || '', // Column I
          attachments: row[9] || '', // Column J
          requestorEmail: row[10] || '', // Column K
          approverEmail: row[11] || '', // Column L
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
            voucherType: row[1] || '', // Column B
            company: row[2] || '', // Column C
            employee: row[3] || '', // Column D
            amount: row[4] || 0, // Column E
            status: row[5] || '', // Column F
            action: row[6] || '', // Column G
            by: row[7] || '', // Column H
            note: row[8] || '', // Column I
            attachments: row[9] || '', // Column J
            requestorEmail: row[10] || '', // Column K
            approverEmail: row[11] || '', // Column L
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
    
    // Column structure: A=VoucherNumber, B=VoucherType, C=Company, D=Employee, E=Amount, F=Status, G=Action, H=By, I=Note, J=Attachments, K=RequestorEmail, L=ApproverEmail, M=Timestamp
    rows.forEach(row => {
      if (row[0] === voucherNumber) {
        const noteField = row[8] || '';
        let meta = {};
        
        // Try to extract meta JSON from note field
        // Format: "Some text\nMeta: {...json...}"
        if (noteField && noteField.includes('Meta: ')) {
          try {
            const metaStart = noteField.indexOf('Meta: ') + 6;
            const metaJsonString = noteField.substring(metaStart);
            meta = JSON.parse(metaJsonString);
            Logger.log('Parsed meta from note: ' + JSON.stringify(meta));
          } catch (parseError) {
            Logger.log('Warning: Failed to parse meta from note field: ' + parseError.toString());
            // If parsing fails, meta remains empty object
          }
        }
        
        history.push({
          voucherNumber: row[0] || '',
          voucherType: row[1] || '',
          company: row[2] || '',
          employee: row[3] || '',
          amount: row[4] || 0,
          status: row[5] || '',
          action: row[6] || '',
          by: row[7] || '',
          note: noteField,
          meta: meta, // Add parsed meta object
          attachments: row[9] || '', // Column J
          requestorEmail: row[10] || '',
          approverEmail: row[11] || '',
          timestamp: row[12] || new Date()
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
  try {
    Logger.log('📝 Attempting to append history for voucher: ' + entry.voucherNumber);
    
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
    
    sheet.appendRow([
      entry.voucherNumber || '',
      entry.voucherType || '',
      entry.company || '',
      entry.employee || '',
      entry.amount || 0,
      entry.status || '',
      entry.action || '',
      entry.by || '',
      entry.note || '',
      entry.attachments || '',
      entry.requestorEmail || '',
      entry.approverEmail || '',
      new Date()
    ]);
    
    Logger.log('✅ History appended successfully for voucher: ' + entry.voucherNumber);
    Logger.log('   - Action: ' + entry.action);
    Logger.log('   - Status: ' + entry.status);
    Logger.log('   - By: ' + entry.by);
    
    return true;
  } catch (error) {
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
