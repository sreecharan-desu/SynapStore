// src/routes/v1/supplierRequests.ts
import { Router, Request, Response, NextFunction } from "express";
import prisma from "../../../lib/prisma";
import { authenticate } from "../../../middleware/authenticate";
import { RequestWithUser } from "../../../middleware/store";
import { z } from "zod";
import { sendMail } from "../../../lib/mailer";
import { sendSuccess, sendError, handleZodError, handlePrismaError, sendInternalError } from "../../../lib/api";

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
 * Description: Creates or updates a global supplier profile for the user.
 * Headers: 
 *  - Authorization: Bearer <token>
 * Body:
 *  - name: string (min 1 char)
 *  - address: string (optional)
 *  - phone: string (optional)
 *  - contactName: string (optional)
 *  - defaultLeadTime: number (optional)
 *  - defaultMOQ: number (optional)
 * Responses:
 *  - 201: { success: true, data: { supplier: { ... } } }
 *  - 400: Validation failed
 *  - 409: Supplier name already taken
 *  - 500: Internal server error
 */
router.post(
  "/global",
  authenticate,
  async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const parsed = supplierCreateSchema.safeParse(req.body);
      if (!parsed.success) {
        return handleZodError(res, parsed.error);
      }

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
            return sendError(res, "Supplier name already used by another profile", 409, { code: "name_taken" });
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
          .catch(() => { });
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

      return sendSuccess(res, "Supplier profile created/updated", { supplier }, 201);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /v1/suppliers/global
 * Description: Lists global suppliers with optional search query.
 * Headers: 
 *  - Authorization: Bearer <token>
 * Query Params:
 *  - q: string (search term for name or contactName)
 * Body: None
 * Responses:
 *  - 200: { success: true, data: { suppliers: [...] } }
 *  - 500: Internal server error
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
      return sendSuccess(res, "Global suppliers list", { suppliers });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /v1/suppliers/discovery
 * Description: Lists active stores for suppliers to discover.
 * Headers: 
 *  - Authorization: Bearer <token>
 * Body: None
 * Responses:
 *  - 200: { success: true, data: { stores: [...] } }
 *  - 500: Internal server error
 */
router.get(
  "/discovery",
  authenticate,
  async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      if (!user) return sendError(res, "Unauthenticated", 401);

      const supplier = await prisma.supplier.findFirst({
        where: { userId: user.id },
        select: { id: true },
      });

      if (!supplier) {
        // If the user is not linked to a supplier, they can't have linked stores.
        // Return all active stores for discovery.
        const stores = await prisma.store.findMany({
          where: {
            isActive: true,
          },
          select: {
            id: true,
            name: true,
            slug: true,
            currency: true,
            timezone: true,
          },
          take: 100,
        });
        return sendSuccess(res, "Store discovery list", { stores });
      }

      const supplierId = supplier.id;

      const stores = await prisma.store.findMany({
        where: {
          isActive: true,
          // Exclude stores that show up in SupplierStore (already linked)
          supplierStores: {
            none: {
              supplierId: supplierId,
            },
          },
          // Exclude stores that show up in SupplierRequest (pending or accepted)
          supplierRequests: {
            none: {
              supplierId: supplierId,
              status: { in: ["PENDING", "ACCEPTED"] },
            },
          },
          // Exclude stores where the current user is a member (e.g. owner)
          users: {
            none: {
              userId: user.id,
            },
          },
        },
        select: {
          id: true,
          name: true,
          slug: true,
          currency: true,
          timezone: true,
        },
        take: 100,
      });
      return sendSuccess(res, "Store discovery list", { stores });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /v1/suppliers
 * Description: Creates a new supplier request for a store.
 * Headers: 
 *  - Authorization: Bearer <token> (Role: SUPPLIER)
 * Body:
 *  - storeId: string (UUID)
 *  - supplierId: string (UUID)
 *  - message: string (optional)
 * Responses:
 *  - 201: { success: true, data: { request: { ... } } }
 *  - 400: Validation failed
 *  - 401: Unauthenticated
 *  - 403: Not a supplier
 *  - 404: Store or Supplier not found
 *  - 409: Request already exists
 *  - 500: Internal server error
 */
router.post(
  "/",
  authenticate,
  async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const parsed = createReqSchema.safeParse(req.body);
      if (!parsed.success) return handleZodError(res, parsed.error);

      const user = req.user!;
      if (!user) return sendError(res, "Unauthenticated", 401);
      if (user.globalRole !== "SUPPLIER") return sendError(res, "Only suppliers can perform this action", 403, { code: "only_supplier" });

      const { storeId, supplierId, message } = parsed.data;

      const store = await prisma.store.findUnique({
        where: { id: storeId },
        select: { id: true, name: true },
      });
      if (!store) return sendError(res, "Store not found", 404);

      const supplier = await prisma.supplier.findUnique({
        where: { id: supplierId },
      });
      if (!supplier) return sendError(res, "Supplier not found", 404);

      // prevent duplicate pending requests
      const existing = await prisma.supplierRequest.findFirst({
        where: { supplierId, storeId, status: "PENDING" },
      });
      if (existing) return sendError(res, "Connection request already pending", 409, { code: "already_requested" });

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
        // Email is already decrypted by Prisma extension
        const adminEmail = admin.user.email;
        if (adminEmail) {


          // Send actual email
          try {
            await sendMail({
              to: adminEmail!,
              subject: `New Supplier Request: ${supplier.name}`,
              text: `Hello,\n\nA new supplier request has been received from ${supplier.name}.\n\nMessage: ${message ?? "No message"
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
        .catch(() => { });

      return sendSuccess(res, "Supplier request sent", { request: reqRow }, 201);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /v1/suppliers
 * Description: Gets supplier details and their requests.
 * Headers: 
 *  - Authorization: Bearer <token>
 * Query Params:
 *  - supplierId: string (UUID)
 * Body: None
 * Responses:
 *  - 200: { success: true, data: { supplier: { ... }, requests: [...] } }
 *  - 500: Internal server error
 */
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
      return sendSuccess(res, "Supplier details retrieved", { supplier, requests });
    } catch (err) {
      next(err);
    }
  }
);






export default router;
