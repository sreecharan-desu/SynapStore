// routes/v1/suppliers.ts
import { Router } from "express";
import { z } from "zod";
import prisma from "../../../lib/prisma";
import { authenticate } from "../../../middleware/authenticate";
import { storeContext, requireStore } from "../../../middleware/store";
import { requireRole } from "../../../middleware/requireRole";

const router = Router();
const respond = (res: any, status: number, body: object) =>
  res.status(status).json(body);

/* -----------------------
   Validation schemas
   ----------------------- */
const createSupplierSchema = z.object({
  name: z.string().min(1, "name is required"),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  contactName: z.string().optional().nullable(),
  defaultLeadTime: z.number().int().nonnegative().optional().nullable(),
  defaultMOQ: z.number().int().nonnegative().optional().nullable(),
  externalMeta: z.any().optional().nullable(),
  userId: z.string().uuid().optional().nullable(),
});

const patchSupplierSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  contactName: z.string().optional().nullable(),
  defaultLeadTime: z.number().int().nonnegative().optional().nullable(),
  defaultMOQ: z.number().int().nonnegative().optional().nullable(),
  externalMeta: z.any().optional().nullable(),
  userId: z.string().uuid().optional().nullable(),
  isActive: z.boolean().optional(),
});

const listQuerySchema = z.object({
  q: z.string().optional(),
  limit: z.coerce.number().optional(),
  offset: z.coerce.number().optional(),
  includeInactive: z.coerce.boolean().optional(),
});

/* -----------------------
   Middleware chain
   ----------------------- */
router.use(authenticate);
router.use(storeContext);
router.use(requireStore);

/* -----------------------
   Routes
   ----------------------- */

/**
 * GET /v1/stores/:id/suppliers
 * - allowed: any authenticated user with store context
 * - query: q (search name/contactName/phone), limit, offset, includeInactive
 */
router.get("/:id/suppliers", async (req: any, res) => {
  try {
    const storeId = String(req.params.id);
    const qRaw = typeof req.query.q === "string" ? req.query.q.trim() : null;
    const limit = Math.min(Math.max(Number(req.query.limit ?? 50), 1), 200);
    const offset = Math.max(Number(req.query.offset ?? 0), 0);
    const includeInactive =
      req.query.includeInactive === "true" ||
      req.query.includeInactive === true;

    const where: any = { storeId };
    if (!includeInactive) where.isActive = true;
    if (qRaw) {
      const q = qRaw;
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { contactName: { contains: q, mode: "insensitive" } },
        { phone: { contains: q, mode: "insensitive" } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.supplier.findMany({
        where,
        orderBy: { name: "asc" },
        take: limit,
        skip: offset,
        select: {
          id: true,
          name: true,
          address: true,
          phone: true,
          contactName: true,
          defaultLeadTime: true,
          defaultMOQ: true,
          externalMeta: true,
          userId: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.supplier.count({ where }),
    ]);

    return respond(res, 200, {
      success: true,
      data: { items, total, limit, offset },
    });
  } catch (err) {
    console.error("GET /stores/:id/suppliers error:", err);
    return respond(res, 500, {
      success: false,
      error: "internal_server_error",
    });
  }
});

/**
 * POST /v1/stores/:id/suppliers
 * - allowed: STORE_OWNER, ADMIN
 */
router.post(
  "/:id/suppliers",
  requireRole(["STORE_OWNER", "ADMIN"]),
  async (req: any, res) => {
    try {
      const parsed = createSupplierSchema.safeParse(req.body);
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
      const data = parsed.data;

      // If userId provided, ensure user exists and isn't already mapped to a different supplier (unique constraint)
      if (data.userId) {
        const user = await prisma.user.findUnique({
          where: { id: data.userId },
          select: { id: true, isActive: true },
        });
        if (!user)
          return respond(res, 404, { success: false, error: "user_not_found" });

        const existingMapping = await prisma.supplier.findFirst({
          where: { userId: data.userId },
        });
        if (existingMapping)
          return respond(res, 409, {
            success: false,
            error: "user_already_mapped_to_supplier",
          });
      }

      try {
        const created = await prisma.supplier.create({
          data: {
            storeId,
            name: data.name,
            address: data.address ?? undefined,
            phone: data.phone ?? undefined,
            contactName: data.contactName ?? undefined,
            defaultLeadTime: data.defaultLeadTime ?? undefined,
            defaultMOQ: data.defaultMOQ ?? undefined,
            externalMeta: data.externalMeta ?? undefined,
            userId: data.userId ?? undefined,
          },
        });

        return respond(res, 201, { success: true, data: created });
      } catch (pErr: any) {
        console.error("Prisma create supplier error:", pErr);
        if (pErr?.code === "P2002") {
          return respond(res, 409, {
            success: false,
            error: "unique_constraint_failed",
          });
        }
        return respond(res, 502, { success: false, error: "database_error" });
      }
    } catch (err) {
      console.error("POST /stores/:id/suppliers error:", err);
      return respond(res, 500, {
        success: false,
        error: "internal_server_error",
      });
    }
  }
);

/**
 * GET /v1/stores/:id/suppliers/:supplierId
 * - allowed: any authenticated user with store context (supplier visibility can be restricted later)
 */
router.get("/:id/suppliers/:supplierId", async (req: any, res) => {
  try {
    const storeId = String(req.params.id);
    const supplierId = String(req.params.supplierId);

    const supplier: any = await prisma.supplier.findUnique({
      where: { id: supplierId },
      select: {
        id: true,
        name: true,
        address: true,
        phone: true,
        contactName: true,
        defaultLeadTime: true,
        defaultMOQ: true,
        externalMeta: true,
        userId: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!supplier || supplier.storeId !== storeId) {
      return respond(res, 404, { success: false, error: "supplier_not_found" });
    }

    return respond(res, 200, { success: true, data: supplier });
  } catch (err) {
    console.error("GET /stores/:id/suppliers/:supplierId error:", err);
    return respond(res, 500, {
      success: false,
      error: "internal_server_error",
    });
  }
});

/**
 * PATCH /v1/stores/:id/suppliers/:supplierId
 * - allowed: STORE_OWNER, ADMIN
 */
router.patch(
  "/:id/suppliers/:supplierId",
  requireRole(["STORE_OWNER", "ADMIN"]),
  async (req: any, res) => {
    try {
      const parsed = patchSupplierSchema.safeParse(req.body);
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
      const supplierId = String(req.params.supplierId);
      const data = parsed.data;

      const existing = await prisma.supplier.findUnique({
        where: { id: supplierId },
        select: { id: true, storeId: true },
      });
      if (!existing || existing.storeId !== storeId) {
        return respond(res, 404, {
          success: false,
          error: "supplier_not_found",
        });
      }

      // if userId provided, ensure mapping is valid
      if (data.userId) {
        const user = await prisma.user.findUnique({
          where: { id: data.userId },
          select: { id: true },
        });
        if (!user)
          return respond(res, 404, { success: false, error: "user_not_found" });

        const conflict = await prisma.supplier.findFirst({
          where: { userId: data.userId, NOT: { id: supplierId } },
        });
        if (conflict)
          return respond(res, 409, {
            success: false,
            error: "user_already_mapped_to_supplier",
          });
      }

      try {
        const updated = await prisma.supplier.update({
          where: { id: supplierId },
          data: {
            name: data.name ?? undefined,
            address: data.address ?? undefined,
            phone: data.phone ?? undefined,
            contactName: data.contactName ?? undefined,
            defaultLeadTime: data.defaultLeadTime ?? undefined,
            defaultMOQ: data.defaultMOQ ?? undefined,
            externalMeta: data.externalMeta ?? undefined,
            userId: data.userId ?? undefined,
            isActive: data.isActive ?? undefined,
          },
        });

        return respond(res, 200, { success: true, data: updated });
      } catch (pErr: any) {
        console.error("Prisma update supplier error:", pErr);
        if (pErr?.code === "P2002") {
          return respond(res, 409, {
            success: false,
            error: "unique_constraint_failed",
          });
        }
        return respond(res, 502, { success: false, error: "database_error" });
      }
    } catch (err) {
      console.error("PATCH /stores/:id/suppliers/:supplierId error:", err);
      return respond(res, 500, {
        success: false,
        error: "internal_server_error",
      });
    }
  }
);

/**
 * DELETE /v1/stores/:id/suppliers/:supplierId
 * - allowed: STORE_OWNER, ADMIN
 * - soft-delete: set isActive = false
 */
router.delete(
  "/:id/suppliers/:supplierId",
  requireRole(["STORE_OWNER", "ADMIN"]),
  async (req: any, res) => {
    try {
      const storeId = String(req.params.id);
      const supplierId = String(req.params.supplierId);

      const existing = await prisma.supplier.findUnique({
        where: { id: supplierId },
        select: { id: true, storeId: true },
      });
      if (!existing || existing.storeId !== storeId) {
        return respond(res, 404, {
          success: false,
          error: "supplier_not_found",
        });
      }

      const updated = await prisma.supplier.update({
        where: { id: supplierId },
        data: { isActive: false },
      });
      return respond(res, 200, { success: true, data: updated });
    } catch (err) {
      console.error("DELETE /stores/:id/suppliers/:supplierId error:", err);
      return respond(res, 500, {
        success: false,
        error: "internal_server_error",
      });
    }
  }
);

export default router;
