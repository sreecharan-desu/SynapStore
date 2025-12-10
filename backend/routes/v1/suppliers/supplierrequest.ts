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
 * Body for global supplier profile
 */
const supplierCreateSchema = z.object({
  name: z.string().min(1),
  address: z.string().optional(),
  phone: z.string().optional(),
  contactName: z.string().optional(),
  defaultLeadTime: z.number().int().optional(),
  defaultMOQ: z.number().int().optional(),
});

/**
 * POST /v1/suppliers/global
 * - Authenticated user (preferably globalRole === "SUPPLIER", but we allow admin to create too)
 * - Upsert a global Supplier row (storeId null)
 * - Optionally attach the user to the supplier (supplier.userId = user.id) if not already set
 */
router.post(
  "/global",
  authenticate,
  async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const parsed = supplierCreateSchema.safeParse(req.body);
      if (!parsed.success)
        return res.status(400).json({
          success: false,
          error: "validation_failed",
          details: parsed.error.issues,
        });

      const user = req.user!;
      const payload = parsed.data;

      // 1. Check if user is already associated with a supplier (prioritize this to allow profile updates)
      let supplier = await prisma.supplier.findUnique({
        where: { userId: user.id },
      });

      if (supplier) {
        // User is already linked. This is an update to their own profile.
        // Check for name conflict if renaming
        if (supplier.name.toLowerCase() !== payload.name.toLowerCase()) {
          const conflict = await prisma.supplier.findFirst({
            where: {
              name: { equals: payload.name, mode: "insensitive" },
              id: { not: supplier.id },
            },
          });
          if (conflict) {
            return res.status(409).json({
              success: false,
              error: "name_taken",
              details: [
                {
                  code: "custom",
                  message: "Supplier name already used by another profile.",
                  path: ["name"],
                },
              ],
            });
          }
        }

        supplier = await prisma.supplier.update({
          where: { id: supplier.id },
          data: {
            name: payload.name,
            address: payload.address ?? undefined,
            phone: payload.phone ?? undefined,
            contactName: payload.contactName ?? undefined,
            defaultLeadTime: payload.defaultLeadTime ?? undefined,
            defaultMOQ: payload.defaultMOQ ?? undefined,
            // userId already set
          },
        });
      } else {
        // User not linked. Check if supplier exists by name
        const existingByName = await prisma.supplier.findFirst({
          where: { name: { equals: payload.name, mode: "insensitive" } },
        });

        if (existingByName) {
          // Update existing found by name.
          // Link user if the found supplier is not yet linked to anyone.
          const shouldLink = !existingByName.userId;

          supplier = await prisma.supplier.update({
            where: { id: existingByName.id },
            data: {
              name: payload.name, // update casing if needed
              address: payload.address ?? undefined,
              phone: payload.phone ?? undefined,
              contactName: payload.contactName ?? undefined,
              defaultLeadTime: payload.defaultLeadTime ?? undefined,
              defaultMOQ: payload.defaultMOQ ?? undefined,
              userId: shouldLink ? user.id : undefined,
            },
          });
        } else {
          // Create new global supplier
          supplier = await prisma.supplier.create({
            data: {
              name: payload.name,
              address: payload.address ?? undefined,
              phone: payload.phone ?? undefined,
              contactName: payload.contactName ?? undefined,
              defaultLeadTime: payload.defaultLeadTime ?? undefined,
              defaultMOQ: payload.defaultMOQ ?? undefined,
              userId: user.id,
            },
          });
        }
      }

      // activity log
      if (req.user?.id && supplier?.id) {
        await prisma.activityLog
          .create({
            data: {
              storeId: "",
              userId: req.user.id,
              action: "supplier_profile_created_or_updated",
              payload: { supplierId: supplier.id },
            },
          })
          .catch(() => {});
      }

      // If we linked a user to this supplier, ensure the user has globalRole="SUPPLIER"
      if (
        user?.id &&
        supplier.userId === user.id &&
        user.globalRole !== "SUPPLIER" &&
        user.globalRole !== "SUPERADMIN"
      ) {
        await prisma.user.update({
          where: { id: user.id },
          data: { globalRole: "SUPPLIER" },
        });
      }

      return res.status(201).json({ success: true, data: { supplier } });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /v1/suppliers/global
 * - list global suppliers (search q)
 */
router.get(
  "/global",
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
      const where = q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { contactName: { contains: q, mode: "insensitive" } },
            ],
          }
        : {};
      const suppliers = await prisma.supplier.findMany({
        // @ts-ignore
        where: { ...where },
        orderBy: { name: "asc" },
        take: 100,
      });
      return res.json({ success: true, data: { suppliers } });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /v1/suppliers/discovery
 * - Authenticated user can see list of active stores
 */
router.get(
  "/discovery",
  authenticate,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const stores = await prisma.store.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          slug: true,
          currency: true,
          timezone: true,
        },
        take: 100,
      });
      return res.json({ success: true, data: { stores } });
    } catch (err) {
      next(err);
    }
  }
);

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

router.get(
  "/",
  authenticate,
  async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
  
      const supplierId =
        typeof req.query.supplierId === "string"
          ? req.query.supplierId
          : undefined;

      const supplier = await prisma.supplier.findUnique({
        where: { id: supplierId },
      });

      const requests = await prisma.supplierRequest.findMany({
        where: { supplierId },
      });
      return res.json({ success: true, data: { supplier, requests } });
    } catch (err) {
      next(err);
    }
  }
);






export default router;
