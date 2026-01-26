# handleLogin Function Analysis

## Function Overview

The `handleLogin` function is called from `doPost()` when `action === 'login'`. It processes login requests and authenticates users.

## Code Flow

```
doPost(e)
  ↓
Parse request body (e.postData or e.parameter)
  ↓
Extract action
  ↓
If action === 'login' → handleLogin(requestBody)
  ↓
handleLogin(requestBody)
  ↓
  Extract email & password
  ↓
  Validate email & password
  ↓
  authenticateUser(email, password)
    ↓
    safeOpenSpreadsheet(USERS_SHEET_ID)
      ↓
      SpreadsheetApp.openById() ← ERROR OCCURS HERE
```

## Current Implementation

### handleLogin Function (lines 806-860)

```javascript
function handleLogin(requestBody) {
  try {
    // Logging and validation
    const email = requestBody.email;
    const password = requestBody.password;
    
    // Validate inputs
    if (!email || email.trim() === '') {
      return createResponse(false, 'Email is required');
    }
    
    if (!password || password.trim() === '') {
      return createResponse(false, 'Password is required');
    }
    
    // Authenticate
    const authResult = authenticateUser(email, password);
    
    if (authResult.success) {
      return createResponse(true, 'Login successful', authResult.user);
    } else {
      return createResponse(false, authResult.message || 'Invalid credentials');
    }
  } catch (error) {
    // Error handling
    return createResponse(false, 'Login error: ' + error.message);
  }
}
```

## Potential Issues Found

### 1. ✅ Request Body Parsing (doPost)
- **Status**: Looks correct
- **Location**: Lines 250-324
- **Flow**: 
  - Tries `e.postData.contents` (JSON)
  - Falls back to `e.parameter` (FormData/URL-encoded)
  - Handles both formats correctly

### 2. ✅ Input Validation
- **Status**: Good
- **Checks**: Email and password are validated before use
- **Error messages**: Clear and user-friendly

### 3. ⚠️ Error Propagation
- **Status**: Could be improved
- **Issue**: If `authenticateUser` throws an error (not returns error object), it's caught but the error message might not be preserved correctly
- **Current**: Catches error and returns generic message

### 4. ✅ Error Message Handling
- **Status**: Good
- **Feature**: Preserves friendly error messages from `safeOpenSpreadsheet`
- **Location**: Lines 749-754 in `authenticateUser`

## Request Flow Analysis

### From Frontend (index.html)
```javascript
const formData = new FormData();
formData.append('action', 'login');
formData.append('email', email);
formData.append('password', password);

fetch('/api/voucher', {
  method: 'POST',
  body: formData
});
```

### Through Vercel Proxy (api/voucher.js)
- Receives FormData
- Parses it to object: `{ action: 'login', email: '...', password: '...' }`
- Converts to URL-encoded format
- Forwards to Google Apps Script

### In Google Apps Script (doPost)
- Receives URL-encoded data in `e.parameter`
- Parses to: `{ action: 'login', email: '...', password: '...' }`
- Routes to `handleLogin(requestBody)`

## Potential Issues

### Issue 1: Error Not Being Caught Properly
If `authenticateUser` throws an error (instead of returning `{ success: false }`), the catch block in `handleLogin` might not preserve the original error message correctly.

**Current code:**
```javascript
} catch (error) {
  Logger.log('Login handler error: ' + error.toString());
  Logger.log('Error stack: ' + error.stack);
  
  // Check if this is the openById authorization error
  if (error.message && (error.message.includes('Script chưa được cấp quyền') || 
      error.message.includes('openById') || error.message.includes('Unexpected error'))) {
    return createResponse(false, error.message);
  }
  
  return createResponse(false, 'Login error: ' + error.message);
}
```

**This looks correct** - it should preserve the friendly error message.

### Issue 2: Request Body Format
The request body might not be parsed correctly if it comes in an unexpected format.

**Verification needed:**
- Check execution logs to see what `requestBody` contains
- Verify `e.parameter` has the expected fields

### Issue 3: Silent Failures
If `authenticateUser` returns `{ success: false }` without a message, the error might not be clear.

**Current code handles this:**
```javascript
return createResponse(false, authResult.message || 'Invalid credentials');
```

## Recommendations

### 1. Add More Logging
Add logging to see exactly what's happening:

```javascript
function handleLogin(requestBody) {
  try {
    Logger.log('=== HANDLE LOGIN START ===');
    Logger.log('Request body received: ' + JSON.stringify(requestBody));
    
    // ... existing code ...
    
    Logger.log('About to call authenticateUser');
    const authResult = authenticateUser(email, password);
    Logger.log('authenticateUser returned: ' + JSON.stringify(authResult));
    
    // ... rest of code ...
  }
}
```

### 2. Verify Error Propagation
Ensure errors from `safeOpenSpreadsheet` are properly propagated:

- `safeOpenSpreadsheet` throws Error → caught by `authenticateUser` → returns `{ success: false, message: error.message }` → `handleLogin` returns it

This flow looks correct.

### 3. Test Direct Call
Test `handleLogin` directly with a test request body to see if it works:

```javascript
function testHandleLogin() {
  const testBody = {
    action: 'login',
    email: 'test@example.com',
    password: 'test'
  };
  const result = handleLogin(testBody);
  Logger.log('Result: ' + JSON.stringify(result));
  return result;
}
```

## Conclusion

The `handleLogin` function looks **correctly implemented**. The issue is likely:

1. **Not in handleLogin itself** - the function structure is sound
2. **In the execution context** - web app deployment might have different permissions
3. **In error propagation** - though the code looks correct, the error might be getting lost somewhere

## Next Steps

1. **Check execution logs** when login fails - see what `requestBody` contains
2. **Verify error messages** - ensure the openById error is being caught and returned
3. **Test handleLogin directly** - run `testHandleLogin()` to see if it works
4. **Compare execution contexts** - check if web app execution has different context than direct execution
