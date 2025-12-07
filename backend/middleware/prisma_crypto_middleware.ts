import crypto from "crypto";
import type { PrismaClient } from "@prisma/client";

// Columns to encrypt (non-key, non-constraint fields)
const ENCRYPT_FIELDS: Record<string, string[]> = {
  User: ["username", "email", "imageUrl", "OtpCode"],
  Doctor: ["name", "address", "phone"],
  Supplier: ["name", "address", "phone"],
  Drugs: ["brandName", "genericName"],
  Insurance: ["phone"],
  Patient: ["firstName", "lastName", "address", "phone", "gender"],
  Prescription: ["status"],
};

function dekFromEnv(): Buffer {
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

function encryptCell(plaintext: string, dek: Buffer): string {
  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", dek, nonce);
  const ct = Buffer.concat([
    cipher.update(String(plaintext), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([nonce, ct, tag]).toString("base64");
}

function decryptCell(b64: string | null, dek: Buffer): string | null {
  if (!b64) return null;
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
    console.error("Decryption failed:", err);
    return null;
  }
}

export default function setupPrismaCrypto(prisma: PrismaClient) {
  const dek = dekFromEnv();

  (prisma as any).$use(async (params: any, next: any) => {
    const model = params.model;
    const fieldsToEncrypt = ENCRYPT_FIELDS[model] || [];

    // Encrypt on writes (create, update, upsert)
    if (
      ["create", "update", "upsert"].includes(params.action) &&
      fieldsToEncrypt.length > 0
    ) {
      if (params.args && params.args.data) {
        for (const field of fieldsToEncrypt) {
          const v = (params.args.data as any)[field];
          if (v !== undefined && v !== null && v !== "") {
            (params.args.data as any)[field] = encryptCell(String(v), dek);
          }
        }
      }
      return next(params);
    }

    // Decrypt on reads (findUnique, findFirst, findMany)
    if (
      ["findUnique", "findFirst", "findMany"].includes(params.action) &&
      fieldsToEncrypt.length > 0
    ) {
      const result = await next(params);
      if (!result) return result;

      const decryptRow = (row: Record<string, any>) => {
        for (const field of fieldsToEncrypt) {
          if (row[field] !== undefined && row[field] !== null) {
            const dec = decryptCell(row[field], dek);
            if (dec !== null) row[field] = dec;
          }
        }
        return row;
      };

      return Array.isArray(result)
        ? result.map(decryptRow)
        : decryptRow(result as any);
    }

    return next(params);
  });
}
