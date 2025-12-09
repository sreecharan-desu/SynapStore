// src/adapters/webhookAdapter.ts
import axios from "axios";
import { signWebhook } from "../lib/hmac";

export async function deliverWebhook(
  url: string,
  secret: string | null,
  eventEnvelope: any,
  timeoutMs = 10000
) {
  const body = JSON.stringify(eventEnvelope);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "synapstore-webhook/1.0",
    "X-Event": eventEnvelope.event ?? "unknown",
    "X-Timestamp": new Date().toISOString(),
    "X-Idempotency-Key": eventEnvelope.id ?? "",
  };
  if (secret) {
    headers["X-Signature"] = `sha256=${signWebhook(secret, body)}`;
  }

  const resp = await axios.post(url, body, {
    headers,
    timeout: timeoutMs,
    validateStatus: () => true, // we will interpret status codes ourselves
  });

  return {
    status: resp.status,
    data:
      typeof resp.data === "string"
        ? resp.data
        : JSON.stringify(resp.data).slice(0, 4096),
    headers: resp.headers,
  };
}
