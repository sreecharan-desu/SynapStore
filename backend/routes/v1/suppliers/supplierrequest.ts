// src/routes/v1/supplierRequests.ts
import { Router, Request, Response, NextFunction } from "express";
import prisma from "../../../lib/prisma";
import { authenticate } from "../../../middleware/authenticate";
import {
  storeContext,
  requireStore,
  RequestWithUser,
} from "../../../middleware/store";
import { z } from "zod";
import { requireRole } from "../../../middleware/requireRole"; // your requireRole file
import { sendMail } from "../../../lib/mailer";
import { crypto$ } from "../../../lib/crypto";

const router = Router();

const createReqSchema = z.object({
  storeId: z.string().uuid(),
  supplierId: z.string().uuid(),
  message: z.string().optional(),
});

/**
 * POST /v1/supplier-requests
 * - Authenticated user with globalRole SUPPLIER creates a request for a store
 */
router.post(
  "/",
  authenticate,
  async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const parsed = createReqSchema.safeParse(req.body);
      if (!parsed.success)
        return res.status(400).json({
          success: false,
          error: "validation_failed",
          details: parsed.error.issues,
        });

      const user = req.user!;
      if (!user)
        return res
          .status(401)
          .json({ success: false, error: "unauthenticated" });
      if (user.globalRole !== "SUPPLIER")
        return res.status(403).json({ success: false, error: "only_supplier" });

      const { storeId, supplierId, message } = parsed.data;

      const store = await prisma.store.findUnique({
        where: { id: storeId },
        select: { id: true, name: true },
      });
      if (!store)
        return res
          .status(404)
          .json({ success: false, error: "store_not_found" });

      const supplier = await prisma.supplier.findUnique({
        where: { id: supplierId },
      });
      if (!supplier)
        return res
          .status(404)
          .json({ success: false, error: "supplier_not_found" });

      // prevent duplicate pending requests
      const existing = await prisma.supplierRequest.findFirst({
        where: { supplierId, storeId, status: "PENDING" },
      });
      if (existing)
        return res
          .status(409)
          .json({ success: false, error: "already_requested" });

      const reqRow = await prisma.supplierRequest.create({
        data: {
          supplierId,
          storeId,
          message: message ?? undefined,
          createdById: user.id,
        },
      });

      // notify store owners/admins (create Notification row)
      // notify store owners/admins via IN_APP and EMAIL
      
      // 1. IN_APP to store room (generic "store_admins")
      await prisma.notification.create({
        data: {
          storeId,
          channel: "IN_APP",
          recipient: "store_admins", // socket worker will broadcast to store room
          subject: "Supplier Request",
          body: message ?? `Supplier ${supplier.name} requested access`,
          metadata: {
            supplierRequestId: reqRow.id,
            supplierId,
            supplierName: supplier.name,
          },
          status: "QUEUED",
        },
      });

      // 2. EMAIL to specific store owners/admins
      const storeAdmins = await prisma.userStoreRole.findMany({
        where: {
          storeId,
          role: { in: ["STORE_OWNER", "ADMIN"] },
        },
        include: { user: { select: { id: true, email: true } } },
      });

      for (const admin of storeAdmins) {
        let adminEmail = admin.user.email;
        if (adminEmail) {
          // Attempt to decrypt if it looks encrypted (helper usually returns null if fail, but let's be safe)
          // Actually, we should just try decrypt. If it returns null, maybe it wasn't encrypted?
          // But our system encrypts emails.
          const decrypted = crypto$.decryptCell(adminEmail);
          if (decrypted) adminEmail = decrypted;

          await prisma.notification.create({
            data: {
              storeId,
              userId: admin.userId,
              channel: "EMAIL",
              recipient: adminEmail!,
              subject: `New Supplier Request: ${supplier.name}`,
              body: `A new supplier request has been received from ${supplier.name}.\n\nMessage: ${
                message ?? "No message"
              }\n\nPlease log in to accept or reject.`,
              status: "SENT", // we are sending it now
            },
          });

          // Send actual email
          try {
            await sendMail({
              to: adminEmail!,
              subject: `New Supplier Request: ${supplier.name}`,
              text: `Hello,\n\nA new supplier request has been received from ${supplier.name}.\n\nMessage: ${
                message ?? "No message"
              }\n\nPlease log in to your dashboard to accept or reject this request.`,
            });
          } catch (e) {
            console.error("Failed to send email to store admin:", e);
          }
        }
      }

      await prisma.activityLog
        .create({
          data: {
            storeId,
            userId: user.id,
            action: "supplier_request_created",
            payload: { requestId: reqRow.id, supplierId },
          },
        })
        .catch(() => {});

      return res.status(201).json({ success: true, data: { request: reqRow } });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /v1/supplier-requests?storeId=
 * - If storeId provided and caller has storeContext + requireStore, return requests for that store
 * - Otherwise if user is supplier, return their requests
 */
router.get(
  "/",
  authenticate,
  async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const storeIdQuery =
        typeof req.query.storeId === "string" ? req.query.storeId : undefined;
      const user = req.user!;
      // If storeId provided: ensure user is part of store (storeContext can be used by client)
      if (storeIdQuery) {
        // lightweight check: query store roles
        const hasAccess = await prisma.userStoreRole.findFirst({
          where: { userId: user.id, storeId: storeIdQuery },
        });
        if (!hasAccess && user.globalRole !== "SUPERADMIN")
          return res
            .status(403)
            .json({ success: false, error: "insufficient_role" });

        const rows = await prisma.supplierRequest.findMany({
          where: { storeId: storeIdQuery },
          orderBy: [{ status: "asc" }, { createdAt: "desc" }],
          include: { supplier: true },
          take: 200,
        });
        return res.json({ success: true, data: { requests: rows } });
      }

      // else supply-side: return requests created by supplier user (use supplier.userId mapping if exists)
      // find supplier profiles mapped to this user
      const supplierRows = await prisma.supplier.findMany({
        where: { userId: user.id },
        select: { id: true },
      });
      const supplierIds = supplierRows.map((s) => s.id);
      const queries = [];

      if (supplierIds.length) {
        const rows = await prisma.supplierRequest.findMany({
          where: { supplierId: { in: supplierIds } },
          orderBy: { createdAt: "desc" },
          take: 200,
          include: { store: true },
        });
        return res.json({ success: true, data: { requests: rows } });
      }

      return res.json({ success: true, data: { requests: [] } });
    } catch (err) {
      next(err);
    }
  }
);



// STORE OWNER ACCEPT AND REJECT REQUEST

/**
 * POST /v1/supplier-requests/:id/accept
 * - storeContext + requireStore required (owner/admin role)
 */
router.post(
  "/:id/accept",
  authenticate,
  storeContext,
  requireStore,
  requireRole(["STORE_OWNER", "ADMIN"]),
  async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const id = String(req.params.id);
      const store = req.store!;
      const user = req.user!;

      const reqRow = await prisma.supplierRequest.findUnique({ where: { id } });
      if (!reqRow || reqRow.storeId !== store.id)
        return res
          .status(404)
          .json({ success: false, error: "request_not_found" });

      if (reqRow.status !== "PENDING")
        return res.status(400).json({ success: false, error: "invalid_state" });

      await prisma.$transaction([
        prisma.supplierRequest.update({
          where: { id },
          data: { status: "ACCEPTED" },
        }),
        prisma.supplierStore.upsert({
          where: {
            supplierId_storeId: {
              supplierId: reqRow.supplierId,
              storeId: store.id,
            },
          },
          create: {
            supplierId: reqRow.supplierId,
            storeId: store.id,
            linkedAt: new Date(),
          },
          update: { linkedAt: new Date() },
        }),
        prisma.activityLog.create({
          data: {
            storeId: store.id,
            userId: user.id,
            action: "supplier_request_accepted",
            payload: { requestId: id, supplierId: reqRow.supplierId },
          },
        }),
      ]);

      // notify supplier (if supplier.userId exists)
      const sup = await prisma.supplier.findUnique({
        where: { id: reqRow.supplierId },
      });
      if (sup?.userId) {
        // IN_APP
        await prisma.notification.create({
          data: {
            storeId: store.id,
            userId: sup.userId,
            channel: "IN_APP",
            recipient: sup.userId,
            subject: "Supplier request accepted",
            body: `Your request to supply ${store.name} was accepted`,
            metadata: { supplierRequestId: id },
            status: "QUEUED",
          },
        });

        // EMAIL - need to fetch user email (encrypted?)
        const supUser = await prisma.user.findUnique({
          where: { id: sup.userId },
          select: { email: true },
        });
        if (supUser?.email) {
          let supEmail = crypto$.decryptCell(supUser.email);
          if (supEmail) {
            await prisma.notification.create({
              data: {
                storeId: store.id,
                userId: sup.userId,
                channel: "EMAIL",
                recipient: supEmail,
                subject: "Request Accepted!",
                body: `Good news! Your request to supply ${store.name} has been accepted. You can now engage with this store.`,
                status: "SENT",
              },
            });

            try {
              await sendMail({
                to: supEmail,
                subject: `Request Accepted: ${store.name}`,
                text: `Good news!\n\nYour request to supply ${store.name} has been accepted. You can now engage with this store.`,
              });
            } catch (e) {
              console.error("Failed to send email to supplier:", e);
            }
          }
        }
      }

      return res.json({ success: true, message: "accepted" });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /v1/supplier-requests/:id/reject
 */
router.post(
  "/:id/reject",
  authenticate,
  storeContext,
  requireStore,
  requireRole(["STORE_OWNER", "ADMIN"]),
  async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const id = String(req.params.id);
      const store = req.store!;
      const user = req.user!;

      const reqRow = await prisma.supplierRequest.findUnique({ where: { id } });
      if (!reqRow || reqRow.storeId !== store.id)
        return res
          .status(404)
          .json({ success: false, error: "request_not_found" });

      if (reqRow.status !== "PENDING")
        return res.status(400).json({ success: false, error: "invalid_state" });

      await prisma.supplierRequest.update({
        where: { id },
        data: { status: "REJECTED" },
      });
      await prisma.activityLog.create({
        data: {
          storeId: store.id,
          userId: user.id,
          action: "supplier_request_rejected",
          payload: { requestId: id },
        },
      });

      const sup = await prisma.supplier.findUnique({
        where: { id: reqRow.supplierId },
      });
      if (sup?.userId) {
        // IN_APP
        await prisma.notification.create({
          data: {
            storeId: store.id,
            userId: sup.userId,
            channel: "IN_APP",
            recipient: sup.userId,
            subject: "Supplier request rejected",
            body: `Request rejected for ${store.name}`,
            metadata: { supplierRequestId: id },
            status: "QUEUED",
          },
        });

        // EMAIL
        const supUser = await prisma.user.findUnique({
          where: { id: sup.userId },
          select: { email: true },
        });
        if (supUser?.email) {
          let supEmail = crypto$.decryptCell(supUser.email);
          if (supEmail) {
            await prisma.notification.create({
              data: {
                storeId: store.id,
                userId: sup.userId,
                channel: "EMAIL",
                recipient: supEmail, // store plain email in notification log for visibility? Or keep encrypted? Usually logs have plain.
                subject: `Supplier Request Rejected`,
                body: `Your request to supply ${store.name} was not accepted at this time.`,
                status: "SENT",
              },
            });

            try {
              await sendMail({
                to: supEmail,
                subject: `Request Update: ${store.name}`,
                text: `Hello,\n\nYour request to supply ${store.name} was not accepted at this time.`,
              });
            } catch (e) {
              console.error("Failed to send email to supplier:", e);
            }
          }
        }
      }

      return res.json({ success: true, message: "rejected" });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
