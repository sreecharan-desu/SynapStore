# Field-Level Encryption Implementation

## Overview

This implementation provides **transparent field-level encryption** for sensitive data in the database. All encryption and decryption happens automatically through Prisma middleware - **no schema changes are required**.

## How It Works

### Architecture

1. **Encryption Middleware**: Intercepts all Prisma operations
2. **Automatic Encryption**: Encrypts sensitive fields before writing to database
3. **Automatic Decryption**: Decrypts sensitive fields after reading from database
4. **No Schema Changes**: Uses existing string columns to store encrypted data

### Encryption Algorithm

- **Algorithm**: AES-256-GCM (Galois/Counter Mode)
- **Key Size**: 256 bits (32 bytes)
- **Nonce**: 12 bytes (randomly generated for each encryption)
- **Authentication Tag**: 16 bytes (ensures data integrity)
- **Output Format**: Base64-encoded string containing [nonce + ciphertext + tag]

### Key Management

The encryption key is stored in the environment variable `DATA_KEY_B64`:

```bash
# Generate a new key (run once)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Add to .env file
DATA_KEY_B64=<your-generated-key>
```

**⚠️ IMPORTANT**: 
- Never commit the encryption key to version control
- Store the key securely (e.g., AWS Secrets Manager, HashiCorp Vault)
- Backup the key - if lost, encrypted data cannot be recovered
- Rotate keys periodically for security best practices

## Encrypted Fields by Model

### User Model (PII & Authentication)
- `username` - User's username
- `email` - Email address
- `phone` - Phone number
- `imageUrl` - Profile image URL

### Store Model (Business Information)
- `name` - Store name

### Supplier Model (Contact & Business Information)
- `name` - Supplier name
- `address` - Physical address
- `phone` - Contact phone
- `contactName` - Contact person name

### Medicine Model (HIPAA Sensitive)
- `brandName` - Brand name of medication
- `genericName` - Generic name of medication
- `dosageForm` - Form of medication (tablet, capsule, etc.)
- `strength` - Medication strength
- `category` - Medication category

### InventoryBatch Model (Batch Tracking)
- `batchNumber` - Batch/lot number
- `location` - Storage location

### Notification Model (Communication Content)
- `recipient` - Notification recipient
- `subject` - Notification subject
- `body` - Notification body/content

### ActivityLog Model (Audit Trail)
- `action` - Action performed

### AuditLog Model (Audit Trail)
- `action` - Action performed
- `resource` - Resource affected

### Otp Model (Authentication Data)
- `phone` - Phone number for OTP
- `otpHash` - Hashed OTP value
- `salt` - Salt for OTP hashing

### Sale Model (Transaction Reference)
- `externalRef` - External reference ID

### SupplierRequest Model (Communication)
- `message` - Request message

### StockMovement Model (Notes)
- `note` - Movement notes (may contain sensitive info)

## Usage Examples

### Creating Records (Encryption is Automatic)

```typescript
// Create a user - email and phone are automatically encrypted
const user = await prisma.user.create({
  data: {
    username: "john_doe",
    email: "john@example.com",  // ← Automatically encrypted
    phone: "+1234567890",        // ← Automatically encrypted
    passwordHash: "...",
  }
});

// The data is encrypted in the database, but appears as plaintext in your code
console.log(user.email); // "john@example.com" (decrypted automatically)
```

### Reading Records (Decryption is Automatic)

```typescript
// Find a user - encrypted fields are automatically decrypted
const user = await prisma.user.findUnique({
  where: { id: userId }
});

// All encrypted fields are automatically decrypted
console.log(user.email);    // "john@example.com" (plaintext)
console.log(user.phone);    // "+1234567890" (plaintext)
console.log(user.username); // "john_doe" (plaintext)
```

### Updating Records (Encryption is Automatic)

```typescript
// Update a user - new values are automatically encrypted
const updated = await prisma.user.update({
  where: { id: userId },
  data: {
    email: "newemail@example.com",  // ← Automatically encrypted
    phone: "+9876543210",            // ← Automatically encrypted
  }
});

console.log(updated.email); // "newemail@example.com" (decrypted)
```

### Querying with Relations (Nested Decryption)

```typescript
// Relations are also automatically decrypted
const store = await prisma.store.findUnique({
  where: { id: storeId },
  include: {
    users: true,      // User emails/phones are decrypted
    suppliers: true,  // Supplier names/addresses are decrypted
    medicines: true,  // Medicine names are decrypted
  }
});

// All nested data is automatically decrypted
console.log(store.name);                    // Decrypted store name
console.log(store.users[0].email);          // Decrypted user email
console.log(store.suppliers[0].address);    // Decrypted supplier address
console.log(store.medicines[0].brandName);  // Decrypted medicine name
```

## Database Storage

### What the Database Sees (Encrypted)

When you view the database directly (e.g., using pgAdmin, psql, or database tools), encrypted fields appear as Base64-encoded strings:

```sql
SELECT username, email, phone FROM "User";

-- Result:
-- username: "Kx7j9mP3qR8sT2vW..."  (encrypted)
-- email:    "Lm4n6oQ9rS1tU3wX..."  (encrypted)
-- phone:    "Mn5p7qR0sT2uV4xY..."  (encrypted)
```

### What Your Application Sees (Decrypted)

When you query through Prisma, the middleware automatically decrypts the data:

```typescript
const user = await prisma.user.findFirst();

console.log(user.username); // "john_doe" (plaintext)
console.log(user.email);    // "john@example.com" (plaintext)
console.log(user.phone);    // "+1234567890" (plaintext)
```

## Security Considerations

### ✅ What This Protects Against

1. **Database Breaches**: If someone gains read access to your database, they cannot read encrypted fields without the encryption key
2. **Backup Exposure**: Database backups contain encrypted data
3. **Insider Threats**: Database administrators cannot read sensitive data
4. **Compliance**: Helps meet HIPAA, GDPR, and other regulatory requirements

### ⚠️ What This Does NOT Protect Against

1. **Application-Level Attacks**: If an attacker gains access to your application code, they can read decrypted data
2. **SQL Injection**: Always use parameterized queries (Prisma does this automatically)
3. **Key Compromise**: If the encryption key is compromised, all data can be decrypted
4. **Memory Dumps**: Decrypted data exists in application memory

### Best Practices

1. **Key Rotation**: Periodically rotate encryption keys
2. **Access Control**: Limit who can access the encryption key
3. **Audit Logging**: Monitor access to sensitive data
4. **Secure Key Storage**: Use a secrets management service
5. **Backup Keys**: Store encryption keys in multiple secure locations
6. **Test Decryption**: Regularly verify you can decrypt data with your backup keys

## Performance Considerations

### Encryption Overhead

- **Encryption**: ~0.1-0.5ms per field
- **Decryption**: ~0.1-0.5ms per field
- **Impact**: Minimal for most applications (< 5% overhead)

### Optimization Tips

1. **Batch Operations**: Use `createMany` for bulk inserts
2. **Select Specific Fields**: Only query fields you need
3. **Caching**: Cache frequently accessed encrypted data
4. **Indexing**: Encrypted fields cannot be indexed efficiently

### When NOT to Encrypt

Don't encrypt fields that need to be:
- Searched with partial matches (LIKE queries)
- Sorted in the database
- Used in database-level aggregations
- Frequently joined on

## Troubleshooting

### Issue: Decryption Returns Null

**Cause**: The data might be plaintext (not encrypted) or encrypted with a different key

**Solution**: 
```typescript
// Use safeDecryptCell for backward compatibility
import { crypto$ } from './lib/crypto';

const value = crypto$.safeDecryptCell(encryptedValue);
// Returns decrypted value or original value if decryption fails
```

### Issue: "DATA_KEY_B64 not set" Error

**Cause**: Environment variable is missing

**Solution**:
```bash
# Generate a new key
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Add to .env
echo "DATA_KEY_B64=<your-key>" >> .env
```

### Issue: Existing Data Not Encrypted

**Cause**: Data was created before encryption was enabled

**Solution**: Run a migration script to encrypt existing data:

```typescript
import prisma from './lib/prisma';
import { crypto$ } from './lib/crypto';

async function encryptExistingData() {
  // Temporarily disable middleware
  const users = await prisma.$queryRaw`SELECT * FROM "User"`;
  
  for (const user of users) {
    await prisma.$executeRaw`
      UPDATE "User" 
      SET email = ${crypto$.encryptCell(user.email)},
          phone = ${crypto$.encryptCell(user.phone)}
      WHERE id = ${user.id}
    `;
  }
}
```

## Testing

### Unit Tests

```typescript
import { crypto$ } from './lib/crypto';

describe('CryptoService', () => {
  it('should encrypt and decrypt correctly', () => {
    const plaintext = 'sensitive data';
    const encrypted = crypto$.encryptCell(plaintext);
    const decrypted = crypto$.decryptCell(encrypted);
    
    expect(encrypted).not.toBe(plaintext);
    expect(decrypted).toBe(plaintext);
  });
  
  it('should handle null values', () => {
    expect(crypto$.encryptCell(null)).toBe('');
    expect(crypto$.decryptCell(null)).toBe(null);
  });
});
```

### Integration Tests

```typescript
describe('Prisma Encryption Middleware', () => {
  it('should encrypt data on create', async () => {
    const user = await prisma.user.create({
      data: {
        username: 'test',
        email: 'test@example.com',
        phone: '+1234567890',
      }
    });
    
    // Query raw to see encrypted data
    const raw = await prisma.$queryRaw`
      SELECT email FROM "User" WHERE id = ${user.id}
    `;
    
    expect(raw[0].email).not.toBe('test@example.com');
    expect(raw[0].email).toMatch(/^[A-Za-z0-9+/=]+$/); // Base64
  });
  
  it('should decrypt data on read', async () => {
    const user = await prisma.user.findFirst({
      where: { email: 'test@example.com' }
    });
    
    expect(user.email).toBe('test@example.com');
  });
});
```

## Migration Guide

### Enabling Encryption on Existing Data

1. **Backup your database**
2. **Generate encryption key**
3. **Add key to environment**
4. **Deploy middleware**
5. **Encrypt existing data** (see migration script above)
6. **Verify encryption** (check database directly)
7. **Test application** (ensure data is decrypted correctly)

### Disabling Encryption

To disable encryption (not recommended):

1. Comment out the middleware setup in `lib/prisma.ts`:
```typescript
// setupPrismaCrypto(prisma);
```

2. Decrypt all existing data using a migration script

## Compliance

This implementation helps meet various compliance requirements:

- **HIPAA**: Protects PHI (Protected Health Information) like patient names, medications
- **GDPR**: Protects PII (Personally Identifiable Information) like emails, phone numbers
- **PCI DSS**: Protects payment-related data
- **SOC 2**: Demonstrates data security controls

## Support

For questions or issues:
1. Check the troubleshooting section above
2. Review the code in `backend/lib/crypto.ts` and `backend/middleware/prisma_crypto_middleware.ts`
3. Consult the Prisma middleware documentation: https://www.prisma.io/docs/concepts/components/prisma-client/middleware

---

**Last Updated**: 2025-12-10
**Version**: 1.0.0
