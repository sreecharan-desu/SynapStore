import crypto from "crypto";

export class CryptoService {
  private dek: Buffer;

  constructor() {
    const b64 = process.env.DATA_KEY_B64;
    if (!b64) {
      throw new Error(
        "DATA_KEY_B64 not set. Generate a 32-byte key and set env var DATA_KEY_B64."
      );
    }
    this.dek = Buffer.from(b64, "base64");
    if (this.dek.length !== 32) {
      throw new Error("DATA_KEY_B64 must decode to 32 bytes (AES-256 key).");
    }
  }

  /**
   * Encrypts a single cell value using AES-256-GCM with random nonce
   * @param plaintext - The plaintext value to encrypt
   * @returns Base64-encoded encrypted value
   */
  encryptCell(plaintext: string | number | boolean): string {
    if (plaintext === null || plaintext === undefined || plaintext === "") {
      return "";
    }
    const nonce = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", this.dek, nonce);
    const ct = Buffer.concat([
      cipher.update(String(plaintext), "utf8"),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([nonce, ct, tag]).toString("base64");
  }

  /**
   * Deterministic encryption: derive nonce from HMAC(dek, plaintext)
   * This makes encryption deterministic for the same plaintext while
   * remaining reversible. Use with caution: deterministic ciphertexts
   * reveal equality of plaintexts but preserve confidentiality otherwise.
   * Useful for fields that need to be searchable or indexed.
   * @param plaintext - The plaintext value to encrypt
   * @returns Base64-encoded encrypted value
   */
  encryptCellDeterministic(plaintext: string | number | boolean): string {
    if (plaintext === null || plaintext === undefined || plaintext === "") {
      return "";
    }
    const h = crypto.createHmac("sha256", this.dek).update(String(plaintext)).digest();
    const nonce = h.slice(0, 12); // 12 bytes nonce for GCM
    const cipher = crypto.createCipheriv("aes-256-gcm", this.dek, nonce);
    const ct = Buffer.concat([
      cipher.update(String(plaintext), "utf8"),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([nonce, ct, tag]).toString("base64");
  }

  /**
   * Decrypts a single cell value
   * @param b64 - Base64-encoded encrypted value
   * @returns Decrypted plaintext or null if decryption fails
   */
  decryptCell(b64: string | null | undefined): string | null {
    if (!b64 || b64 === "") return null;
    try {
      const buf = Buffer.from(b64, "base64");
      if (buf.length < 12 + 16 + 1) return null;
      const nonce = buf.slice(0, 12);
      const ct = buf.slice(12, buf.length - 16);
      const tag = buf.slice(buf.length - 16);
      const decipher = crypto.createDecipheriv("aes-256-gcm", this.dek, nonce);
      decipher.setAuthTag(tag);
      const res = Buffer.concat([decipher.update(ct), decipher.final()]);
      return res.toString("utf8");
    } catch (err) {
      // If decryption fails, it might be plaintext (for backward compatibility)
      // Return null to indicate decryption failure
      return null;
    }
  }

  /**
   * Safely decrypts a cell, returning the original value if decryption fails
   * This is useful for backward compatibility with existing unencrypted data
   * @param value - The value to decrypt
   * @returns Decrypted value or original value if decryption fails
   */
  safeDecryptCell(value: string | null | undefined): string | null {
    if (!value || value === "") return null;
    const decrypted = this.decryptCell(value);
    // If decryption fails, assume it's already plaintext
    return decrypted !== null ? decrypted : value;
  }

  /**
   * Encrypts specified fields in an object
   * @param obj - The object containing fields to encrypt
   * @param fields - Array of field names to encrypt
   * @returns New object with encrypted fields
   */
  encryptObject(obj: Record<string, any>, fields: string[]): Record<string, any> {
    const encrypted = { ...obj };
    for (const field of fields) {
      if (encrypted[field] !== undefined && encrypted[field] !== null && encrypted[field] !== "") {
        encrypted[field] = this.encryptCell(String(encrypted[field]));
      }
    }
    return encrypted;
  }

  /**
   * Decrypts specified fields in an object
   * @param obj - The object containing fields to decrypt
   * @param fields - Array of field names to decrypt
   * @returns New object with decrypted fields
   */
  decryptObject(obj: Record<string, any>, fields: string[]): Record<string, any> {
    if (!obj) return obj;
    const decrypted = { ...obj };
    for (const field of fields) {
      if (decrypted[field] !== undefined && decrypted[field] !== null) {
        const dec = this.decryptCell(decrypted[field]);
        if (dec !== null) {
          decrypted[field] = dec;
        }
        // If decryption fails, keep the original value (might be plaintext)
      }
    }
    return decrypted;
  }

  /**
   * Decrypts specified fields in an array of objects
   * @param arr - Array of objects to decrypt
   * @param fields - Array of field names to decrypt
   * @returns New array with decrypted objects
   */
  decryptArray(arr: Record<string, any>[], fields: string[]): Record<string, any>[] {
    if (!arr || !Array.isArray(arr)) return arr;
    return arr.map((item) => this.decryptObject(item, fields));
  }

  /**
   * Encrypts nested objects recursively
   * @param obj - The object to encrypt
   * @param fieldMap - Map of field paths to encrypt (e.g., { "user.email": true })
   * @returns New object with encrypted nested fields
   */
  encryptNested(obj: Record<string, any>, fieldMap: Record<string, boolean>): Record<string, any> {
    const encrypted = { ...obj };
    for (const fieldPath in fieldMap) {
      const parts = fieldPath.split(".");
      let current: any = encrypted;
      for (let i = 0; i < parts.length - 1; i++) {
        if (current[parts[i]] === undefined) break;
        current = current[parts[i]];
      }
      const lastPart = parts[parts.length - 1];
      if (current && current[lastPart] !== undefined && current[lastPart] !== null && current[lastPart] !== "") {
        current[lastPart] = this.encryptCell(String(current[lastPart]));
      }
    }
    return encrypted;
  }

  /**
   * Decrypts nested objects recursively
   * @param obj - The object to decrypt
   * @param fieldMap - Map of field paths to decrypt
   * @returns New object with decrypted nested fields
   */
  decryptNested(obj: Record<string, any>, fieldMap: Record<string, boolean>): Record<string, any> {
    if (!obj) return obj;
    const decrypted = { ...obj };
    for (const fieldPath in fieldMap) {
      const parts = fieldPath.split(".");
      let current: any = decrypted;
      for (let i = 0; i < parts.length - 1; i++) {
        if (current[parts[i]] === undefined) break;
        current = current[parts[i]];
      }
      const lastPart = parts[parts.length - 1];
      if (current && current[lastPart] !== undefined && current[lastPart] !== null) {
        const dec = this.decryptCell(current[lastPart]);
        if (dec !== null) {
          current[lastPart] = dec;
        }
      }
    }
    return decrypted;
  }
}

export const crypto$ = new CryptoService();
