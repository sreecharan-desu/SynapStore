// routes/v1/webhooks.ts
import { Router } from "express";
import { z } from "zod";
import crypto from "crypto";
import axios from "axios";
import prisma from "../../../lib/prisma";
import { authenticate } from "../../../middleware/authenticate";
import { storeContext, requireStore } from "../../../middleware/store";
import { requireRole } from "../../../middleware/requireRole";

const router = Router();
const respond = (res: any, status: number, body: object) =>
  res.status(status).json(body);

/* Schemas */
const createSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  secret: z.string().optional().nullable(),
  events: z.array(z.string()).min(1),
  isActive: z.boolean().optional().default(true),
});

const patchSchema = z.object({
  name: z.string().optional(),
  url: z.string().url().optional(),
  secret: z.string().optional().nullable(),
  events: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

/* middleware */
router.use(authenticate);
router.use(storeContext);
router.use(requireStore);

/**
 * GET /v1/stores/:id/webhooks
 * - allowed: STORE_OWNER, ADMIN
 */
router.get(
  "/:id/webhooks",
  requireRole(["STORE_OWNER", "ADMIN"]),
  async (req: any, res) => {
    try {
      const storeId = String(req.params.id);
      const items = await prisma.webhookRegistration.findMany({
        where: { storeId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          url: true,
          events: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      return respond(res, 200, { success: true, data: { items } });
    } catch (err) {
      console.error("GET /webhooks error:", err);
      return respond(res, 500, {
        success: false,
        error: "internal_server_error",
      });
    }
  }
);

/**
 * POST /v1/stores/:id/webhooks
 * - allowed: STORE_OWNER, ADMIN
 */
router.post(
  "/:id/webhooks",
  requireRole(["STORE_OWNER", "ADMIN"]),
  async (req: any, res) => {
    try {
      const parsed = createSchema.safeParse(req.body);
      if (!parsed.success) {
        const details = parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        }));
        return respond(res, 400, {
          success: false,
          error: "validation_failed",
          details,
        });
      }

      const storeId = String(req.params.id);
      const body = parsed.data;

      const created = await prisma.webhookRegistration.create({
        data: {
          storeId,
          name: body.name,
          url: body.url,
          secret: body.secret ?? undefined,
          events: body.events,
          isActive: body.isActive ?? true,
        },
      });

      return respond(res, 201, { success: true, data: created });
    } catch (err) {
      console.error("POST /webhooks error:", err);
      return respond(res, 500, {
        success: false,
        error: "internal_server_error",
      });
    }
  }
);

/**
 * PATCH /v1/stores/:id/webhooks/:registrationId
 * - allowed: STORE_OWNER, ADMIN
 */
router.patch(
  "/:id/webhooks/:registrationId",
  requireRole(["STORE_OWNER", "ADMIN"]),
  async (req: any, res) => {
    try {
      const parsed = patchSchema.safeParse(req.body);
      if (!parsed.success) {
        const details = parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        }));
        return respond(res, 400, {
          success: false,
          error: "validation_failed",
          details,
        });
      }

      const storeId = String(req.params.id);
      const regId = String(req.params.registrationId);

      const reg = await prisma.webhookRegistration.findUnique({
        where: { id: regId },
      });
      if (!reg || reg.storeId !== storeId)
        return respond(res, 404, {
          success: false,
          error: "webhook_not_found",
        });

      const updated = await prisma.webhookRegistration.update({
        where: { id: regId },
        data: {
          name: parsed.data.name ?? undefined,
          url: parsed.data.url ?? undefined,
          secret: parsed.data.secret ?? undefined,
          events: parsed.data.events ?? undefined,
          isActive: parsed.data.isActive ?? undefined,
        },
      });

      return respond(res, 200, { success: true, data: updated });
    } catch (err) {
      console.error("PATCH /webhooks/:id error:", err);
      return respond(res, 500, {
        success: false,
        error: "internal_server_error",
      });
    }
  }
);

/**
 * DELETE /v1/stores/:id/webhooks/:registrationId
 * - allowed: STORE_OWNER, ADMIN
 * - soft delete by setting isActive=false
 */
router.delete(
  "/:id/webhooks/:registrationId",
  requireRole(["STORE_OWNER", "ADMIN"]),
  async (req: any, res) => {
    try {
      const storeId = String(req.params.id);
      const regId = String(req.params.registrationId);

      const reg = await prisma.webhookRegistration.findUnique({
        where: { id: regId },
      });
      if (!reg || reg.storeId !== storeId)
        return respond(res, 404, {
          success: false,
          error: "webhook_not_found",
        });

      const updated = await prisma.webhookRegistration.update({
        where: { id: regId },
        data: { isActive: false },
      });
      return respond(res, 200, { success: true, data: updated });
    } catch (err) {
      console.error("DELETE /webhooks/:id error:", err);
      return respond(res, 500, {
        success: false,
        error: "internal_server_error",
      });
    }
  }
);

/**
 * POST /v1/webhooks/:registrationId/test
 * - allowed: STORE_OWNER, ADMIN
 * - triggers a test payload to the webhook URL and returns the delivery result
 * - signs payload using HMAC-SHA256 if secret is set
 */
router.post(
  "/:id/webhooks/:registrationId/test",
  requireRole(["STORE_OWNER", "ADMIN"]),
  async (req: any, res) => {
    try {
      const storeId = String(req.params.id);
      const regId = String(req.params.registrationId);

      const reg = await prisma.webhookRegistration.findUnique({
        where: { id: regId },
      });
      if (!reg || reg.storeId !== storeId)
        return respond(res, 404, {
          success: false,
          error: "webhook_not_found",
        });

      const payload = {
        type: "webhook_test",
        timestamp: new Date().toISOString(),
        registrationId: regId,
        storeId,
        message: "This is a test delivery from SynapStore",
      };

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (reg.secret) {
        const bodyString = JSON.stringify(payload);
        const sig = crypto
          .createHmac("sha256", reg.secret)
          .update(bodyString)
          .digest("hex");
        headers["x-webhook-signature"] = `sha256=${sig}`;
      }

      // Attempt delivery with 8s timeout
      try {
        const resp = await axios.post(reg.url, payload, {
          headers,
          timeout: 8000,
        });
        // store a small registration-level provider response for audit
        await prisma.activityLog.create({
          data: {
            storeId,
            action: "WEBHOOK_TEST",
            payload: {
              registrationId: regId,
              status: resp.status,
              statusText: resp.statusText,
            },
          },
        });

        return respond(res, 200, {
          success: true,
          data: { status: resp.status, data: resp.data },
        });
      } catch (err: any) {
        console.error("Webhook test delivery failed:", err?.message ?? err);
        await prisma.activityLog.create({
          data: {
            storeId,
            action: "WEBHOOK_TEST_FAILED",
            payload: {
              registrationId: regId,
              error: String(err?.message ?? err),
            },
          },
        });

        return respond(res, 502, {
          success: false,
          error: "delivery_failed",
          details: String(err?.message ?? err),
        });
      }
    } catch (err) {
      console.error("POST /webhooks/:id/test error:", err);
      return respond(res, 500, {
        success: false,
        error: "internal_server_error",
      });
    }
  }
);

export default router;
