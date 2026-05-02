# Proof of Payment File Upload System

## Overview

The EduTrack system now supports secure file uploads for proof of payment verification. This system allows students to upload screenshots, receipts, or other documents as proof when making online payments (GCash, Bank Transfer, etc.).

## Database Support

The `payments` table includes a `proof_of_payment_url` field (varchar 500) that stores the relative path to uploaded files.

```sql
`proof_of_payment_url` varchar(500) DEFAULT NULL COMMENT 'Upload path for online payment screenshots/receipts'
```

## File Upload Features

### Supported File Types
- Images: JPG, JPEG, PNG
- Documents: PDF
- Maximum file size: 5MB per file

### Security Features
- File type validation
- File size limits
- Secure filename generation
- Directory traversal protection
- Organized folder structure (by year/month)

### File Organization
Files are stored in: `public/uploads/payments/YYYY/MM/`
- Example: `public/uploads/payments/2026/02/`

## API Endpoints

### 1. Create Payment with File Upload
```http
POST /api/payments
Content-Type: multipart/form-data

Form Data:
- student_id: (required)
- amount: (required)
- payment_for: (required)
- payment_method: (required)
- proof_of_payment: (file, optional)
- Other payment fields...
```

### 2. Upload Proof for Existing Payment
```http
POST /api/payments/{id}/upload-proof
Content-Type: multipart/form-data

Form Data:
- proof_of_payment: (file, required)
```

### 3. Delete Proof of Payment
```http
DELETE /api/payments/{id}/delete-proof
```

### 4. Get Proof File Information
```http
GET /api/payments/{id}/proof-info
```

Response:
```json
{
  "success": true,
  "data": {
    "file_name": "receipt_20260209123456_abc123.jpg",
    "file_size": 245760,
    "file_size_formatted": "240 KB",
    "mime_type": "image/jpeg",
    "extension": "jpg",
    "last_modified": "2026-02-09 12:34:56"
  }
}
```

## Frontend Integration

### File Upload Component
```javascript
// In PaymentProcess.tsx
const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  if (e.target.files && e.target.files[0]) {
    setProofOfPayment(e.target.files[0]);
  }
};

// Form submission with file
const formData = new FormData();
formData.append('student_id', user?.id);
formData.append('amount', tuitionFee.amount);
formData.append('proof_of_payment', proofOfPayment);

const response = await fetch('/api/payments', {
  method: 'POST',
  body: formData
});
```

## Helper Functions

### Core Functions (proof_of_payment_helper.php)

#### `upload_proof_of_payment($field_name, $config)`
Uploads a file and returns detailed result information.

#### `delete_proof_of_payment($file_path)`
Securely deletes a proof of payment file.

#### `get_proof_of_payment_info($file_path)`
Retrieves file metadata without downloading.

#### `validate_proof_of_payment_file($field_name)`
Pre-validates files before upload.

#### `format_file_size($bytes)`
Formats file sizes in human-readable format.

## File Security

### Upload Validation
- File extension checking
- MIME type validation for images
- File size limits (5MB)
- Directory traversal prevention

### Storage Security
- Files stored outside web root accessible directory
- Unique filename generation
- Organized directory structure
- No execution permissions on upload directories

## Error Handling

### Common Error Responses
```json
{
  "success": false,
  "message": "Invalid file type. Allowed: jpg, jpeg, png, pdf"
}
```

```json
{
  "success": false,
  "message": "File size exceeds maximum limit of 5MB"
}
```

## Testing

Run the test script to verify functionality:
```bash
php test_proof_of_payment.php
```

## File Lifecycle

1. **Upload**: File is validated, renamed, and stored
2. **Storage**: File path is saved in database
3. **Access**: File can be viewed/downloaded via public URL
4. **Deletion**: File is removed from storage and database

## Configuration

### Default Settings
- Upload path: `public/uploads/payments/`
- Max size: 5MB
- Allowed types: jpg, jpeg, png, pdf
- Folder structure: year/month

### Customization
```php
$config = [
    'upload_path' => ROOT_DIR . 'custom/path/',
    'allowed_types' => ['jpg', 'png', 'pdf'],
    'max_size' => 2 * 1024 * 1024, // 2MB
    'encrypt_name' => true
];

$result = upload_proof_of_payment('file_field', $config);
```

## Troubleshooting

### Common Issues
1. **File not uploading**: Check file size limits and permissions
2. **Invalid file type**: Verify allowed extensions
3. **Permission denied**: Ensure upload directory is writable
4. **File not found**: Check file paths and directory structure

### Debug Tips
- Check PHP error logs
- Verify upload directory permissions (755)
- Test with small files first
- Use browser developer tools for network requests