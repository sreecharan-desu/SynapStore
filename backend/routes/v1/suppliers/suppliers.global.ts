// src/routes/v1/suppliers.global.ts
import { Router, Request, Response, NextFunction } from "express";
import prisma from "../../../lib/prisma";
import { authenticate } from "../../../middleware/authenticate";
import { z } from "zod";
import { RequestWithUser } from "../../../middleware/store";

const router = Router();

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

      // attempt to find an existing global supplier by name (case-insensitive)
      const existing = await prisma.supplier.findFirst({
        where: { name: { equals: payload.name, mode: "insensitive" } },
      });

      let supplier;
      if (existing) {
        // optionally attach user if not mapped
        if (!existing.userId && user?.id) {
          supplier = await prisma.supplier.update({
            where: { id: existing.id },
            data: {
              address: payload.address ?? existing.address ?? undefined,
              phone: payload.phone ?? existing.phone ?? undefined,
              contactName:
                payload.contactName ?? existing.contactName ?? undefined,
              defaultLeadTime:
                payload.defaultLeadTime ??
                existing.defaultLeadTime ??
                undefined,
              defaultMOQ:
                payload.defaultMOQ ?? existing.defaultMOQ ?? undefined,
              userId: user.id,
            },
          });
        } else {
          supplier = await prisma.supplier.update({
            where: { id: existing.id },
            data: {
              address: payload.address ?? existing.address ?? undefined,
              phone: payload.phone ?? existing.phone ?? undefined,
              contactName:
                payload.contactName ?? existing.contactName ?? undefined,
              defaultLeadTime:
                payload.defaultLeadTime ??
                existing.defaultLeadTime ??
                undefined,
              defaultMOQ:
                payload.defaultMOQ ?? existing.defaultMOQ ?? undefined,
            },
          });
        }
      } else {
        // create new global supplier (storeId left null)
        supplier = await prisma.supplier.create({
          data: {
            name: payload.name,
            address: payload.address ?? undefined,
            phone: payload.phone ?? undefined,
            contactName: payload.contactName ?? undefined,
            defaultLeadTime: payload.defaultLeadTime ?? undefined,
            defaultMOQ: payload.defaultMOQ ?? undefined,
            userId: user?.id ?? undefined,
          },
        });
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
      if (user?.id && (supplier.userId === user.id) && user.globalRole !== "SUPPLIER" && user.globalRole !== "SUPERADMIN") {
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

export default router;
