import crypto from "crypto";
import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * Configuration for fields to encrypt per model
 * These fields will be automatically encrypted on write and decrypted on read
 * No schema changes are required - encryption is transparent
 */
const ENCRYPT_FIELDS: Record<string, string[]> = {
  // User model - PII and authentication data
  // username, email, imageUrl are encrypted manually in routes (deterministically or otherwise)
  // so they are removed from here to prevent double encryption on write.
  User: ["phone"],

  // Store model - business information
  Store: ["name"],

  // Supplier model - contact and business information
  Supplier: ["name", "address", "phone", "contactName"],

  // Medicine model - medication information (HIPAA sensitive)
  Medicine: ["brandName", "genericName", "dosageForm", "strength", "category"],

  // InventoryBatch model - batch tracking information
  InventoryBatch: ["batchNumber", "location"],

  // Notification model - communication content
  Notification: ["recipient", "subject", "body"],

  // ActivityLog model - audit trail
  ActivityLog: ["action"],

  // AuditLog model - audit trail
  AuditLog: ["action", "resource"],

  // Otp model - authentication data
  // phone (email), otpHash are manually encrypted in routes
  Otp: ["salt"],

  // Sale model - transaction reference
  Sale: ["externalRef"],

  // SupplierRequest model - communication
  SupplierRequest: ["message"],

  // StockMovement model - notes may contain sensitive info
  StockMovement: ["note"],
};

/**
 * Fields that are MANUALLY encrypted deterministically in routes (for WHERE lookups)
 * These fields should be DECRYPTED on read but NOT encrypted on write
 * (to avoid double encryption which breaks lookups)
 */
const DECRYPT_ONLY_FIELDS: Record<string, string[]> = {
  // User model - username and email are encrypted deterministically in auth routes
  User: ["username", "email", "imageUrl"],

  // Otp model - phone is encrypted deterministically in auth routes
  Otp: ["phone", "otpHash"],
};

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
 * Encrypt a single cell value using AES-256-GCM
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
 * Decrypt a single cell value
 */
export function decryptCell(b64: string | null | undefined, dek: Buffer): string | null {
  if (!b64 || b64 === "") return null;
  try {
    const buf = Buffer.from(b64, "base64");
    if (buf.length < 12 + 16 + 1) return null; // too small to be valid
    const nonce = buf.slice(0, 12);
    const ct = buf.slice(12, buf.length - 16);
    const tag = buf.slice(buf.length - 16);
    const decipher = crypto.createDecipheriv("aes-256-gcm", dek, nonce);
    decipher.setAuthTag(tag);
    const res = Buffer.concat([decipher.update(ct), decipher.final()]);
    return res.toString("utf8");
  } catch (err) {
    // Silently fail - might be plaintext for backward compatibility
    return null;
  }
}

/**
 * Recursively encrypt fields in an object or nested structure
 */
function encryptFields(data: any, fields: string[], dek: Buffer): void {
  if (!data || typeof data !== "object") return;

  for (const field of fields) {
    if (data[field] !== undefined && data[field] !== null && data[field] !== "") {
      data[field] = encryptCell(String(data[field]), dek);
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
      // If decryption fails, keep original value (might be plaintext)
    }
  }
}

/**
 * Decrypt all fields for a model (both ENCRYPT_FIELDS and DECRYPT_ONLY_FIELDS)
 */
function decryptAllFieldsForModel(data: any, model: string, dek: Buffer): void {
  if (!data || typeof data !== "object") return;

  // Decrypt regular encrypted fields
  const encryptFields = ENCRYPT_FIELDS[model] || [];
  if (encryptFields.length > 0) {
    decryptFields(data, encryptFields, dek);
  }

  // Decrypt decrypt-only fields (manually encrypted in routes)
  const decryptOnlyFields = DECRYPT_ONLY_FIELDS[model] || [];
  if (decryptOnlyFields.length > 0) {
    decryptFields(data, decryptOnlyFields, dek);
  }
}


/**
 * Setup Prisma Client Extension for transparent field-level encryption
 * This extension intercepts all Prisma operations and:
 * 1. Encrypts sensitive fields before writing to database
 * 2. Decrypts sensitive fields after reading from database
 *
 * No schema changes are required - encryption is completely transparent
 *
 * Uses Prisma Client Extensions API (Prisma 7.x compatible)
 */
export default function setupPrismaCrypto(prisma: PrismaClient) {
  const dek = dekFromEnv();

  return prisma.$extends({
    name: 'field-encryption',
    query: {
      // Apply to all models
      $allModels: {
        // Intercept create operations
        async create({ model, operation, args, query }: any) {
          const fieldsToEncrypt = ENCRYPT_FIELDS[model] || [];

          if (fieldsToEncrypt.length > 0 && args.data) {
            encryptFields(args.data, fieldsToEncrypt, dek);
          }

          const result = await query(args);

          // Decrypt the result
          if (result) {
            decryptAllFieldsForModel(result, model, dek);
          }

          return result;
        },

        // Intercept createMany operations
        async createMany({ model, operation, args, query }: any) {
          const fieldsToEncrypt = ENCRYPT_FIELDS[model] || [];

          if (fieldsToEncrypt.length > 0 && args.data) {
            if (Array.isArray(args.data)) {
              for (const item of args.data) {
                encryptFields(item, fieldsToEncrypt, dek);
              }
            }
          }

          return query(args);
        },

        // Intercept update operations
        async update({ model, operation, args, query }: any) {
          const fieldsToEncrypt = ENCRYPT_FIELDS[model] || [];

          if (fieldsToEncrypt.length > 0 && args.data) {
            encryptFields(args.data, fieldsToEncrypt, dek);
          }

          const result = await query(args);

          // Decrypt the result
          if (result) {
            decryptAllFieldsForModel(result, model, dek);
          }

          return result;
        },

        // Intercept updateMany operations
        async updateMany({ model, operation, args, query }: any) {
          const fieldsToEncrypt = ENCRYPT_FIELDS[model] || [];

          if (fieldsToEncrypt.length > 0 && args.data) {
            encryptFields(args.data, fieldsToEncrypt, dek);
          }

          return query(args);
        },

        // Intercept upsert operations
        async upsert({ model, operation, args, query }: any) {
          const fieldsToEncrypt = ENCRYPT_FIELDS[model] || [];

          if (fieldsToEncrypt.length > 0) {
            if (args.create) {
              encryptFields(args.create, fieldsToEncrypt, dek);
            }
            if (args.update) {
              encryptFields(args.update, fieldsToEncrypt, dek);
            }
          }

          const result = await query(args);

          // Decrypt the result (including decrypt-only fields)
          if (result) {
            decryptAllFieldsForModel(result, model, dek);

            // Handle nested relations
            for (const key in result) {
              if (result[key] && typeof result[key] === "object") {
                const relatedModel = key.charAt(0).toUpperCase() + key.slice(1);
                if (Array.isArray(result[key])) {
                  result[key].forEach((item: any) => decryptAllFieldsForModel(item, relatedModel, dek));
                } else {
                  decryptAllFieldsForModel(result[key], relatedModel, dek);
                }
              }
            }
          }

          return result;
        },

        // Intercept findUnique operations
        async findUnique({ model, operation, args, query }: any) {
          const result = await query(args);
          const fieldsToEncrypt = ENCRYPT_FIELDS[model] || [];

          if (result) {
            decryptAllFieldsForModel(result, model, dek);

            // Handle nested relations
            for (const key in result) {
              if (result[key] && typeof result[key] === "object") {
                const relatedModel = key.charAt(0).toUpperCase() + key.slice(1);
                const relatedFields = ENCRYPT_FIELDS[relatedModel] || [];
                if (relatedFields.length > 0) {
                  if (Array.isArray(result[key])) {
                    result[key].forEach((item: any) => decryptFields(item, relatedFields, dek));
                  } else {
                    decryptFields(result[key], relatedFields, dek);
                  }
                }
              }
            }
          }

          return result;
        },

        // Intercept findUniqueOrThrow operations
        async findUniqueOrThrow({ model, operation, args, query }: any) {
          const result = await query(args);
          const fieldsToEncrypt = ENCRYPT_FIELDS[model] || [];

          if (result) {
            decryptAllFieldsForModel(result, model, dek);

            // Handle nested relations
            for (const key in result) {
              if (result[key] && typeof result[key] === "object") {
                const relatedModel = key.charAt(0).toUpperCase() + key.slice(1);
                const relatedFields = ENCRYPT_FIELDS[relatedModel] || [];
                if (relatedFields.length > 0) {
                  if (Array.isArray(result[key])) {
                    result[key].forEach((item: any) => decryptFields(item, relatedFields, dek));
                  } else {
                    decryptFields(result[key], relatedFields, dek);
                  }
                }
              }
            }
          }

          return result;
        },

        // Intercept findFirst operations
        async findFirst({ model, operation, args, query }: any) {
          const result = await query(args);
          const fieldsToEncrypt = ENCRYPT_FIELDS[model] || [];

          if (result) {
            decryptAllFieldsForModel(result, model, dek);

            // Handle nested relations
            for (const key in result) {
              if (result[key] && typeof result[key] === "object") {
                const relatedModel = key.charAt(0).toUpperCase() + key.slice(1);
                const relatedFields = ENCRYPT_FIELDS[relatedModel] || [];
                if (relatedFields.length > 0) {
                  if (Array.isArray(result[key])) {
                    result[key].forEach((item: any) => decryptFields(item, relatedFields, dek));
                  } else {
                    decryptFields(result[key], relatedFields, dek);
                  }
                }
              }
            }
          }

          return result;
        },

        // Intercept findFirstOrThrow operations
        async findFirstOrThrow({ model, operation, args, query }: any) {
          const result = await query(args);
          const fieldsToEncrypt = ENCRYPT_FIELDS[model] || [];

          if (result) {
            decryptAllFieldsForModel(result, model, dek);

            // Handle nested relations
            for (const key in result) {
              if (result[key] && typeof result[key] === "object") {
                const relatedModel = key.charAt(0).toUpperCase() + key.slice(1);
                const relatedFields = ENCRYPT_FIELDS[relatedModel] || [];
                if (relatedFields.length > 0) {
                  if (Array.isArray(result[key])) {
                    result[key].forEach((item: any) => decryptFields(item, relatedFields, dek));
                  } else {
                    decryptFields(result[key], relatedFields, dek);
                  }
                }
              }
            }
          }

          return result;
        },

        // Intercept findMany operations
        async findMany({ model, operation, args, query }: any) {
          const result = await query(args);

          // Decrypt the result (including decrypt-only fields)
          if (result && Array.isArray(result)) {
            for (const item of result) {
              decryptAllFieldsForModel(item, model, dek);

              // Handle nested relations
              for (const key in item) {
                if (item[key] && typeof item[key] === "object") {
                  const relatedModel = key.charAt(0).toUpperCase() + key.slice(1);
                  if (Array.isArray(item[key])) {
                    item[key].forEach((nested: any) => decryptAllFieldsForModel(nested, relatedModel, dek));
                  } else {
                    decryptAllFieldsForModel(item[key], relatedModel, dek);
                  }
                }
              }
            }
          }

          return result;
        },
      },
    },
  });
}