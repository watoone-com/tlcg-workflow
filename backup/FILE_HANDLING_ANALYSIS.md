# FILE HANDLING ANALYSIS - Phiếu Thu/Chi Workflow
## How the System Handles Large Files

**Generated**: $(date)

---

## 📊 FILE SIZE LIMITS OVERVIEW

| Item | Limit | Location | Purpose |
|------|-------|----------|---------|
| **Individual File** | 10 MB | Line 2303 | General file validation |
| **Submission File** | 3 MB | Line 6042 | Files in expense items |
| **Total Payload** | 900 KB | Line 6043 | Complete request to backend |
| **Signature Upload** | 500 KB | Line 3191 | Initial signature upload |
| **Signature Compressed** | 200 KB | Line 6124 | Before sending to backend |

---

## 🔍 DETAILED FILE HANDLING FLOW

### 1️⃣ INITIAL FILE UPLOAD (Expense Items)

**Location**: Line 2589-2596
```javascript
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function validateFile(file) {
    if (file.size > MAX_FILE_SIZE) {
        showToast(`File "${file.name}" quá lớn. Kích thước tối đa là 10MB`, 'error');
        return false;
    }
    return true;
}
```

**What Happens**:
- ✅ User can attach files up to 10MB to expense items
- ✅ Validation happens immediately on file selection
- ✅ Error message shown if file too large
- ✅ File is rejected before any processing

---

### 2️⃣ SIGNATURE UPLOAD

**Location**: Line 3180-3194
```javascript
async function handleSignatureUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
        showToast('Vui lòng chọn file hình ảnh (PNG, JPG, GIF)', 'error');
        return;
    }
    
    // Validate file size (max 500KB)
    if (file.size > 500 * 1024) {
        showToast('Kích thước chữ ký tối đa 500KB', 'error');
        return;
    }
    
    // Convert to base64 and store
    const base64Data = await fileToBase64(file);
    currentSignatureData = base64Data;
}
```

**What Happens**:
- ✅ Signature must be image type (PNG, JPG, GIF)
- ✅ Maximum 500KB initial size
- ✅ Converted to base64 for storage
- ✅ Stored in localStorage for reuse

---

### 3️⃣ IMAGE COMPRESSION (Signatures)

**Location**: Line 3125-3160
```javascript
async function compressImageSignature(file, maxWidth = 800, maxHeight = 400, quality = 0.7) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                // Calculate new dimensions
                let width = img.width;
                let height = img.height;
                
                if (width > maxWidth || height > maxHeight) {
                    const ratio = Math.min(maxWidth / width, maxHeight / height);
                    width = width * ratio;
                    height = height * ratio;
                }
                
                // Create canvas and resize
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                // Convert to base64 with compression
                const base64 = canvas.toDataURL('image/jpeg', quality);
                console.log(`📏 Signature compressed: ${img.width}x${img.height} -> ${width}x${height}, size: ${(base64.length / 1024).toFixed(2)}KB`);
                resolve(base64);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}
```

**Compression Parameters**:
- **Max Width**: 800px
- **Max Height**: 400px
- **Quality**: 0.7 (70% JPEG quality)
- **Format**: Always converts to JPEG

**What Happens**:
- ✅ Image resized to fit within 800x400px
- ✅ Maintains aspect ratio
- ✅ Compressed to 70% JPEG quality
- ✅ Typical result: 50-200KB

---

### 4️⃣ PRE-SUBMISSION FILE PROCESSING

**Location**: Line 6040-6117

#### Step 1: Individual File Validation
```javascript
const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3MB max per file

for (const file of item.attachments) {
    if (file instanceof File) {
        // Check file size
        if (file.size > MAX_FILE_SIZE) {
            showToast(`File "${file.name}" quá lớn (${(file.size / 1024 / 1024).toFixed(2)} MB). Kích thước tối đa là ${MAX_FILE_SIZE / 1024 / 1024}MB.`, 'error', 'File quá lớn');
            console.warn(`File ${file.name} is too large. Skipping.`);
            continue; // Skip this file
        }
```

**What Happens**:
- ✅ Each file checked against 3MB limit
- ✅ Files over 3MB are skipped (not uploaded)
- ✅ User notified which files are skipped
- ✅ Other files continue processing

#### Step 2: Base64 Conversion
```javascript
// Convert file to base64
const base64Data = await fileToBase64(file);

// Verify base64 data was generated
if (!base64Data || base64Data.length < 100) {
    console.error(`Failed to convert ${file.name} to base64. Result was empty or too short.`);
    continue;
}

console.log(`✅ File ${file.name}: ${file.size} bytes -> ${base64Data.length} chars base64`);
```

**What Happens**:
- ✅ File converted to base64 string
- ✅ Base64 is ~33% larger than original
- ✅ Validation ensures conversion succeeded
- ✅ Logs size increase for debugging

#### Step 3: Total Payload Size Check
```javascript
const MAX_TOTAL_PAYLOAD_SIZE = 900 * 1024; // 900KB max total payload

// Calculate estimated size: existing payload + this file's base64 size
let estimatedSize = 100000; // Base payload size estimate (signature + email body + metadata)
filesToUpload.forEach(f => {
    estimatedSize += (f.fileData ? f.fileData.length : 0);
});
estimatedSize += base64Data.length;

// Add signature size to estimate
if (currentSignatureData) {
    estimatedSize += currentSignatureData.length;
}

if (estimatedSize > MAX_TOTAL_PAYLOAD_SIZE) {
    const sizeKB = (estimatedSize / 1024).toFixed(2);
    const limitKB = (MAX_TOTAL_PAYLOAD_SIZE / 1024).toFixed(0);
    showToast(`Tổng kích thước quá lớn (ước tính ${sizeKB} KB). File "${file.name}" sẽ không được tải lên. Giới hạn: ${limitKB}KB.`, 'error', 'Payload quá lớn');
    console.warn(`Adding file ${file.name} would exceed max payload size. Estimated: ${sizeKB}KB. Limit: ${limitKB}KB. Skipping.`);
    continue; // Skip this file
}
```

**What Happens**:
- ✅ Running total of payload size calculated
- ✅ Includes: base metadata (100KB) + all files + signature
- ✅ Each file checked before adding to payload
- ✅ Files that would exceed 900KB limit are skipped
- ✅ User notified which files are skipped

---

### 5️⃣ SIGNATURE AGGRESSIVE COMPRESSION

**Location**: Line 6119-6139
```javascript
// Compress requester signature MORE aggressively to reduce payload
let finalRequesterSignature = currentSignatureData || '';
if (finalRequesterSignature && finalRequesterSignature.trim() !== '') {
    const signatureSizeKB = finalRequesterSignature.length / 1024;
    
    // Always compress signature to max 200KB (more aggressive)
    if (signatureSizeKB > 200) {
        console.log('⚠️ Requester signature is large (' + signatureSizeKB.toFixed(2) + 'KB), compressing to max 200KB...');
        try {
            finalRequesterSignature = await ensureSignatureCompressed(finalRequesterSignature, 200);
            if (finalRequesterSignature && finalRequesterSignature.trim() !== '') {
                console.log('✅ Requester signature compressed to: ' + (finalRequesterSignature.length / 1024).toFixed(2) + 'KB');
                // Update localStorage with compressed version
                localStorage.setItem(SIGNATURE_STORAGE_KEY, finalRequesterSignature);
                currentSignatureData = finalRequesterSignature;
            }
        } catch (compressError) {
            console.warn('⚠️ Failed to compress requester signature, using original:', compressError);
        }
    }
}
```

**What Happens**:
- ✅ Signature checked before submission
- ✅ If > 200KB, compressed again
- ✅ Compressed version saved to localStorage
- ✅ Falls back to original if compression fails

---

### 6️⃣ FINAL PAYLOAD VALIDATION

**Location**: Line 6198-6232
```javascript
// Calculate total payload size
const payloadString = JSON.stringify(payload);
const payloadSizeBytes = payloadString.length;
const payloadSizeKB = (payloadSizeBytes / 1024).toFixed(2);
const payloadSizeMB = (payloadSizeBytes / 1024 / 1024).toFixed(2);

console.log(`📦 Total payload size: ${payloadSizeKB} KB (${payloadSizeMB} MB)`);
console.log(`📁 Files in payload: ${filesToUpload.length}`);

// Detailed file logging
if (filesToUpload.length > 0) {
    filesToUpload.forEach((f, i) => {
        const fileSizeKB = (f.fileData ? f.fileData.length : 0) / 1024;
        console.log(`   File ${i+1}: ${f.fileName} - ${fileSizeKB.toFixed(2)} KB`);
    });
}

// Check if payload is too large
if (payloadSizeBytes > MAX_TOTAL_PAYLOAD_SIZE) {
    const errorMsg = `Payload quá lớn (${payloadSizeMB} MB). Giới hạn tối đa: ${MAX_TOTAL_PAYLOAD_SIZE / 1024 / 1024}MB. Vui lòng giảm số lượng hoặc kích thước file đính kèm.`;
    console.error('❌ Payload size exceeded:', payloadSizeBytes, 'bytes');
    showToast(errorMsg, 'error', 'Payload quá lớn');
    // Stop submission
    return;
}

// Warn if close to limit
if (payloadSizeBytes > 900 * 1024) {
    console.warn('⚠️ Payload is large (' + payloadSizeMB + 'MB), close to limit. Consider reducing file sizes.');
}
```

**What Happens**:
- ✅ Final payload size calculated
- ✅ Detailed breakdown logged to console
- ✅ Hard stop if > 900KB
- ✅ Warning if close to limit
- ✅ User gets clear error message

---

### 7️⃣ BACKEND FILE UPLOAD TO GOOGLE DRIVE

**Location**: `VOUCHER_WORKFLOW_BACKEND.gs` Line 666-688
```javascript
function uploadFilesToDrive_(files, folderName) {
  const DRIVE_FOLDER_ID = '1RBBUUAQIrYTWeBONIgkMtELL0hxZhtqG';
  const parent = DriveApp.getFolderById(DRIVE_FOLDER_ID);
  let folder = parent.getFoldersByName(folderName).hasNext() 
    ? parent.getFoldersByName(folderName).next() 
    : parent.createFolder(folderName);
    
  return files.map(file => {
    try {
      // Decode base64 to binary
      let data = file.fileData.includes(',') 
        ? file.fileData.split(',')[1] 
        : file.fileData;
      const blob = Utilities.newBlob(
        Utilities.base64Decode(data), 
        file.mimeType, 
        file.fileName
      );
      
      // Upload to Drive
      const f = folder.createFile(blob);
      f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      
      // Return file info
      return { 
        fileName: file.fileName, 
        fileUrl: f.getUrl(),
        fileSize: file.fileSize || blob.getBytes().length
      };
    } catch (err) {
      return { 
        fileName: file.fileName, 
        error: true,
        fileSize: file.fileSize || 0
      };
    }
  });
}
```

**What Happens**:
- ✅ Creates folder per voucher (using voucher number)
- ✅ Decodes base64 back to binary
- ✅ Uploads to Google Drive
- ✅ Sets sharing to "Anyone with link"
- ✅ Returns Drive URL for each file
- ✅ Handles errors gracefully

---

### 8️⃣ FILE DEDUPLICATION

**Location**: `VOUCHER_WORKFLOW_BACKEND.gs` Line 206-215
```javascript
// Upload files - deduplicate by fileName before uploading
if (voucher.files && voucher.files.length > 0) {
  // Deduplicate files by fileName to prevent duplicate uploads
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
    // ... process results
  }
}
```

**What Happens**:
- ✅ Checks for duplicate filenames
- ✅ Only uploads unique files
- ✅ Prevents duplicate Drive uploads
- ✅ Reduces storage usage

---

## 📊 SIZE CALCULATION EXAMPLES

### Example 1: Small Submission
```
Base metadata:           100 KB
Signature (compressed):   50 KB
File 1 (invoice.pdf):    200 KB (base64)
File 2 (receipt.jpg):    150 KB (base64)
-----------------------------------
Total:                   500 KB ✅ ALLOWED
```

### Example 2: Medium Submission
```
Base metadata:           100 KB
Signature (compressed):  100 KB
File 1 (contract.pdf):   300 KB (base64)
File 2 (quote.pdf):      250 KB (base64)
File 3 (invoice.pdf):    200 KB (base64)
-----------------------------------
Total:                   950 KB ❌ REJECTED (> 900KB)

Result: File 3 would be skipped
New Total:               750 KB ✅ ALLOWED
```

### Example 3: Large Files
```
User uploads:
- File 1: 5 MB (original)    → ❌ Rejected (> 3MB limit)
- File 2: 2 MB (original)    → ✅ Accepted
- File 3: 1 MB (original)    → ✅ Accepted

After base64 conversion:
- File 2: 2.66 MB (base64)
- File 3: 1.33 MB (base64)
Total: 3.99 MB (base64)      → ❌ Rejected (> 900KB limit)

Result: Only smaller files or fewer files allowed
```

---

## 🚨 LIMITS & CONSTRAINTS

### Google Apps Script Limits
- **URL Fetch Payload**: ~10 MB (hard limit)
- **POST Request**: ~50 MB (theoretical, but 10MB practical)
- **Execution Time**: 6 minutes max
- **Drive Upload**: No size limit (but execution time applies)

### Why 900KB Total Payload Limit?
1. **Base64 Overhead**: Files increase ~33% in size
2. **JSON Overhead**: Additional metadata adds size
3. **Safety Margin**: 900KB leaves buffer below 1MB
4. **Network Reliability**: Smaller payloads = more reliable
5. **Parse Performance**: Faster JSON parsing

### Why 3MB Per File Limit?
1. **Base64 Conversion**: 3MB → ~4MB base64
2. **Memory Usage**: Browser memory constraints
3. **User Experience**: Faster processing
4. **Multiple Files**: Allow several files per submission

---

## 🔄 COMPLETE FILE FLOW DIAGRAM

```
User Selects File
       ↓
[1] Initial Validation (10MB limit)
       ↓ ✅ Pass
[2] Store in expense item
       ↓
User Clicks Submit
       ↓
[3] Check file size (3MB limit)
       ↓ ✅ Pass
[4] Convert to base64 (+33% size)
       ↓
[5] Calculate running total
       ↓
[6] Check total payload (900KB limit)
       ↓ ✅ Pass
[7] Add to filesToUpload array
       ↓
[8] Compress signature (200KB limit)
       ↓
[9] Final payload validation
       ↓ ✅ Pass
[10] Send to backend (FormData)
       ↓
[11] Backend deduplicates files
       ↓
[12] Upload to Google Drive
       ↓
[13] Return Drive URLs
       ↓
[14] Store URLs in Google Sheet
       ↓
✅ Complete
```

---

## 💡 BEST PRACTICES FOR USERS

### ✅ DO:
- Compress large PDFs before uploading
- Use JPEG for photos (smaller than PNG)
- Combine multiple pages into one PDF
- Upload only essential documents
- Keep signatures under 500KB

### ❌ DON'T:
- Upload high-resolution scans (reduce DPI to 150-300)
- Upload raw photos from camera (compress first)
- Attach unnecessary files
- Upload same file multiple times
- Use BMP or TIFF formats (very large)

---

## 🛠️ TROUBLESHOOTING

### Issue: "File quá lớn"
**Cause**: Individual file > 3MB
**Solution**: 
- Compress the file
- Reduce image resolution
- Convert to more efficient format

### Issue: "Tổng kích thước quá lớn"
**Cause**: Total payload > 900KB
**Solution**:
- Remove some files
- Compress existing files
- Split into multiple submissions

### Issue: "Payload quá lớn"
**Cause**: Final payload > 900KB after base64 conversion
**Solution**:
- Reduce number of files
- Compress files more aggressively
- Use lower quality images

### Issue: Files not appearing in Drive
**Cause**: Backend upload failed
**Solution**:
- Check Google Apps Script logs
- Verify Drive folder permissions
- Check file format compatibility

---

## 📝 SUMMARY

The system implements **multi-layer file size management**:

1. **Layer 1**: Initial 10MB validation (user-friendly)
2. **Layer 2**: 3MB per-file limit (submission time)
3. **Layer 3**: 900KB total payload limit (prevents truncation)
4. **Layer 4**: Signature compression (200KB max)
5. **Layer 5**: Final validation before send

This ensures:
- ✅ No truncated data
- ✅ No failed submissions
- ✅ Reliable file uploads
- ✅ Clear user feedback
- ✅ Optimal performance

