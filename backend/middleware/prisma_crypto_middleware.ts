import crypto from "crypto";
import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * Configuration for fields to encrypt per model (Randomized Encryption)
 * These fields will be automatically encrypted on write and decrypted on read
 */
const ENCRYPT_FIELDS: Record<string, string[]> = {
  // Store model
  Store: ["name"],

  // Supplier model
  Supplier: ["name", "address", "phone", "contactName"],

  // Medicine model
  Medicine: ["brandName", "genericName", "dosageForm", "strength", "category"],

  // InventoryBatch model
  InventoryBatch: ["batchNumber", "location"],

  // Notification model
  Notification: ["recipient", "subject", "body"],

  // ActivityLog model
  ActivityLog: ["action"],

  // Otp model
  Otp: ["salt", "otpHash"],

  // AuditLog model
  AuditLog: ["action", "resource"],

  // Sale model
  Sale: ["externalRef"],

  // SupplierRequest model
  SupplierRequest: ["message"],

  // StockMovement model
  StockMovement: ["note"],
  
  // User model randomized fields
  User: ["phone"]
};

/**
 * Configuration for fields to encrypt DETERMINISTICALLY
 * These fields use a derived nonce so that (plaintext -> ciphertext) is constant.
 * Essential for fields used in unique lookups (where: { email: ... })
 */
const DETERMINISTIC_FIELDS: Record<string, string[]> = {
  User: ["username", "email", "imageUrl"],
  Otp: ["phone"]
};

/**
 * Fields that manually handled but we want to ensure decrypt on read
 * (Merged into decryption logic automatically by checking both lists)
 */

/**
 * Get the data encryption key from environment variable
 */
export function dekFromEnv(): Buffer {
  const b64 = process.env.DATA_KEY_B64;
  if (!b64)
    throw new Error(
      "DATA_KEY_B64 not set. Generate a 32-byte key and set env var DATA_KEY_B64."
    );
  const buf = Buffer.from(b64, "base64");
  if (buf.length !== 32)
    throw new Error("DATA_KEY_B64 must decode to 32 bytes (AES-256 key).");
  return buf;
}

/**
 * Encrypt a single cell value using AES-256-GCM (Randomized)
 */
export function encryptCell(plaintext: string | number | boolean, dek: Buffer): string {
  if (plaintext === null || plaintext === undefined || plaintext === "") {
    return "";
  }
  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", dek, nonce);
  const ct = Buffer.concat([
    cipher.update(String(plaintext), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([nonce, ct, tag]).toString("base64");
}

/**
 * Encrypt a single cell value DETERMINISTICALLY
 * Nonce is derived from HMAC(dek, plaintext)
 */
export function encryptCellDeterministic(plaintext: string | number | boolean, dek: Buffer): string {
  if (plaintext === null || plaintext === undefined || plaintext === "") {
    return "";
  }
  const h = crypto.createHmac("sha256", dek).update(String(plaintext)).digest();
  const nonce = h.slice(0, 12); // 12 bytes nonce for GCM
  const cipher = crypto.createCipheriv("aes-256-gcm", dek, nonce);
  const ct = Buffer.concat([
    cipher.update(String(plaintext), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([nonce, ct, tag]).toString("base64");
}

/**
 * Decrypt a single cell value
 */
export function decryptCell(b64: string | null | undefined, dek: Buffer): string | null {
  if (!b64 || b64 === "") return null;
  try {
    const buf = Buffer.from(b64, "base64");
    if (buf.length < 12 + 16 + 1) return b64; // Return original if too short (likely plaintext)
    const nonce = buf.slice(0, 12);
    const ct = buf.slice(12, buf.length - 16);
    const tag = buf.slice(buf.length - 16);
    const decipher = crypto.createDecipheriv("aes-256-gcm", dek, nonce);
    decipher.setAuthTag(tag);
    const res = Buffer.concat([decipher.update(ct), decipher.final()]);
    return res.toString("utf8");
  } catch (err) {
    // Return original value if decryption fails (backward compatibility / plaintext)
    return b64;
  }
}

/**
 * Recursively encrypt fields in an object or nested structure
 */
function encryptFields(data: any, model: string, dek: Buffer): void {
  if (!data || typeof data !== "object") return;
  
  const randomFields = ENCRYPT_FIELDS[model] || [];
  const deterministicFields = DETERMINISTIC_FIELDS[model] || [];

  // Handle Randomized Fields
  for (const field of randomFields) {
    if (data[field] !== undefined && data[field] !== null && data[field] !== "") {
      data[field] = encryptCell(String(data[field]), dek);
    }
  }

  // Handle Deterministic Fields
  for (const field of deterministicFields) {
    if (data[field] !== undefined && data[field] !== null && data[field] !== "") {
      data[field] = encryptCellDeterministic(String(data[field]), dek);
    }
  }
}

/**
 * Recursively decrypt fields in an object or nested structure
 */
function decryptFields(data: any, fields: string[], dek: Buffer): void {
  if (!data || typeof data !== "object") return;

  for (const field of fields) {
    if (data[field] !== undefined && data[field] !== null) {
      const dec = decryptCell(data[field], dek);
      if (dec !== null) {
        data[field] = dec;
      }
    }
  }
}

/**
 * Decrypt all fields for a model (both ENCRYPT_FIELDS and DETERMINISTIC_FIELDS)
 */
function decryptAllFieldsForModel(data: any, model: string, dek: Buffer): void {
  if (!data || typeof data !== "object") return;

  const randomFields = ENCRYPT_FIELDS[model] || [];
  const deterministicFields = DETERMINISTIC_FIELDS[model] || [];
  
  const allFields = [...randomFields, ...deterministicFields];
  if (allFields.length > 0) {
    decryptFields(data, allFields, dek);
  }
}


/**
 * Setup Prisma Client Extension for transparent field-level encryption
 */
export default function setupPrismaCrypto(prisma: PrismaClient) {
  const dek = dekFromEnv();

  return prisma.$extends({
    name: 'field-encryption',
    query: {
      $allModels: {
        async create({ model, operation, args, query }: any) {
          if (args.data) {
             encryptFields(args.data, model, dek);
          }
          const result = await query(args);
          if (result) decryptAllFieldsForModel(result, model, dek);
          return result;
        },

        async createMany({ model, operation, args, query }: any) {
          if (args.data) {
             if (Array.isArray(args.data)) {
               for (const item of args.data) {
                 encryptFields(item, model, dek);
               }
             } else {
                 encryptFields(args.data, model, dek);
             }
          }
          return query(args);
        },

        async update({ model, operation, args, query }: any) {
          if (args.data) {
             encryptFields(args.data, model, dek);
          }
          const result = await query(args);
          if (result) decryptAllFieldsForModel(result, model, dek);
          return result;
        },

        async updateMany({ model, operation, args, query }: any) {
          if (args.data) {
            encryptFields(args.data, model, dek);
          }
          return query(args);
        },

        async upsert({ model, operation, args, query }: any) {
          if (args.create) {
            encryptFields(args.create, model, dek);
          }
          if (args.update) {
            encryptFields(args.update, model, dek);
          }
          const result = await query(args);
          
          if (result) {
            decryptAllFieldsForModel(result, model, dek);
            // Handle relations for upsert result if needed (shallow decrypt usually enough for seed)
          }
          return result;
        },

        async findUnique({ model, operation, args, query }: any) {
          const result = await query(args);
          if (result) {
             decryptAllFieldsForModel(result, model, dek);
             // handle relations deeply if possible, but basic model decrypt is key
             // (Copying deep logic for relationships from original code if needed or keeping simple)
             // For seed validation, shallow is often fine, but let's try to preserve recursive structure if feasible.
             // Given the restriction of replacing entire file content, I'll stick to a simpler recursive helper if defined, 
             // or just basic decrypt. The original had deep recursion. 
             // I will add a helper to recurse 'decryptAllFieldsForModel' on object keys that look like relations.
             deepDecrypt(result, model, dek);
          }
          return result;
        },
        
        async findFirst({ model, operation, args, query }: any) {
             const result = await query(args);
             if (result) deepDecrypt(result, model, dek);
             return result;
        },
        
        async findMany({ model, operation, args, query }: any) {
             const result = await query(args);
             if (result && Array.isArray(result)) {
                 for (const item of result) deepDecrypt(item, model, dek);
             }
             return result;
        }
      },
    },
  });
}

// Helper for deep decryption of relations
function deepDecrypt(data: any, model: string, dek: Buffer) {
    if (!data || typeof data !== 'object') return;
    
    // Decrypt fields of current model
    decryptAllFieldsForModel(data, model, dek);
    
    // Scan for relations (nested objects/arrays)
    for (const key in data) {
         const val = data[key];
         if (val && typeof val === 'object') {
             // Heuristic: if it's an object/array, assume it might be a relation
             // We guess the model name from the key (e.g. "user" -> "User", "items" -> "SaleItem"?)
             // This is imperfect without DMMF, but works for explicit includes usually.
             // If we can't guess model, we can't decrypt fields accurately.
             // However, strictly, `decryptAllFieldsForModel` requires `model`.
             // If we don't know the model, we skip.
             
             // A common convention: key "user" -> model "User"
             // key "medicines" -> model "Medicine"
             const inferredModel = key.charAt(0).toUpperCase() + key.slice(1);
             // Check if inferredModel exists in our config to be safe?
             const isConfigured = ENCRYPT_FIELDS[inferredModel] || DETERMINISTIC_FIELDS[inferredModel];

             if (isConfigured) {
                 if (Array.isArray(val)) {
                     val.forEach(v => deepDecrypt(v, inferredModel, dek));
                 } else {
                     deepDecrypt(val, inferredModel, dek);
                 }
             } else {
                 // Try singular for array keys (e.g. "medicines" -> "Medicine")
                 if (key.endsWith('s')) {
                     const singular = key.slice(0, -1);
                     const singularModel = singular.charAt(0).toUpperCase() + singular.slice(1);
                      if (ENCRYPT_FIELDS[singularModel] || DETERMINISTIC_FIELDS[singularModel]) {
                          if (Array.isArray(val)) {
                             val.forEach(v => deepDecrypt(v, singularModel, dek));
                          }
                      }
                 }
             }
         }
    }
}