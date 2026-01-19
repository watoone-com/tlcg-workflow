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
      return handleGetCompanyApprovers(e.parameter);
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
      action = e.parameter.action;
      requestBody = e.parameter;
      Logger.log('Using e.parameter directly, action: ' + action);
      Logger.log('e.parameter keys: ' + Object.keys(e.parameter).join(', '));
      Logger.log('e.parameter.companyName: ' + (e.parameter.companyName || 'not found'));
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
    
    // Normalize action (trim whitespace)
    const normalizedAction = action ? String(action).trim() : '';
    
    switch (normalizedAction) {
      case 'login': return handleLogin_(requestBody);
      case 'sendApprovalEmail': return handleSendEmail(requestBody);
      case 'approveVoucher': return handleApproveVoucher(requestBody);
      case 'rejectVoucher': return handleRejectVoucher(requestBody);
      case 'getVoucherSummary': return handleGetVoucherSummary(requestBody);
      case 'getVoucherHistory': return handleGetVoucherHistory(requestBody);
      case 'getEmployees': return handleGetEmployees(requestBody);
      case 'getCompanyApprovers': 
        Logger.log('✅ Matched getCompanyApprovers case');
        Logger.log('RequestBody for getCompanyApprovers:', JSON.stringify(requestBody));
        return handleGetCompanyApprovers(requestBody);
      default: 
        Logger.log('⚠️ WARNING: Unknown action: "' + normalizedAction + '" (original: "' + action + '")');
        Logger.log('⚠️ Available actions: login, sendApprovalEmail, approveVoucher, rejectVoucher, getVoucherSummary, getVoucherHistory, getEmployees, getCompanyApprovers');
        return createResponse(false, 'Action không hợp lệ: ' + normalizedAction);
    }
  } catch (error) {
    Logger.log('❌ CRITICAL ERROR in doPost: ' + error.toString());
    Logger.log('❌ Error stack: ' + error.stack);
    // Always return JSON, never HTML
    return createResponse(false, 'Lỗi Server: ' + error.message);
  }
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

    // Gửi email bằng GmailApp - to approvers
    try {
      let options = { htmlBody: emailData.body };
      if (emailData.cc && emailData.cc.trim() !== "") options.cc = emailData.cc.trim();
      // Use logged-in user's email as reply-to (instead of script owner's email)
      if (emailData.replyTo && emailData.replyTo.trim() !== "") {
        options.replyTo = emailData.replyTo.trim();
        Logger.log('Setting reply-to to logged-in user email: ' + options.replyTo);
      }
      GmailApp.sendEmail(emailData.to, emailData.subject, '', options);
    } catch (emailError) {
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
    
    appendHistory_({
      voucherNumber: voucherNo,
      voucherType: voucher.voucherType || '',
      company: voucher.company || '',
      employee: voucher.employee || '',
      amount: voucher.amount || 0,
      status: 'Pending',
      action: 'Submit',
      by: voucher.employee || 'User',
      note: 'Gửi phê duyệt\nMeta: ' + JSON.stringify(submitMetaData), // Store all metadata including signature
      requestorEmail: voucher.requestorEmail || '',
      approverEmail: emailData.to,
      attachments: fileLinks
    });

    return createResponse(true, 'Đã gửi yêu cầu phê duyệt thành công');
  } catch (error) {
    return createResponse(false, 'Lỗi gửi mail: ' + error.message);
  }
}

/** 2. PHÊ DUYỆT / TỪ CHỐI */
function handleApproveVoucher(requestBody) {
  try {
    const v = requestBody.voucher || {};
    const voucherNumber = v.voucherNumber || '';
    
    if (!voucherNumber) {
      return createResponse(false, 'Thiếu số phiếu');
    }
    
    // Check if voucher was already processed (prevent duplicate approval/rejection)
    const sheet = SpreadsheetApp.openById(VOUCHER_HISTORY_SHEET_ID).getSheetByName(VH_SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    const rows = data.slice(1); // Skip header
    
    // Find latest status for this voucher
    let latestStatus = null;
    let latestAction = null;
    for (let i = rows.length - 1; i >= 0; i--) {
      if (rows[i][0] === voucherNumber) {
        latestStatus = rows[i][5] || ''; // Column F = Status
        latestAction = rows[i][6] || ''; // Column G = Action
        break;
      }
    }
    
    // Check if already approved or rejected
    if (latestStatus === 'Approved' || latestAction === 'Approved') {
      Logger.log('⚠️ Voucher already approved: ' + voucherNumber);
      return createResponse(false, 'Phiếu này đã được duyệt trước đó. Không thể duyệt lại.');
    }
    
    if (latestStatus === 'Rejected' || latestAction === 'Rejected') {
      Logger.log('⚠️ Voucher already rejected: ' + voucherNumber);
      return createResponse(false, 'Phiếu này đã được từ chối trước đó. Không thể duyệt.');
    }
    
    // Check if signature is provided
    if (!v.approverSignature || v.approverSignature.trim() === '') {
      return createResponse(false, 'Vui lòng tải lên chữ ký trước khi phê duyệt');
    }
    
    // Store approver signature in meta field (JSON format)
    const metaData = {
      approverSignature: v.approverSignature || '',
      approvedAt: new Date().toISOString(),
      approvedBy: v.approvedBy || v.approverEmail || ''
    };
    
    // Append history entry
    appendHistory_({ 
      voucherNumber: voucherNumber,
      voucherType: v.voucherType || '',
      company: v.company || '',
      employee: v.employee || '',
      amount: v.amount || 0,
      status: 'Approved', 
      action: 'Approved', 
      by: v.approvedBy || v.approverEmail || '', 
      note: 'Duyệt qua Email\nMeta: ' + JSON.stringify(metaData), // Store signature in note field as JSON
      requestorEmail: v.requestorEmail || '',
      approverEmail: v.approverEmail || '',
      attachments: "" 
    });
    
    // Send notification email to requester
    if (v.requestorEmail) {
      try {
        const emailSubject = "[ĐÃ DUYỆT] " + (voucherNumber || '');
        const emailBody = `
          <p>Phiếu <strong>${voucherNumber}</strong> của bạn đã được duyệt.</p>
          <p>Được duyệt bởi: ${v.approvedBy || v.approverEmail || 'Người phê duyệt'}</p>
          <p>Thời gian: ${new Date().toLocaleString('vi-VN')}</p>
        `;
        GmailApp.sendEmail(v.requestorEmail, emailSubject, '', { htmlBody: emailBody });
      } catch (emailError) {
        Logger.log('Warning: Failed to send approval email: ' + emailError.toString());
        // Don't fail the approval if email fails
      }
    }
    
    Logger.log('✅ Voucher approved successfully: ' + voucherNumber);
    return createResponse(true, 'Đã duyệt thành công');
  } catch (error) {
    Logger.log('❌ Error approving voucher: ' + error.toString());
    return createResponse(false, 'Lỗi: ' + error.message);
  }
}

function handleRejectVoucher(requestBody) {
  try {
    const v = requestBody.voucher || {};
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
  } catch (error) {
    return createResponse(false, 'Lỗi: ' + error.message);
  }
}

/** 3. LOGIN & THỐNG KÊ */
function handleLogin_(requestBody) {
  try {
    const ss = SpreadsheetApp.openById(USERS_SHEET_ID);
    const data = ss.getSheetByName(EMPLOYEES_SHEET_NAME).getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][4] == requestBody.email) {
        return createResponse(true, 'Thành công', { name: data[i][0], email: data[i][4], role: data[i][1] });
      }
    }
    return createResponse(false, 'Tài khoản không tồn tại');
  } catch (error) {
    return createResponse(false, 'Lỗi: ' + error.message);
  }
}

/**
 * Fetch all employees from "Nhân viên" sheet
 * Returns employee data with name, email, department (column C - Phòng ban), company, etc.
 */
function handleGetEmployees(requestBody) {
  try {
    Logger.log('=== handleGetEmployees called ===');
    
    const ss = SpreadsheetApp.openById(USERS_SHEET_ID);
    const sheet = ss.getSheetByName(EMPLOYEES_SHEET_NAME);
    
    if (!sheet) {
      Logger.log('❌ Sheet "' + EMPLOYEES_SHEET_NAME + '" not found');
      return createResponse(false, 'Sheet "' + EMPLOYEES_SHEET_NAME + '" không tồn tại');
    }
    
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
 */
function handleGetCompanyApprovers(requestBody) {
  try {
    Logger.log('=== handleGetCompanyApprovers called ===');
    Logger.log('Request body type:', typeof requestBody);
    Logger.log('Request body:', JSON.stringify(requestBody));
    
    // Get company name from request (handle both e.parameter object and parsed requestBody)
    // When called from doGet: e.parameter.companyName
    // When called from doPost: requestBody.companyName or e.parameter.companyName (if FormData)
    let companyName = '';
    if (requestBody) {
      if (typeof requestBody === 'object') {
        companyName = requestBody.companyName || requestBody.company || '';
      } else if (typeof requestBody === 'string') {
        // If it's a string, try to parse it
        try {
          const parsed = JSON.parse(requestBody);
          companyName = parsed.companyName || parsed.company || '';
        } catch (e) {
          // Not JSON, treat as company name directly
          companyName = requestBody;
        }
      }
    }
    
    // Also check if companyName came as a direct parameter (from URL params)
    if (!companyName || companyName.trim() === '') {
      // Try to get from global parameter if this was called from doGet/doPost
      const param = requestBody || {};
      companyName = param.companyName || param.company || '';
    }
    
    if (!companyName || companyName.trim() === '') {
      Logger.log('❌ Company name is missing');
      return createResponse(false, 'Tên công ty là bắt buộc');
    }
    
    Logger.log('Looking for company: ' + companyName);
    
    const ss = SpreadsheetApp.openById(TLCG_MASTER_DATA_SHEET_ID);
    const sheet = ss.getSheetByName(COMPANY_SHEET_NAME);
    
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
    // B: Tên công ty - index 1 (match this)
    // C: Địa chỉ - index 2
    // D: Mã số thuế - index 3
    // E: Email Đại diện pháp luật - index 4
    // F: Đại diện pháp luật (name) - index 5
    // G: Chữ ký Đại diện pháp luật (signature URL) - index 6
    // H: Email Kế toán trưởng - index 7
    // I: Kế toán trưởng (name) - index 8
    // J: Chữ ký Kế toán trưởng (signature URL) - index 9
    // K: Email Thủ quỹ - index 10
    // L: Thủ quỹ (name) - index 11
    // M: Chữ ký Thủ quỹ (signature URL) - index 12
    
    // Find the company row (skip header row at index 0)
    let companyRow = null;
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowCompanyName = (row[1] || '').toString().trim(); // Column B: Tên công ty
      
      // Exact match or case-insensitive match
      if (rowCompanyName === companyName.trim() || 
          rowCompanyName.toLowerCase() === companyName.trim().toLowerCase()) {
        companyRow = row;
        Logger.log('✅ Found company at row ' + (i + 1));
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
    
    // Use the exact same pattern as handleSendEmail and appendHistory_ (one-liner chaining)
    // These functions work correctly, so we'll match their pattern exactly
    let sheet;
    try {
      Logger.log('Accessing sheet using same pattern as handleSendEmail...');
      sheet = SpreadsheetApp.openById(VOUCHER_HISTORY_SHEET_ID).getSheetByName(VH_SHEET_NAME);
      Logger.log('✅ Sheet accessed successfully');
    } catch (error) {
      Logger.log('❌ ERROR accessing sheet: ' + error.toString());
      Logger.log('❌ Error message: ' + (error.message || 'N/A'));
      Logger.log('❌ Error stack: ' + (error.stack || 'N/A'));
      return createResponse(false, 'Không thể truy cập Spreadsheet: ' + error.message);
    }
    
    if (!sheet) {
      Logger.log('❌ Sheet object is null');
      return createResponse(false, 'Sheet "' + VH_SHEET_NAME + '" không tồn tại');
    }
    
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
