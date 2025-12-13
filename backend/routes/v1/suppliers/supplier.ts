// src/routes/v1/supplierRequests.ts
import { Router, Request, Response, NextFunction } from "express";
import prisma from "../../../lib/prisma";
import { authenticate } from "../../../middleware/authenticate";
import { RequestWithUser } from "../../../middleware/store";
import { z } from "zod";
import { sendMail } from "../../../lib/mailer";
import { getSupplierRequestEmailTemplate, getNotificationEmailTemplate, getDisconnectionEmailTemplate } from "../../../lib/emailTemplates";
import { sendSuccess, sendError, handleZodError, handlePrismaError, sendInternalError } from "../../../lib/api";
import { notificationQueue } from "../../../lib/queue";

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

      const user:any = req.user!;
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

      // EMAIL NOTIFICATION: Supplier Profile Update
      if (user.email) {
          sendMail({
            to: user.email,
            subject: "Supplier Profile Updated",
            html: getNotificationEmailTemplate(
              "Supplier Profile Updated",
              `Your supplier profile for "<strong>${supplier.name}</strong>" has been successfully saved.<br/><br/>
               You can now manage your catalog and connection requests.`
            ),
          }).catch(e => console.error("Failed to send supplier profile update email", e));
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

      // notify store owners/admins via EMAIL only
      const storeAdmins = await prisma.userStoreRole.findMany({
        where: {
          storeId,
          role: { in: ["STORE_OWNER", "ADMIN"] },
        },
        include: { user: { select: { id: true, email: true } } },
      });

      for (const admin of storeAdmins) {
        const adminEmail = admin.user.email;
        if (adminEmail) {
          try {
            await sendMail({
              to: adminEmail!,
              subject: `New Supplier Request: ${supplier.name}`,
              html: getSupplierRequestEmailTemplate(supplier.name, message),
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

      // Notify Store Admins via Push
      // Notify Store Admins via Push removed as per requirement (only Email now)


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
        select: {
          id: true,
          createdAt: true,
          createdById: true,
          message: true,
          status: true,
          storeId: true,
          supplierId: true,
          updatedAt : true,
          store: {
            select: {
              name : true
            }
          }
        }
      });
      return sendSuccess(res, "Supplier details retrieved", { supplier, requests });
    } catch (err) {
      next(err);
    }
  }
);






/**
 * DELETE /v1/suppliers/requests/:requestId
 * Description: Supplier cancels a pending request.
 */
router.delete(
  "/requests/:requestId",
  authenticate,
  async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
        const { requestId } = req.params;
        const user = req.user!;
        const supplier = await prisma.supplier.findUnique({ where: { userId: user.id } });
        
        if (!supplier) return sendError(res, "Supplier profile not found", 404);

        const request = await prisma.supplierRequest.findUnique({ where: { id: requestId } });
        if (!request) return sendError(res, "Request not found", 404);

        if (request.supplierId !== supplier.id) return sendError(res, "Unauthorized", 403);
        
        // Only allow cancelling PENDING requests? Or any?
        // If ACCEPTED, cancelling probably doesn't break connection (separate call).
        if (request.status !== "PENDING") return sendError(res, "Can only cancel pending requests", 400);

        await prisma.supplierRequest.delete({ where: { id: requestId } });
        
        return sendSuccess(res, "Request cancelled");
    } catch (err) {
        next(err);
    }
  }
);

/**
 * DELETE /v1/suppliers/stores/:storeId
 * Description: Supplier disconnects from a store.
 */
router.delete(
    "/stores/:storeId",
    authenticate,
    async (req: RequestWithUser, res: Response, next: NextFunction) => {
      try {
          const { storeId } = req.params;
          const user = req.user!;
          const supplier = await prisma.supplier.findUnique({ where: { userId: user.id } });
          
          if (!supplier) return sendError(res, "Supplier profile not found", 404);
  
          // Check connection
          const conn = await prisma.supplierStore.findUnique({
              where: {
                  supplierId_storeId: {
                      supplierId: supplier.id,
                      storeId
                  }
              }
          });
          
          if (!conn) return sendError(res, "Connection not found", 404);
  
          await prisma.supplierStore.delete({
              where: {
                  supplierId_storeId: {
                      supplierId: supplier.id,
                      storeId
                  } 
              }
          });
  
          // Notify Store Owner(s)
          const store = await prisma.store.findUnique({ where: { id: storeId } });
          if (store) {
            const owners = await prisma.userStoreRole.findMany({
                where: { storeId, role: { in: ["STORE_OWNER", "ADMIN"] } },
                include: { user: true }
            });
            for (const owner of owners) {
                if (owner.user.email) {
                    sendMail({
                        to: owner.user.email,
                        subject: `Connection Ended: ${supplier.name}`,
                        html: getDisconnectionEmailTemplate(supplier.name)
                    }).catch(e => console.error("Email failed", e));
                }
            }
          }

          return sendSuccess(res, "Disconnected from store");
      } catch (err) {
          next(err);
      }
    }
  );

export default router;
