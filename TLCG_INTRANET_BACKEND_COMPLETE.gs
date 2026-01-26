/**
 * TLCG INTRANET BACKEND - COMPLETE CODE
 * Google Apps Script for TLCGroup Intranet Authentication & Voucher System
 * 
 * Hướng dẫn setup:
 * 1. Mở script.google.com
 * 2. Tạo project mới hoặc mở project hiện có
 * 3. Copy toàn bộ code này vào Code.gs
 * 4. Deploy -> New deployment -> Web app
 * 5. Copy Web App URL vào file HTML
 * 
 * Features:
 * - User Authentication (Login)
 * - Send Approval Email
 * - Sync to Google Sheets
 * - Approve/Reject Voucher
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

// ⚠️ IMPORTANT: Google Sheet ID for TLCG Master Data (Users)
const USERS_SHEET_ID = '1ujmPbtEdkGLgEshfhvV8gRB6R0GLI31jsZM5rDOJS0g'; // TLCG Master Data
const USERS_SHEET_NAME = 'Nhân viên'; // Sheet name: Nhân viên
// Alternative: Use gid=2018642708 if sheet name doesn't work

// ============================================================================
// HELPER FUNCTIONS FOR ERROR HANDLING
// ============================================================================

/**
 * Helper function to safely open a spreadsheet with detailed error handling
 * @param {string} spreadsheetId - The ID of the spreadsheet to open
 * @param {string} context - Context description for logging (e.g., "handleLogin")
 * @returns {Spreadsheet} - The spreadsheet object
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
      throw new Error('Script chưa được cấp quyền truy cập Google Sheets.\n\nGiải pháp:\n1. Mở Apps Script editor (script.google.com)\n2. Chạy function testSpreadsheetAccess một lần\n3. Cấp quyền khi được yêu cầu\n4. Deploy lại web app: Deploy > Manage deployments > Edit\n5. Đặt "Execute as: Me" và "Who has access: Anyone"\n6. Click "Deploy" và copy URL mới\n\nSpreadsheet ID: ' + spreadsheetId + '\nLỗi gốc: ' + error.message);
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

// ============================================================================
// MAIN REQUEST HANDLERS
// ============================================================================

/**
 * Hàm xử lý POST request từ web app
 */
function doPost(e) {
  try {
    Logger.log('=== doPost called ===');
    Logger.log('e.postData: ' + JSON.stringify(e.postData));
    Logger.log('e.parameter: ' + JSON.stringify(e.parameter));
    
    // Enable CORS
    const output = ContentService.createTextOutput();
    
    // Parse request body - try multiple methods
    let requestBody;
    
    // Method 1: Try e.postData.contents (standard POST)
    if (e.postData && e.postData.contents) {
      try {
        requestBody = JSON.parse(e.postData.contents);
        Logger.log('Parsed from e.postData.contents');
      } catch (parseError) {
        Logger.log('Error parsing e.postData.contents: ' + parseError.toString());
      }
    }
    
    // Method 2: Try e.parameter (form data or query string)
    if (!requestBody && e.parameter) {
      try {
        // Check if it's form data (from FormData) - this avoids CORS preflight
        if (e.parameter.action) {
          // Form data format: action, email, password, etc.
          requestBody = {
            action: e.parameter.action,
            email: e.parameter.email,
            password: e.parameter.password
          };
          Logger.log('Parsed from e.parameter (form data)');
          Logger.log('Form data - action: ' + requestBody.action + ', email: ' + requestBody.email);
        } else {
          // If data is in parameter, it might be a string
          const dataParam = e.parameter.data || e.parameter.body;
          if (dataParam) {
            requestBody = typeof dataParam === 'string' ? JSON.parse(dataParam) : dataParam;
            Logger.log('Parsed from e.parameter');
          }
        }
      } catch (parseError) {
        Logger.log('Error parsing e.parameter: ' + parseError.toString());
      }
    }
    
    // Method 3: Try direct e.postData (if it's already an object)
    if (!requestBody && e.postData) {
      try {
        if (typeof e.postData === 'object' && !e.postData.contents) {
          requestBody = e.postData;
          Logger.log('Using e.postData directly');
        }
      } catch (error) {
        Logger.log('Error using e.postData directly: ' + error.toString());
      }
    }
    
    if (!requestBody) {
      Logger.log('Error: Could not parse request body');
      Logger.log('e object keys: ' + Object.keys(e).join(', '));
      return createResponse(false, 'Could not parse request body. Check logs for details.');
    }
    
    Logger.log('Request body parsed successfully: ' + JSON.stringify(requestBody));
    
    const action = requestBody.action;
    let result;

    switch (action) {
      case 'login':
        result = handleLogin(requestBody);
        break;
      
      case 'sendApprovalEmail':
        result = handleSendEmail(requestBody);
        break;
      
      case 'syncToSheets':
        result = handleSyncToSheets(requestBody);
        break;
      
      case 'rejectVoucher':
        result = handleRejectVoucher(requestBody);
        break;
      
      case 'approveVoucher':
        result = handleApproveVoucher(requestBody);
        break;
      
      case 'getMasterData':
        result = handleGetMasterData(requestBody);
        break;
      
      default:
        result = createResponse(false, 'Invalid action: ' + action);
    }
    
    // Set CORS headers
    output.setMimeType(ContentService.MimeType.JSON);
    return result;
  } catch (error) {
    Logger.log('Error in doPost: ' + error.toString());
    Logger.log('Error stack: ' + error.stack);
    return createResponse(false, 'Server error: ' + error.message);
  }
}

/**
 * Hàm xử lý GET request (fallback cho approve/reject)
 */
function doGet(e) {
  try {
    Logger.log('=== doGet called ===');
    Logger.log('Full e object: ' + JSON.stringify(e));
    Logger.log('e.parameter: ' + JSON.stringify(e.parameter));
    Logger.log('e.parameter keys: ' + Object.keys(e.parameter || {}).join(', '));
    
    const action = e.parameter ? e.parameter.action : null;
    Logger.log('Action: ' + action);
    
    if (action === 'approveVoucher' || action === 'rejectVoucher') {
      // Parse data from query parameters
      let requestBody = {
        action: action,
        voucher: {}
      };
      
      if (e.parameter && e.parameter.voucherNumber) {
        requestBody.voucher.voucherNumber = e.parameter.voucherNumber || '';
        requestBody.voucher.voucherType = e.parameter.voucherType || '';
        requestBody.voucher.company = e.parameter.company || '';
        requestBody.voucher.employee = e.parameter.employee || '';
        requestBody.voucher.amount = e.parameter.amount || '';
        requestBody.voucher.requestorEmail = e.parameter.requestorEmail || '';
        requestBody.voucher.approverEmail = e.parameter.approverEmail || '';
        requestBody.voucher.approvedBy = e.parameter.approvedBy || e.parameter.approverEmail || '';
        requestBody.voucher.rejectReason = e.parameter.rejectReason || '';
        requestBody.voucher.rejectedBy = e.parameter.rejectedBy || e.parameter.approverEmail || '';
        
        Logger.log('Parsed requestorEmail: ' + requestBody.voucher.requestorEmail);
        Logger.log('Parsed approverEmail: ' + requestBody.voucher.approverEmail);
      } else {
        Logger.log('⚠️ WARNING: e.parameter.voucherNumber is missing!');
        Logger.log('Available parameters: ' + JSON.stringify(e.parameter));
      }
      
      Logger.log('Request body from GET: ' + JSON.stringify(requestBody));
      
      if (action === 'approveVoucher') {
        Logger.log('Calling handleApproveVoucher...');
        return handleApproveVoucher(requestBody);
      } else if (action === 'rejectVoucher') {
        Logger.log('Calling handleRejectVoucher...');
        return handleRejectVoucher(requestBody);
      }
    } else {
      Logger.log('Action is not approveVoucher or rejectVoucher, returning default message');
    }
    
    return ContentService.createTextOutput('Google Apps Script is running!')
      .setMimeType(ContentService.MimeType.TEXT);
  } catch (error) {
    Logger.log('Error in doGet: ' + error.toString());
    return ContentService.createTextOutput('Error: ' + error.message)
      .setMimeType(ContentService.MimeType.TEXT);
  }
}

// ============================================================================
// AUTHENTICATION FUNCTIONS
// ============================================================================

/**
 * Authenticate user with email and password
 */
function authenticateUser(email, password) {
  try {
    Logger.log('=== AUTHENTICATE USER ===');
    Logger.log('Email: ' + email);
    Logger.log('USERS_SHEET_ID: ' + USERS_SHEET_ID);
    Logger.log('USERS_SHEET_NAME: ' + USERS_SHEET_NAME);

    // Open the users spreadsheet with error handling
    const spreadsheet = safeOpenSpreadsheet(USERS_SHEET_ID, 'authenticateUser');

    // Try to get sheet by name first
    let sheet;
    try {
      sheet = safeGetSheet(spreadsheet, USERS_SHEET_NAME, 'authenticateUser');
    } catch (sheetError) {
      // If sheet name not found, try using first sheet as fallback
      Logger.log('Sheet name not found, trying first sheet as fallback');
      const sheets = spreadsheet.getSheets();
      if (sheets && sheets.length > 0) {
        sheet = sheets[0];
        Logger.log('Using first sheet: ' + sheet.getName());
      } else {
        throw new Error('Không tìm thấy sheet nào trong spreadsheet');
      }
    }
    
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) {
      Logger.log('No users found in sheet');
      return { success: false, message: 'No users configured' };
    }
    
    // Map columns based on actual sheet structure from Google Sheet:
    // A: Họ và tên (Name)
    // B: Chức vụ (Position/Role)
    // C: Phòng ban (Department) - Note: Some rows have Company here
    // D: Công ty (Company)
    // E: Email
    // F: Điện thoại (Phone)
    // G: Status
    // H: EmployeeId
    // I: Role
    // J: isAdmin
    // K: (other data)
    // L: Password - SHA-256 hash (DO NOT RETURN)
    
    const headers = data[0];
    
    // Debug: Log all headers
    Logger.log('Sheet headers: ' + JSON.stringify(headers));
    Logger.log('Total columns: ' + headers.length);
    
    // Find columns by header name first, then by position
    let emailCol = headers.indexOf('Email');
    if (emailCol === -1) emailCol = headers.indexOf('email');
    if (emailCol === -1) emailCol = 4; // Column E (0-indexed = 4)
    
    // Find password column - try multiple methods
    let passwordCol = headers.indexOf('Password');
    if (passwordCol === -1) passwordCol = headers.indexOf('password');
    if (passwordCol === -1) passwordCol = headers.indexOf('Password'); // Case sensitive check
    // If still not found, try Column L (index 11) where password hash is stored
    if (passwordCol === -1) {
      // Check if Column L (index 11) exists and has data in row 2
      if (headers.length > 11 && data.length > 1 && data[1][11]) {
        passwordCol = 11; // Column L
        Logger.log('Using Column L (index 11) for password');
      } else if (headers.length > 10 && data.length > 1 && data[1][10]) {
        passwordCol = 10; // Column K (fallback)
        Logger.log('Using Column K (index 10) for password');
      } else {
        passwordCol = 11; // Default to Column L
        Logger.log('Defaulting to Column L (index 11) for password');
      }
    }
    
    let nameCol = headers.indexOf('Họ và tên');
    if (nameCol === -1) nameCol = headers.indexOf('name');
    if (nameCol === -1) nameCol = 0; // Column A
    
    // Find role column - try "Chức vụ" first (Column B), then "Role" (Column I)
    let roleCol = headers.indexOf('Chức vụ');
    if (roleCol === -1) roleCol = headers.indexOf('Role');
    if (roleCol === -1) roleCol = headers.indexOf('role');
    if (roleCol === -1) roleCol = 1; // Default to Column B (Chức vụ)
    
    let isAdminCol = headers.indexOf('isAdmin');
    if (isAdminCol === -1) isAdminCol = headers.indexOf('IsAdmin');
    if (isAdminCol === -1) isAdminCol = 9; // Column J
    
    // Find EmployeeId column - try multiple header names
    let employeeIdCol = headers.indexOf('EmployeeId');
    if (employeeIdCol === -1) employeeIdCol = headers.indexOf('employeeId');
    if (employeeIdCol === -1) employeeIdCol = headers.indexOf('Employee ID');
    if (employeeIdCol === -1) employeeIdCol = headers.indexOf('employee id');
    if (employeeIdCol === -1) employeeIdCol = headers.indexOf('Mã nhân viên');
    if (employeeIdCol === -1) employeeIdCol = 7; // Default to Column H (0-indexed = 7)
    
    Logger.log('EmployeeId column: ' + employeeIdCol + ' (header: ' + (headers[employeeIdCol] || 'N/A') + ')');
    
    let departmentCol = headers.indexOf('Phòng ban');
    if (departmentCol === -1) departmentCol = headers.indexOf('department');
    if (departmentCol === -1) departmentCol = 2; // Column C
    
    let companyCol = headers.indexOf('Công ty');
    if (companyCol === -1) companyCol = headers.indexOf('company');
    if (companyCol === -1) companyCol = 3; // Column D
    
    let phoneCol = headers.indexOf('Điện thoại');
    if (phoneCol === -1) phoneCol = headers.indexOf('phone');
    if (phoneCol === -1) phoneCol = 5; // Column F
    
    let statusCol = headers.indexOf('Status');
    if (statusCol === -1) statusCol = headers.indexOf('status');
    if (statusCol === -1) statusCol = 6; // Column G
    
    Logger.log('Column mapping:');
    Logger.log('Email: ' + emailCol + ' (header: ' + (headers[emailCol] || 'N/A') + ')');
    Logger.log('Password: ' + passwordCol + ' (header: ' + (headers[passwordCol] || 'N/A') + ')');
    Logger.log('Name: ' + nameCol + ', Role: ' + roleCol + ', isAdmin: ' + isAdminCol + ', Status: ' + statusCol);
    
    // Validate required columns exist
    if (emailCol === -1) {
      Logger.log('ERROR: Email column not found');
      return { success: false, message: 'Database configuration error: Email column not found' };
    }
    
    // Check if password column has data
    if (passwordCol >= 0 && data.length > 1) {
      const samplePassword = data[1][passwordCol];
      Logger.log('Sample password from row 2, column ' + passwordCol + ': ' + (samplePassword ? samplePassword.toString().substring(0, 20) + '...' : 'EMPTY'));
    }
    
    // Validate password input
    if (!password || password === null || password === undefined || password.toString().trim() === '') {
      Logger.log('ERROR: Password is null, undefined, or empty');
      return { success: false, message: 'Password is required' };
    }
    
    // Hash the provided password
    let hashedPassword;
    try {
      hashedPassword = hashPassword(password);
      Logger.log('Hashed password: ' + hashedPassword.substring(0, 10) + '...');
    } catch (hashError) {
      Logger.log('ERROR hashing password: ' + hashError.toString());
      return { success: false, message: 'Error processing password: ' + hashError.message };
    }
    
    // Search for user
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const rowEmail = row[emailCol];
      
      // Skip empty rows
      if (!rowEmail || rowEmail.toString().trim() === '') {
        continue;
      }
      
      const rowPassword = passwordCol >= 0 ? row[passwordCol] : '';
      const rowStatus = statusCol >= 0 ? row[statusCol] : 'Active';
      
      // Check email match (case insensitive)
      if (rowEmail.toString().toLowerCase().trim() === email.toLowerCase().trim()) {
        Logger.log('Found user: ' + rowEmail);
        Logger.log('Row password (raw): ' + (rowPassword ? rowPassword.toString().substring(0, 20) + '...' : 'EMPTY'));
        Logger.log('Hashed password (input): ' + hashedPassword.substring(0, 20) + '...');
        
        // Check status
        if (rowStatus && rowStatus.toString().toLowerCase() !== 'active') {
          Logger.log('User account is inactive. Status: ' + rowStatus);
          return { success: false, message: 'Account is inactive' };
        }
        
        // Check if password column exists and has value
        if (passwordCol < 0 || !rowPassword || rowPassword.toString().trim() === '') {
          Logger.log('WARNING: Password not set for user. Column: ' + passwordCol + ', Value: ' + rowPassword);
          return { success: false, message: 'Password not configured for this user. Please contact administrator.' };
        }
        
        // Trim and compare password (compare hashed)
        const storedPassword = rowPassword.toString().trim();
        Logger.log('Comparing passwords - Stored: ' + storedPassword.substring(0, 20) + '... vs Hashed: ' + hashedPassword.substring(0, 20) + '...');
        
        if (storedPassword === hashedPassword) {
          Logger.log('Password match! Authentication successful');
          
          // Extract user data with logging
          const userName = nameCol >= 0 && row[nameCol] ? row[nameCol].toString().trim() : 'User';
          const userRole = roleCol >= 0 && row[roleCol] ? row[roleCol].toString().trim() : 'User';
          
          // Extract EmployeeId - check if column exists and has value
          let userEmployeeId = '';
          if (employeeIdCol >= 0 && employeeIdCol < row.length) {
            const employeeIdValue = row[employeeIdCol];
            if (employeeIdValue !== null && employeeIdValue !== undefined && employeeIdValue !== '') {
              userEmployeeId = employeeIdValue.toString().trim();
            }
          }
          
          const userDepartment = departmentCol >= 0 && row[departmentCol] ? row[departmentCol].toString().trim() : '';
          
          // Get company - try from companyCol first, then fallback to column D
          let userCompany = '';
          if (companyCol >= 0 && row[companyCol]) {
            userCompany = row[companyCol].toString().trim();
          } else {
            userCompany = row[3] ? row[3].toString().trim() : ''; // Fallback to Column D (0-indexed = 3)
          }
          
          const userPhone = phoneCol >= 0 && row[phoneCol] ? row[phoneCol].toString().trim() : '';
          
          Logger.log('User data extracted:');
          Logger.log('Name column: ' + nameCol + ', Value: ' + userName);
          Logger.log('Role column: ' + roleCol + ', Value: ' + userRole);
          Logger.log('EmployeeId column: ' + employeeIdCol + ', Raw value: ' + (employeeIdCol >= 0 && employeeIdCol < row.length ? row[employeeIdCol] : 'N/A') + ', Processed: ' + userEmployeeId);
          Logger.log('Department column: ' + departmentCol + ', Value: ' + userDepartment);
          Logger.log('Company column: ' + companyCol + ', Value: ' + userCompany);
          Logger.log('Phone column: ' + phoneCol + ', Value: ' + userPhone);
          Logger.log('Row length: ' + row.length + ', All row values: ' + JSON.stringify(row));
          
          // Return user data (DO NOT include password - security)
          return {
            success: true,
            user: {
              email: rowEmail.toString().trim(),
              name: userName,
              role: userRole,
              isAdmin: isAdminCol >= 0 ? (row[isAdminCol] === true || row[isAdminCol] === 'TRUE' || row[isAdminCol] === 'true' || row[isAdminCol] === 'True') : false,
              employeeId: userEmployeeId,
              department: userDepartment,
              company: userCompany,
              phone: userPhone
              // Password is NOT included for security
            }
          };
        } else {
          Logger.log('Password mismatch');
          return { success: false, message: 'Invalid password' };
        }
      }
    }
    
    Logger.log('User not found: ' + email);
    return { success: false, message: 'Invalid email or password' };
    
  } catch (error) {
    Logger.log('Authentication error: ' + error.toString());
    Logger.log('Error stack: ' + error.stack);
    return { success: false, message: 'Authentication error: ' + error.message };
  }
}

/**
 * Hash password using SHA-256
 * Note: For production, consider using bcrypt or Argon2
 */
function hashPassword(password) {
  try {
    // Validate input
    if (!password || password === null || password === undefined) {
      Logger.log('Hash error: Password is null or undefined');
      throw new Error('Password cannot be null or undefined');
    }
    
    // Convert to string if not already
    const passwordString = password.toString().trim();
    
    if (passwordString === '') {
      Logger.log('Hash error: Password is empty');
      throw new Error('Password cannot be empty');
    }
    
    Logger.log('Hashing password (length: ' + passwordString.length + ')');
    
    const rawHash = Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      passwordString,
      Utilities.Charset.UTF_8
    );
    
    // Convert to hex string
    const hashString = rawHash.map(function(byte) {
      return ('0' + (byte & 0xFF).toString(16)).slice(-2);
    }).join('');
    
    Logger.log('Hash generated successfully (length: ' + hashString.length + ')');
    return hashString;
  } catch (error) {
    Logger.log('Hash error: ' + error.toString());
    Logger.log('Error stack: ' + error.stack);
    throw error; // Re-throw to see the actual error
  }
}

/**
 * Handle login request from frontend
 */
function handleLogin(requestBody) {
  try {
    Logger.log('=== HANDLE LOGIN ===');
    Logger.log('Request body: ' + JSON.stringify(requestBody));
    Logger.log('Request body type: ' + typeof requestBody);
    Logger.log('Request body keys: ' + Object.keys(requestBody || {}).join(', '));
    
    const email = requestBody.email;
    const password = requestBody.password;
    
    Logger.log('Email: ' + email + ' (type: ' + typeof email + ')');
    Logger.log('Password: ' + (password ? '***' : 'NULL/UNDEFINED') + ' (type: ' + typeof password + ')');
    
    if (!email || email === null || email === undefined || email.toString().trim() === '') {
      Logger.log('ERROR: Email is missing, null, or empty');
      return createResponse(false, 'Email is required');
    }
    
    if (!password || password === null || password === undefined || password.toString().trim() === '') {
      Logger.log('ERROR: Password is missing, null, or empty');
      return createResponse(false, 'Password is required');
    }
    
    // Authenticate user
    const authResult = authenticateUser(email, password);
    
    if (authResult.success) {
      Logger.log('Login successful for: ' + email);
      return createResponse(true, 'Login successful', authResult.user);
    } else {
      Logger.log('Login failed: ' + authResult.message);
      return createResponse(false, authResult.message || 'Invalid credentials');
    }
  } catch (error) {
    Logger.log('Login handler error: ' + error.toString());
    Logger.log('Error stack: ' + error.stack);
    return createResponse(false, 'Login error: ' + error.message);
  }
}

/**
 * Create a new user (Admin only function)
 */
function createUser(email, password, name, role, isAdmin, employeeId, department) {
  try {
    const spreadsheet = safeOpenSpreadsheet(USERS_SHEET_ID, 'createUser');
    let sheet;
    try {
      sheet = safeGetSheet(spreadsheet, USERS_SHEET_NAME, 'createUser');
    } catch (e) {
      sheet = spreadsheet.getSheets()[0];
      Logger.log('Using first sheet as fallback');
    }
    
    // Check if user exists
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const emailCol = headers.indexOf('email');
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][emailCol] === email) {
        return { success: false, message: 'User already exists' };
      }
    }
    
    // Hash password
    const hashedPassword = hashPassword(password);
    
    // Add new user
    const newRow = [
      email,
      hashedPassword,
      name || '',
      role || 'Employee',
      isAdmin || false,
      employeeId || '',
      department || '',
      'Active'
    ];
    
    sheet.appendRow(newRow);
    
    return { success: true, message: 'User created successfully' };
  } catch (error) {
    Logger.log('Create user error: ' + error.toString());
    return { success: false, message: 'Error creating user: ' + error.message };
  }
}

/**
 * Update user password
 */
function updateUserPassword(email, oldPassword, newPassword) {
  try {
    const authResult = authenticateUser(email, oldPassword);
    if (!authResult.success) {
      return { success: false, message: 'Current password is incorrect' };
    }

    const spreadsheet = safeOpenSpreadsheet(USERS_SHEET_ID, 'updateUserPassword');
    let sheet;
    try {
      sheet = safeGetSheet(spreadsheet, USERS_SHEET_NAME, 'updateUserPassword');
    } catch (e) {
      sheet = spreadsheet.getSheets()[0];
      Logger.log('Using first sheet as fallback');
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const emailCol = headers.indexOf('email');
    const passwordCol = headers.indexOf('password');
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][emailCol] === email) {
        const hashedPassword = hashPassword(newPassword);
        sheet.getRange(i + 1, passwordCol + 1).setValue(hashedPassword);
        return { success: true, message: 'Password updated successfully' };
      }
    }
    
    return { success: false, message: 'User not found' };
  } catch (error) {
    Logger.log('Update password error: ' + error.toString());
    return { success: false, message: 'Error updating password: ' + error.message };
  }
}

// ============================================================================
// VOUCHER EMAIL FUNCTIONS
// ============================================================================

/**
 * Xử lý gửi email phê duyệt
 */
function handleSendEmail(requestBody) {
  try {
    const emailData = requestBody.email;
    const to = emailData.to;
    const cc = emailData.cc || '';
    const subject = emailData.subject;
    const body = emailData.body;

    if (!to) {
      return createResponse(false, 'Recipient email is required');
    }

    GmailApp.sendEmail(to, subject, '', {
      htmlBody: body,
      cc: cc
    });

    Logger.log('Email sent successfully to: ' + to);
    return createResponse(true, 'Email sent successfully');
  } catch (error) {
    Logger.log('Error sending email: ' + error.toString());
    return createResponse(false, 'Error sending email: ' + error.message);
  }
}

/**
 * Xử lý phê duyệt phiếu
 */
function handleApproveVoucher(requestBody) {
  try {
    Logger.log('=== APPROVE VOUCHER ===');
    Logger.log('Request body: ' + JSON.stringify(requestBody));
    
    const voucher = requestBody.voucher;
    if (!voucher) {
      Logger.log('Error: voucher object is missing');
      return createResponse(false, 'Voucher data is required');
    }
    
    const voucherNumber = voucher.voucherNumber || 'N/A';
    const voucherType = voucher.voucherType || 'N/A';
    const company = voucher.company || 'N/A';
    const employee = voucher.employee || 'N/A';
    const amount = voucher.amount || 'N/A';
    const requestorEmail = voucher.requestorEmail;
    const approverEmail = voucher.approverEmail || '';
    const approvedBy = voucher.approvedBy || approverEmail;

    Logger.log('Voucher Number: ' + voucherNumber);
    Logger.log('Requestor Email: ' + requestorEmail);
    Logger.log('Approver Email: ' + approverEmail);

    if (!requestorEmail || requestorEmail.trim() === '') {
      Logger.log('Error: Requestor email is missing or empty');
      return createResponse(false, 'Requestor email is required');
    }

    // Create approval email
    const subject = `[ĐÃ PHÊ DUYỆT] Phiếu ${voucherType.toUpperCase()} - ${voucherNumber}`;
    
    const emailBodyHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #34A853; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">✅ Phiếu đã được phê duyệt</h2>
        </div>
        
        <div style="background-color: #fff; padding: 30px; border: 1px solid #ddd; border-top: none;">
          <p>Kính gửi <b>${employee}</b>,</p>
          
          <p>Phiếu <b>${voucherType}</b> số <b>${voucherNumber}</b> của bạn đã được <b style="color: #34A853;">phê duyệt</b>.</p>
          
          <div style="background-color: #d4edda; border-left: 4px solid #34A853; padding: 15px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #155724;">Thông tin phê duyệt:</h3>
            <ul style="margin: 0; padding-left: 20px; color: #155724;">
              <li><b>Trạng thái:</b> Đã phê duyệt</li>
              <li><b>Người phê duyệt:</b> ${approvedBy || approverEmail}</li>
              <li><b>Thời gian:</b> ${new Date().toLocaleString('vi-VN')}</li>
            </ul>
          </div>
          
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Thông tin phiếu:</h3>
            <ul style="margin: 0; padding-left: 20px;">
              <li><b>Số phiếu:</b> ${voucherNumber}</li>
              <li><b>Loại phiếu:</b> ${voucherType}</li>
              <li><b>Công ty:</b> ${company}</li>
              <li><b>Người đề nghị:</b> ${employee}</li>
              <li><b>Tổng số tiền:</b> ${amount}</li>
            </ul>
          </div>
          
          <p style="margin-top: 30px;">Trân trọng,<br>Hệ thống Kế toán Tự động</p>
        </div>
        
        <div style="background-color: #f8f9fa; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; color: #666; font-size: 12px;">
          <p style="margin: 0;">Email này được gửi tự động từ hệ thống. Vui lòng không reply email này.</p>
        </div>
      </div>
    `;

    // Send email to requestor
    try {
      Logger.log('Attempting to send email to: ' + requestorEmail);
      
      const emailOptions = {
        htmlBody: emailBodyHtml
      };
      
      if (approverEmail && approverEmail.trim() !== '') {
        emailOptions.cc = approverEmail;
        Logger.log('CC to: ' + approverEmail);
      }
      
      GmailApp.sendEmail(requestorEmail, subject, '', emailOptions);
      
      Logger.log('✅ Approval email sent successfully to: ' + requestorEmail);
      return createResponse(true, 'Voucher approved and notification email sent to ' + requestorEmail);
    } catch (emailError) {
      Logger.log('❌ Error sending email: ' + emailError.toString());
      Logger.log('Error details: ' + JSON.stringify(emailError));
      return createResponse(false, 'Error sending email: ' + emailError.message);
    }
    
  } catch (error) {
    Logger.log('Error approving voucher: ' + error.toString());
    return createResponse(false, 'Error approving voucher: ' + error.message);
  }
}

/**
 * Xử lý trả lại/từ chối phiếu
 */
function handleRejectVoucher(requestBody) {
  try {
    const voucher = requestBody.voucher;
    const voucherNumber = voucher.voucherNumber;
    const voucherType = voucher.voucherType;
    const company = voucher.company;
    const employee = voucher.employee;
    const amount = voucher.amount;
    const requestorEmail = voucher.requestorEmail;
    const approverEmail = voucher.approverEmail;
    const rejectReason = voucher.rejectReason;
    const rejectedBy = voucher.rejectedBy;

    if (!requestorEmail) {
      return createResponse(false, 'Requestor email is required');
    }

    if (!rejectReason) {
      return createResponse(false, 'Reject reason is required');
    }

    // Create rejection email
    const subject = `[TRẢ LẠI] Phiếu ${voucherType.toUpperCase()} - ${voucherNumber}`;
    
    const emailBodyHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #EA4335; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">❌ Phiếu đã bị trả lại</h2>
        </div>
        
        <div style="background-color: #fff; padding: 30px; border: 1px solid #ddd; border-top: none;">
          <p>Kính gửi <b>${employee}</b>,</p>
          
          <p>Phiếu <b>${voucherType}</b> số <b>${voucherNumber}</b> của bạn đã bị <b style="color: #EA4335;">trả lại</b> và cần được chỉnh sửa.</p>
          
          <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #856404;">Lý do trả lại:</h3>
            <p style="margin-bottom: 0; color: #856404; white-space: pre-wrap;">${rejectReason}</p>
          </div>
          
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Thông tin phiếu:</h3>
            <ul style="margin: 0; padding-left: 20px;">
              <li><b>Số phiếu:</b> ${voucherNumber}</li>
              <li><b>Loại phiếu:</b> ${voucherType}</li>
              <li><b>Công ty:</b> ${company}</li>
              <li><b>Người đề nghị:</b> ${employee}</li>
              <li><b>Tổng số tiền:</b> ${amount}</li>
              <li><b>Người trả lại:</b> ${rejectedBy || approverEmail}</li>
              <li><b>Thời gian:</b> ${new Date().toLocaleString('vi-VN')}</li>
            </ul>
          </div>
          
          <p><b>Vui lòng:</b></p>
          <ol>
            <li>Xem lại lý do trả lại ở trên</li>
            <li>Chỉnh sửa phiếu theo yêu cầu</li>
            <li>Gửi lại yêu cầu phê duyệt sau khi đã sửa</li>
          </ol>
          
          <p style="margin-top: 30px;">Trân trọng,<br>Hệ thống Kế toán Tự động</p>
        </div>
        
        <div style="background-color: #f8f9fa; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; color: #666; font-size: 12px;">
          <p style="margin: 0;">Email này được gửi tự động từ hệ thống. Vui lòng không reply email này.</p>
        </div>
      </div>
    `;

    // Send email to requestor
    GmailApp.sendEmail(requestorEmail, subject, '', {
      htmlBody: emailBodyHtml,
      cc: approverEmail || ''
    });

    Logger.log('Rejection email sent successfully to: ' + requestorEmail);
    return createResponse(true, 'Voucher rejected and notification email sent');
    
  } catch (error) {
    Logger.log('Error rejecting voucher: ' + error.toString());
    return createResponse(false, 'Error rejecting voucher: ' + error.message);
  }
}

// ============================================================================
// GOOGLE SHEETS SYNC FUNCTIONS
// ============================================================================

/**
 * Xử lý đồng bộ dữ liệu vào Google Sheets
 */
function handleSyncToSheets(requestBody) {
  try {
    const spreadsheetId = requestBody.spreadsheetId;
    const sheetName = requestBody.sheetName || 'Phiếu Thu Chi';
    const data = requestBody.data;

    if (!spreadsheetId) {
      return createResponse(false, 'Spreadsheet ID is required');
    }

    if (!data) {
      return createResponse(false, 'Data is required');
    }

    // Mở spreadsheet
    let spreadsheet;
    try {
      spreadsheet = safeOpenSpreadsheet(spreadsheetId, 'syncToGoogleSheets');
    } catch (error) {
      return createResponse(false, 'Không thể truy cập spreadsheet: ' + error.message);
    }

    // Lấy hoặc tạo sheet
    let sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) {
      sheet = spreadsheet.insertSheet(sheetName);
      // Tạo header row
      createHeaderRow(sheet);
    }

    // Ghi dữ liệu vào sheet
    writeVoucherData(sheet, data);

    Logger.log('Data synced successfully to sheet: ' + sheetName);
    return createResponse(true, 'Data synced successfully');
  } catch (error) {
    Logger.log('Error syncing to sheets: ' + error.toString());
    return createResponse(false, 'Error syncing to sheets: ' + error.message);
  }
}

/**
 * Tạo header row cho sheet
 */
function createHeaderRow(sheet) {
  const headers = [
    'Thời gian',
    'Số phiếu',
    'Loại phiếu',
    'Ngày lập',
    'Công ty',
    'Người đề nghị',
    'Bộ phận',
    'Người nộp/nhận',
    'Loại tiền',
    'Tổng số tiền',
    'Số tiền bằng chữ',
    'Lý do',
    'Người phê duyệt',
    'Trạng thái',
    'Số dòng chi tiết',
    'Chi tiết (JSON)',
    'Lịch sử phê duyệt (JSON)'
  ];

  // Format header row
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers]);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#4285F4');
  headerRange.setFontColor('#FFFFFF');
  headerRange.setHorizontalAlignment('center');
  
  // Freeze header row
  sheet.setFrozenRows(1);
  
  // Auto-resize columns
  for (let i = 1; i <= headers.length; i++) {
    sheet.autoResizeColumn(i);
  }
}

/**
 * Ghi dữ liệu phiếu vào sheet
 */
function writeVoucherData(sheet, data) {
  const row = [
    data.timestamp || new Date().toISOString(),
    data.voucherNumber || '',
    data.voucherType || '',
    data.voucherDate || '',
    data.company || '',
    data.employee || '',
    data.department || '',
    data.payeeName || '',
    data.currency || '',
    data.totalAmount || '',
    data.amountInWords || '',
    data.reason || '',
    data.approver || '',
    data.status || '',
    data.expenseItems ? data.expenseItems.length : 0,
    JSON.stringify(data.expenseItems || []),
    JSON.stringify(data.approvalHistory || [])
  ];

  // Thêm dòng mới
  const lastRow = sheet.getLastRow();
  const newRow = lastRow + 1;
  
  // Ghi dữ liệu
  sheet.getRange(newRow, 1, 1, row.length).setValues([row]);
  
  // Format số tiền
  const amountColumn = 10; // Cột tổng số tiền
  const amountCell = sheet.getRange(newRow, amountColumn);
  amountCell.setNumberFormat('#,##0');
  
  // Format ngày
  const dateColumn = 4; // Cột ngày lập
  const dateCell = sheet.getRange(newRow, dateColumn);
  if (data.voucherDate) {
    dateCell.setNumberFormat('dd/mm/yyyy');
  }
  
  // Auto-resize columns
  sheet.autoResizeColumns(1, row.length);
  
  // Thêm conditional formatting cho trạng thái
  formatStatusColumn(sheet, newRow);
  
  // Tạo sheet chi tiết nếu có expense items
  if (data.expenseItems && data.expenseItems.length > 0) {
    createDetailSheet(spreadsheet, data.voucherNumber, data.expenseItems);
  }
}

/**
 * Format cột trạng thái với màu sắc
 */
function formatStatusColumn(sheet, row) {
  const statusColumn = 14; // Cột trạng thái
  const statusCell = sheet.getRange(row, statusColumn);
  const status = statusCell.getValue().toString().toLowerCase();
  
  if (status.includes('đã phê duyệt') || status.includes('approved')) {
    statusCell.setBackground('#e8f5e9');
    statusCell.setFontColor('#4caf50');
  } else if (status.includes('từ chối') || status.includes('rejected')) {
    statusCell.setBackground('#ffebee');
    statusCell.setFontColor('#f44336');
  } else {
    statusCell.setBackground('#fff8e1');
    statusCell.setFontColor('#ff9800');
  }
  
  statusCell.setFontWeight('bold');
  statusCell.setHorizontalAlignment('center');
}

/**
 * Tạo sheet chi tiết cho từng phiếu
 */
function createDetailSheet(spreadsheet, voucherNumber, expenseItems) {
  const detailSheetName = 'Chi tiết ' + voucherNumber;
  
  // Xóa sheet cũ nếu tồn tại
  const existingSheet = spreadsheet.getSheetByName(detailSheetName);
  if (existingSheet) {
    spreadsheet.deleteSheet(existingSheet);
  }
  
  // Tạo sheet mới
  const detailSheet = spreadsheet.insertSheet(detailSheetName);
  
  // Header
  const headers = ['STT', 'Nội dung', 'Số tiền', 'Số file đính kèm'];
  detailSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  detailSheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  detailSheet.getRange(1, 1, 1, headers.length).setBackground('#4285F4');
  detailSheet.getRange(1, 1, 1, headers.length).setFontColor('#FFFFFF');
  
  // Dữ liệu
  const dataRows = expenseItems.map((item, index) => [
    index + 1,
    item.content || '',
    item.amount || 0,
    item.attachments || 0
  ]);
  
  if (dataRows.length > 0) {
    detailSheet.getRange(2, 1, dataRows.length, headers.length).setValues(dataRows);
    
    // Format số tiền
    detailSheet.getRange(2, 3, dataRows.length, 1).setNumberFormat('#,##0');
    
    // Tổng cộng
    const totalRow = dataRows.length + 2;
    detailSheet.getRange(totalRow, 2, 1, 1).setValue('TỔNG CỘNG');
    detailSheet.getRange(totalRow, 2, 1, 1).setFontWeight('bold');
    detailSheet.getRange(totalRow, 3, 1, 1).setFormula('=SUM(C2:C' + (totalRow - 1) + ')');
    detailSheet.getRange(totalRow, 3, 1, 1).setFontWeight('bold');
    detailSheet.getRange(totalRow, 3, 1, 1).setNumberFormat('#,##0');
  }
  
  // Auto-resize columns
  detailSheet.autoResizeColumns(1, headers.length);
  
  // Freeze header
  detailSheet.setFrozenRows(1);
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Tạo response JSON với CORS headers
 */
function createResponse(success, message, data) {
  const response = {
    success: success,
    message: message
  };
  
  if (data) {
    response.data = data;
  }
  
  const output = ContentService.createTextOutput(JSON.stringify(response));
  output.setMimeType(ContentService.MimeType.JSON);
  
  // Note: Google Apps Script automatically handles CORS for Web Apps
  // But we can't set custom headers directly
  
  return output;
}

// ============================================================================
// TEST FUNCTIONS
// ============================================================================

/**
 * Test function - để test hash password
 */
function testHashPassword() {
  const password = 'test123';
  const hash = hashPassword(password);
  Logger.log('Password: ' + password);
  Logger.log('Hash: ' + hash);
  return hash;
}

/**
 * Handle getMasterData action
 * Fetches data from Nhân viên, Khách hàng, Nhà cung cấp sheets
 */
function handleGetMasterData(requestBody) {
  try {
    Logger.log('=== handleGetMasterData called ===');

    const ss = safeOpenSpreadsheet(USERS_SHEET_ID, 'handleGetMasterData');
    
    // Fetch Nhân viên (Employees)
    const employeesSheet = ss.getSheetByName('Nhân viên');
    let employeesData = [];
    if (employeesSheet) {
      const employeesValues = employeesSheet.getDataRange().getValues();
      const employeesHeaders = employeesValues[0];
      employeesData = employeesValues.slice(1).map(row => {
        const obj = {};
        employeesHeaders.forEach((header, index) => {
          obj[header] = row[index];
        });
        return obj;
      });
      Logger.log('Nhân viên records: ' + employeesData.length);
    } else {
      Logger.log('⚠️ Sheet "Nhân viên" not found');
    }
    
    // Fetch Khách hàng (Customers)
    const customersSheet = ss.getSheetByName('Khách hàng');
    let customersData = [];
    if (customersSheet) {
      const customersValues = customersSheet.getDataRange().getValues();
      const customersHeaders = customersValues[0];
      customersData = customersValues.slice(1).map(row => {
        const obj = {};
        customersHeaders.forEach((header, index) => {
          obj[header] = row[index];
        });
        return obj;
      });
      Logger.log('Khách hàng records: ' + customersData.length);
    } else {
      Logger.log('⚠️ Sheet "Khách hàng" not found');
    }
    
    // Fetch Nhà cung cấp (Suppliers)
    const suppliersSheet = ss.getSheetByName('Nhà cung cấp');
    let suppliersData = [];
    if (suppliersSheet) {
      const suppliersValues = suppliersSheet.getDataRange().getValues();
      const suppliersHeaders = suppliersValues[0];
      suppliersData = suppliersValues.slice(1).map(row => {
        const obj = {};
        suppliersHeaders.forEach((header, index) => {
          obj[header] = row[index];
        });
        return obj;
      });
      Logger.log('Nhà cung cấp records: ' + suppliersData.length);
    } else {
      Logger.log('⚠️ Sheet "Nhà cung cấp" not found');
    }
    
    const masterData = {
      employees: employeesData,
      customers: customersData,
      suppliers: suppliersData,
      timestamp: new Date().toISOString()
    };
    
    Logger.log('✅ Master data fetched successfully');
    return createResponse(true, 'Master data fetched successfully', masterData);
  } catch (error) {
    Logger.log('❌ Error in handleGetMasterData: ' + error.toString());
    Logger.log('Stack: ' + error.stack);
    return createResponse(false, 'Error fetching master data: ' + error.message);
  }
}

/**
 * Test function - để test authentication
 */
function testAuthentication() {
  const email = 'anh.le@mediainsider.vn'; // Thay bằng email trong sheet
  const password = 'yourpassword'; // Thay bằng password
  const result = authenticateUser(email, password);
  Logger.log('Result: ' + JSON.stringify(result, null, 2));
  return result;
}

/**
 * Test function - để test login handler
 */
function testLoginHandler() {
  const requestBody = {
    action: 'login',
    email: 'anh.le@mediainsider.vn', // Thay bằng email trong sheet
    password: 'yourpassword' // Thay bằng password
  };

  const result = handleLogin(requestBody);
  Logger.log('Result: ' + JSON.stringify(result, null, 2));
  return result;
}

/**
 * Test spreadsheet access - RUN THIS FIRST to authorize the script
 * Chạy function này trước tiên để cấp quyền cho script
 */
function testSpreadsheetAccess() {
  try {
    Logger.log('=== TESTING SPREADSHEET ACCESS ===');
    Logger.log('USERS_SHEET_ID: ' + USERS_SHEET_ID);
    Logger.log('USERS_SHEET_NAME: ' + USERS_SHEET_NAME);

    // Test opening spreadsheet
    Logger.log('Attempting to open spreadsheet...');
    const ss = safeOpenSpreadsheet(USERS_SHEET_ID, 'testSpreadsheetAccess');
    Logger.log('✅ Spreadsheet opened successfully!');
    Logger.log('Spreadsheet name: ' + ss.getName());

    // Test getting sheet
    Logger.log('Attempting to get sheet: ' + USERS_SHEET_NAME);
    let sheet;
    try {
      sheet = safeGetSheet(ss, USERS_SHEET_NAME, 'testSpreadsheetAccess');
    } catch (e) {
      Logger.log('Sheet "' + USERS_SHEET_NAME + '" not found, using first sheet');
      sheet = ss.getSheets()[0];
    }
    Logger.log('✅ Sheet accessed successfully!');
    Logger.log('Sheet name: ' + sheet.getName());

    // Test reading data
    const data = sheet.getDataRange().getValues();
    Logger.log('✅ Data read successfully!');
    Logger.log('Total rows: ' + data.length);
    Logger.log('Total columns: ' + (data[0] ? data[0].length : 0));
    if (data.length > 0) {
      Logger.log('Headers: ' + JSON.stringify(data[0]));
    }

    Logger.log('\n========================================');
    Logger.log('✅✅✅ ALL TESTS PASSED! ✅✅✅');
    Logger.log('========================================');
    Logger.log('Script has been authorized successfully!');
    Logger.log('You can now deploy this as a web app.');
    Logger.log('\nNext steps:');
    Logger.log('1. Click Deploy > New deployment (or Manage deployments)');
    Logger.log('2. Set "Execute as: Me"');
    Logger.log('3. Set "Who has access: Anyone"');
    Logger.log('4. Click Deploy');
    Logger.log('5. Copy the Web App URL to your index.html');

    return {
      success: true,
      message: 'Spreadsheet access test passed!',
      spreadsheetName: ss.getName(),
      sheetName: sheet.getName(),
      rowCount: data.length
    };

  } catch (error) {
    Logger.log('\n========================================');
    Logger.log('❌❌❌ TEST FAILED ❌❌❌');
    Logger.log('========================================');
    Logger.log('Error: ' + error.message);
    Logger.log('Stack: ' + error.stack);
    Logger.log('\nTroubleshooting:');
    Logger.log('1. Make sure you authorized the script when prompted');
    Logger.log('2. Check that spreadsheet ID is correct: ' + USERS_SHEET_ID);
    Logger.log('3. Verify spreadsheet exists: https://docs.google.com/spreadsheets/d/' + USERS_SHEET_ID + '/edit');
    Logger.log('4. Ensure your account has access to the spreadsheet');

    return {
      success: false,
      message: error.message
    };
  }
}

