// src/routes/v1/inventory.ts
import { Router, Request, Response } from "express";
import prisma from "../../../lib/prisma";
import { authenticate } from "../../../middleware/authenticate";
import { storeContext, requireStore, RequestWithUser } from "../../../middleware/store";

import { z } from "zod";
import { sendMail } from "../../../lib/mailer";
import { crypto$ } from "../../../lib/crypto";

const router = Router();

// Minimal schema for initiating an upload
const initUploadSchema = z.object({
  filename: z.string().optional(),
  metadata: z.any().optional(),
});

/**
 * POST /v1/inventory/upload-init
 * Creates a placeholder Upload record in PENDING state.
 * Expected to be called before the user/ML service starts processing or just to track the event.
 */
router.post(
  "/upload-init",
  authenticate,
  storeContext,
  requireStore,
  async (req: RequestWithUser, res: Response) => {
    try {
      const parsed = initUploadSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "invalid_input", details: parsed.error.issues });
      }
      const store = req.store!;
      
      const upload = await prisma.upload.create({
        data: {
          storeId: store.id,
          // @ts-ignore
          filename: parsed.data.filename ?? null,
          status: "PENDING",
          metadata: parsed.data.metadata ?? {},
        },
      });

      return res.json({ success: true, uploadId: upload.id, status: upload.status });
    } catch (err) {
      console.error("upload-init error:", err);
      return res.status(500).json({ error: "server_error" });
    }
  }
);

/**
 * GET /v1/inventory/upload/:id
 * Poll status of an upload.
 */
router.get(
  "/upload/:id",
  authenticate,
  storeContext,
  requireStore,
  async (req: RequestWithUser, res: Response) => {
    try {
      const { id } = req.params;
      const store = req.store!;

      const upload :any= await prisma.upload.findUnique({
        where: { id },
      });

      if (!upload || upload.storeId !== store.id) {
        return res.status(404).json({ error: "upload_not_found" });
      }

      return res.json({
        success: true,
        status: upload.status,
        metadata: upload.metadata,
        updatedAt: upload.updatedAt
      });
    } catch (err) {
      console.error("get-upload error:", err);
      return res.status(500).json({ error: "server_error" });
    }
  }
);

// Optional: allow client to update status if they are the ones handling it? 
// Or assumed ML service writes to DB directly. If ML service uses API:
router.patch(
    "/upload/:id/status",
    authenticate,
    storeContext,
    requireStore,
    async (req: RequestWithUser, res: Response) => {
      try {
        const { id } = req.params;
        const { status, metadata } = req.body;
        const store = req.store!;

        // Basic validation of status
        const validStatuses = ["PENDING", "PROCESSING", "PREVIEW_READY", "APPLIED", "FAILED"];
        if (status && !validStatuses.includes(status)) {
             return res.status(400).json({ error: "invalid_status" });
        }

        const upload = await prisma.upload.findUnique({ where: { id } });
        if (!upload || upload.storeId !== store.id) {
             return res.status(404).json({ error: "not_found" });
        }

        const previousStatus = upload.status;

        const updated = await prisma.upload.update({
            where: { id },
            data: {
              status: status ?? undefined,
              // @ts-ignore
                metadata: metadata ?? undefined
            }
        });

        // If status changed to APPLIED, trigger receipt email
        if (status === "APPLIED" && previousStatus !== "APPLIED") {
             const owners = await prisma.userStoreRole.findMany({
               where: { storeId: store.id, role: { in: ["STORE_OWNER", "ADMIN"] } },
               include: { user: { select: { email: true, username: true } } }
             });
             
             // @ts-ignore
             const meta = metadata || upload.metadata || upload.preview || {};
             const emailSubject = `Inventory Receipt: Upload ${upload.filename || upload.id}`;
             const emailBody = `Your inventory upload has been successfully applied.\n\nDetails:\n${JSON.stringify(meta, null, 2)}`;

             for (const owner of owners) {
                 const email = crypto$.decryptCell(owner.user.email);
                 if (email) {
                    await sendMail({
                        to: email,
                        subject: emailSubject,
                        text: emailBody
                    }).catch(console.error);
                 }
             }
             
             // Log
             await prisma.activityLog.create({
                 data: {
                   storeId: store.id,
                   userId: req.user?.id,
                   action: "inventory_receipt_generated",
                   payload: { uploadId: upload.id }
                 }
             }).catch(() => {});
        }
        
        return res.json({ success: true, upload: updated });
      } catch (err) {
        return res.status(500).json({ error: "server_error" });
      }
    }
);

export default router;
