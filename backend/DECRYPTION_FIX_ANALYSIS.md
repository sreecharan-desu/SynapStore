# Decryption Fix - Root Cause Analysis and Solution

## Issue Reported
- Encrypted text showing in UI and server logs
- Users seeing encrypted data instead of plaintext
- Signin and OTP verification failing with "user not found" errors

## Root Cause Analysis

### The Problem: Double Encryption

The issue was caused by **conflicting encryption strategies** between the auth routes and the Prisma middleware:

#### Auth Routes (Manual Deterministic Encryption)
```typescript
// In auth.ts - Manual encryption for WHERE clause lookups
const encEmail = crypto$.encryptCellDeterministic(email);
const encUsername = crypto$.encryptCellDeterministic(username);

await prisma.user.create({
  data: {
    email: encEmail,      // Already encrypted
    username: encUsername // Already encrypted
  }
});
```

#### Prisma Middleware (Automatic Encryption)
```typescript
// Previous ENCRYPT_FIELDS configuration
User: ["username", "email", "phone", "imageUrl"]

// Middleware would try to encrypt again!
if (args.data.email) {
  args.data.email = encryptCell(args.data.email); // Double encryption!
}
```

### What Happened

1. **On Write (Create/Update)**:
   - Auth route: `email = "user@example.com"` → `encryptCellDeterministic()` → `"ABC123..."`
   - Prisma middleware: `email = "ABC123..."` → `encryptCell()` → `"XYZ789..."` (double encrypted!)
   - Database stores: `"XYZ789..."` (garbage)

2. **On Lookup (Signin)**:
   - Auth route: `email = "user@example.com"` → `encryptCellDeterministic()` → `"ABC123..."`
   - Query: `WHERE email = "ABC123..."`
   - Database has: `"XYZ789..."`
   - Result: **User not found!** ❌

3. **On Read (Display)**:
   - Prisma middleware tries to decrypt: `"XYZ789..."` → fails or returns garbage
   - UI shows: Encrypted text or null

## The Solution

### Two-Tier Field Configuration

Created separate configurations for different encryption strategies:

```typescript
/**
 * Fields encrypted by Prisma middleware (both on write and read)
 */
const ENCRYPT_FIELDS: Record<string, string[]> = {
  User: ["phone", "imageUrl"],  // NOT username/email
  Store: ["name"],
  // ... other models
};

/**
 * Fields manually encrypted in routes (decrypt-only in middleware)
 * These are encrypted deterministically for WHERE clause lookups
 */
const DECRYPT_ONLY_FIELDS: Record<string, string[]> = {
  User: ["username", "email"],  // Manually encrypted in auth routes
  Otp: ["phone"],               // Manually encrypted in auth routes
};
```

### How It Works Now

#### On Write (Create/Update)
```typescript
// Auth route manually encrypts
const encEmail = crypto$.encryptCellDeterministic(email);

// Prisma middleware SKIPS username/email (not in ENCRYPT_FIELDS)
await prisma.user.create({
  data: {
    email: encEmail,  // Stays as-is, no double encryption ✅
  }
});
```

#### On Read (Fetch)
```typescript
// Prisma middleware decrypts ALL fields (ENCRYPT_FIELDS + DECRYPT_ONLY_FIELDS)
function decryptAllFieldsForModel(data: any, model: string, dek: Buffer) {
  // Decrypt regular fields
  decryptFields(data, ENCRYPT_FIELDS[model], dek);
  
  // Decrypt manually-encrypted fields
  decryptFields(data, DECRYPT_ONLY_FIELDS[model], dek);
}

// Result: All fields properly decrypted ✅
```

#### On Lookup (Signin)
```typescript
// Auth route encrypts for lookup
const encEmail = crypto$.encryptCellDeterministic(email);

// Query matches database value
const user = await prisma.user.findUnique({
  where: { email: encEmail }  // Matches! ✅
});

// Middleware decrypts on read
// user.email = "user@example.com" (plaintext) ✅
```

## Changes Made

### File: `/backend/middleware/prisma_crypto_middleware.ts`

#### 1. Updated ENCRYPT_FIELDS
```typescript
// BEFORE (caused double encryption)
User: ["username", "email", "phone", "imageUrl"]

// AFTER (no double encryption)
User: ["phone", "imageUrl"]
```

#### 2. Added DECRYPT_ONLY_FIELDS
```typescript
const DECRYPT_ONLY_FIELDS: Record<string, string[]> = {
  User: ["username", "email"],
  Otp: ["phone"],
};
```

#### 3. Added decryptAllFieldsForModel Helper
```typescript
function decryptAllFieldsForModel(data: any, model: string, dek: Buffer): void {
  // Decrypt ENCRYPT_FIELDS
  const encryptFields = ENCRYPT_FIELDS[model] || [];
  if (encryptFields.length > 0) {
    decryptFields(data, encryptFields, dek);
  }
  
  // Decrypt DECRYPT_ONLY_FIELDS
  const decryptOnlyFields = DECRYPT_ONLY_FIELDS[model] || [];
  if (decryptOnlyFields.length > 0) {
    decryptFields(data, decryptOnlyFields, dek);
  }
}
```

#### 4. Updated All Read Operations
Replaced all `decryptFields(result, fieldsToEncrypt, dek)` with `decryptAllFieldsForModel(result, model, dek)` in:
- `create` operation
- `update` operation
- `upsert` operation
- `findUnique` operation
- `findUniqueOrThrow` operation
- `findFirst` operation
- `findFirstOrThrow` operation
- `findMany` operation

## Test Results

### Before Fix ❌
```
📝 Testing User model...
   ❌ User fields still encrypted!
   Username: TDmbV2JLV/heFJ5fAOMqLqt1T7b0r8qX9aHQvXQfNutuR2SYC3BrtK6wtXd+Mkg03mo=
   Email: ACRGs+poTPZdQXU+OpNebbVr/eIFmytNjD6bLklo3BHf6TnfLGwBTyQ4BVZzuwCqhxaavwL+wZeAHg==

📝 Testing nested relations...
   ❌ Nested Store name still encrypted!
   Store Name: z5vt+UMUh8nMk0FnfnSNGr6p1YddSzrfTDGiOtZlmDC/ZiSWqVnitBE=
```

### After Fix ✅
```
📝 Testing User model...
   ✅ User fields properly decrypted

📝 Testing Store model...
   ✅ Store fields properly decrypted
      Name: AnandPharmacy

📝 Testing nested relations (UserStoreRole -> Store)...
   ✅ Nested Store fields properly decrypted
      Store Name: AnandPharmacy

==================================================
✅ ALL TESTS PASSED!
All encrypted fields are properly decrypted when read.
==================================================
```

## Why This Approach Works

### 1. No Double Encryption
- Fields in `DECRYPT_ONLY_FIELDS` are NOT encrypted by Prisma middleware
- Auth routes handle encryption manually with deterministic algorithm
- Database stores single-encrypted values

### 2. Proper Decryption
- All fields (both `ENCRYPT_FIELDS` and `DECRYPT_ONLY_FIELDS`) are decrypted on read
- `decryptCell()` works for both regular and deterministic encryption
- UI and API responses show plaintext

### 3. Lookups Work
- Deterministic encryption produces same output for same input
- WHERE clauses can find users by encrypted email/username
- Signin and OTP verification work correctly

### 4. Nested Relations Work
- `decryptAllFieldsForModel()` is called recursively for nested objects
- Store names in UserStoreRole relations are properly decrypted
- Admin panel shows plaintext owner emails

## Key Insights

### Why Deterministic Encryption for Some Fields?

**Regular Encryption (Random Nonce)**:
```typescript
encryptCell("user@example.com") → "ABC123..." (different each time)
encryptCell("user@example.com") → "XYZ789..." (different each time)
```
- ❌ Can't use in WHERE clauses (different output each time)
- ✅ More secure (no pattern detection)

**Deterministic Encryption (HMAC-Derived Nonce)**:
```typescript
encryptCellDeterministic("user@example.com") → "ABC123..." (same every time)
encryptCellDeterministic("user@example.com") → "ABC123..." (same every time)
```
- ✅ Can use in WHERE clauses (same output each time)
- ⚠️ Slightly less secure (pattern detection possible)

### Why Both Configurations?

- **ENCRYPT_FIELDS**: For fields that don't need to be searchable (phone, imageUrl, etc.)
- **DECRYPT_ONLY_FIELDS**: For fields that need to be searchable (username, email for signin)

## Summary

| Aspect | Before | After |
|--------|--------|-------|
| **Encryption** | Double encrypted (broken) | Single encrypted (correct) |
| **Decryption** | Failed or partial | Complete and correct |
| **Signin** | ❌ User not found | ✅ Works |
| **OTP Verification** | ❌ Failed | ✅ Works |
| **UI Display** | ❌ Encrypted text | ✅ Plaintext |
| **Nested Relations** | ❌ Encrypted | ✅ Decrypted |
| **Admin Panel** | ❌ Encrypted emails | ✅ Plaintext emails |

---

**Date**: 2025-12-10  
**Status**: ✅ **FIXED AND TESTED**  
**Root Cause**: Double encryption due to conflicting strategies  
**Solution**: Separate ENCRYPT_FIELDS and DECRYPT_ONLY_FIELDS configurations  
**Result**: All functionality working correctly
