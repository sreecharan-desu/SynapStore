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

  encryptCell(plaintext: string): string {
    const nonce = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", this.dek, nonce);
    const ct = Buffer.concat([
      cipher.update(String(plaintext), "utf8"),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([nonce, ct, tag]).toString("base64");
  }

  // Deterministic encryption: derive nonce from HMAC(dek, plaintext)
  // This makes encryption deterministic for the same plaintext while
  // remaining reversible. Use with caution: deterministic ciphertexts
  // reveal equality of plaintexts but preserve confidentiality otherwise.
  encryptCellDeterministic(plaintext: string): string {
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

  decryptCell(b64: string | null): string | null {
    if (!b64) return null;
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
      console.error("Decryption failed:", err);
      return null;
    }
  }

  encryptObject(obj: Record<string, any>, fields: string[]): Record<string, any> {
    const encrypted = { ...obj };
    for (const field of fields) {
      if (encrypted[field] !== undefined && encrypted[field] !== null && encrypted[field] !== "") {
        encrypted[field] = this.encryptCell(String(encrypted[field]));
      }
    }
    return encrypted;
  }

  decryptObject(obj: Record<string, any>, fields: string[]): Record<string, any> {
    const decrypted = { ...obj };
    for (const field of fields) {
      if (decrypted[field] !== undefined && decrypted[field] !== null) {
        const dec = this.decryptCell(decrypted[field]);
        if (dec !== null) decrypted[field] = dec;
      }
    }
    return decrypted;
  }

  decryptArray(arr: Record<string, any>[], fields: string[]): Record<string, any>[] {
    return arr.map((item) => this.decryptObject(item, fields));
  }
}

export const crypto$ = new CryptoService();
