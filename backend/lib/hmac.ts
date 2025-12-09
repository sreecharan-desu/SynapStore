// src/lib/hmac.ts
import crypto from "crypto";

export function signWebhook(secret: string, payload: string) {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

export function verifySignature(
  secret: string,
  payload: string,
  signatureHex: string
) {
  const expected = signWebhook(secret, payload);
  // timing-safe compare
  return crypto.timingSafeEqual(
    Buffer.from(expected, "hex"),
    Buffer.from(signatureHex, "hex")
  );
}
