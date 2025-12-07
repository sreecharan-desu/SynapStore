// routes/v1/medicines.ts
import { Router } from "express";
import { z } from "zod";
import prisma from "../../../lib/prisma";
import { authenticate } from "../../../middleware/authenticate";
import { storeContext, requireStore } from "../../../middleware/store";
import { requireRole } from "../../../middleware/requireRole";

const router = Router();

/**
 * Response helper
 * - follow the pattern: { success: boolean, data?: any, error?: string, details?: any }
 */
const respond = (res: any, status: number, body: object) =>
  res.status(status).json(body);

/* -----------------------
   Validation schemas
   ----------------------- */
const createMedicineSchema = z.object({
  brandName: z.string().min(1, "brandName is required"),
  genericName: z.string().optional().nullable(),
  sku: z.string().optional().nullable(),
  ndc: z.string().optional().nullable(),
  dosageForm: z.string().optional().nullable(),
  strength: z.string().optional().nullable(),
  uom: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  taxInfo: z.any().optional().nullable(),
  isActive: z.boolean().optional(),
});

const patchMedicineSchema = z.object({
  brandName: z.string().min(1).optional(),
  genericName: z.string().optional().nullable(),
  sku: z.string().optional().nullable(),
  ndc: z.string().optional().nullable(),
  dosageForm: z.string().optional().nullable(),
  strength: z.string().optional().nullable(),
  uom: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  taxInfo: z.any().optional().nullable(),
  isActive: z.boolean().optional(),
});

/* -----------------------
   Router middleware
   -----------------------
   All these routes require:
    - authenticate: populates req.user
    - storeContext: resolves req.store and req.userStoreRoles
    - requireStore: ensures store resolved
*/
router.use(authenticate);
router.use(storeContext);
router.use(requireStore);

/* -----------------------
   Routes
   ----------------------- */

/**
 * POST /v1/stores/:id/medicines
 * - roles allowed: STORE_OWNER, ADMIN
 */
router.post(
  "/:id/medicines",
  requireRole(["STORE_OWNER", "ADMIN"]),
  async (req: any, res) => {
    try {
      const parsed = createMedicineSchema.safeParse(req.body);
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
      const payload = parsed.data;

      // basic duplicate protection: brandName + store uniqueness (optional)
      const existing = await prisma.medicine.findFirst({
        where: {
          storeId,
          brandName: payload.brandName,
          sku: payload.sku ?? undefined,
        },
        select: { id: true },
      });

      if (existing) {
        return respond(res, 409, {
          success: false,
          error: "medicine_already_exists",
        });
      }

      const created = await prisma.medicine.create({
        data: {
          storeId,
          brandName: payload.brandName,
          genericName: payload.genericName ?? undefined,
          sku: payload.sku ?? undefined,
          ndc: payload.ndc ?? undefined,
          dosageForm: payload.dosageForm ?? undefined,
          strength: payload.strength ?? undefined,
          uom: payload.uom ?? undefined,
          category: payload.category ?? undefined,
          taxInfo: payload.taxInfo ?? undefined,
          isActive: payload.isActive ?? true,
        },
      });

      return respond(res, 201, { success: true, data: created });
    } catch (err: any) {
      console.error("POST /stores/:id/medicines error:", err);
      // Prisma unique constraint handling
      if (err?.code === "P2002") {
        return respond(res, 409, {
          success: false,
          error: "unique_constraint_failed",
        });
      }
      return respond(res, 500, {
        success: false,
        error: "internal_server_error",
      });
    }
  }
);

/**
 * GET /v1/stores/:id/medicines
 * - any authenticated user with storeContext can list
 * - query: q (search brandName/genericName/sku), category, limit, offset
 */
router.get("/:id/medicines", async (req: any, res) => {
  try {
    const storeId = String(req.params.id);
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const category =
      typeof req.query.category === "string" ? req.query.category.trim() : null;
    const limit = Math.min(Math.max(Number(req.query.limit ?? 25), 1), 200);
    const offset = Math.max(Number(req.query.offset ?? 0), 0);

    const where: any = { storeId };
    if (category) where.category = category;
    if (q) {
      where.OR = [
        { brandName: { contains: q, mode: "insensitive" } },
        { genericName: { contains: q, mode: "insensitive" } },
        { sku: { contains: q, mode: "insensitive" } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.medicine.findMany({
        where,
        orderBy: { brandName: "asc" },
        take: limit,
        skip: offset,
        select: {
          id: true,
          ndc: true,
          storeId: true,
          sku: true,
          brandName: true,
          genericName: true,
          dosageForm: true,
          strength: true,
          uom: true,
          category: true,
          taxInfo: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.medicine.count({ where }),
    ]);

    return respond(res, 200, {
      success: true,
      data: { items, total, limit, offset },
    });
  } catch (err) {
    console.error("GET /stores/:id/medicines error:", err);
    return respond(res, 500, {
      success: false,
      error: "internal_server_error",
    });
  }
});

/**
 * GET /v1/stores/:id/medicines/:medicineId
 * - any authenticated user with storeContext
 */
router.get("/:id/medicines/:medicineId", async (req: any, res) => {
  try {
    const storeId = String(req.params.id);
    const medicineId = String(req.params.medicineId);

    const med = await prisma.medicine.findFirst({
      where: { id: medicineId, storeId },
      select: {
        id: true,
        ndc: true,
        storeId: true,
        sku: true,
        brandName: true,
        genericName: true,
        dosageForm: true,
        strength: true,
        uom: true,
        category: true,
        taxInfo: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        suppliers: { select: { id: true, name: true } },
      },
    });

    if (!med)
      return respond(res, 404, { success: false, error: "medicine_not_found" });

    return respond(res, 200, { success: true, data: med });
  } catch (err) {
    console.error("GET /stores/:id/medicines/:medicineId error:", err);
    return respond(res, 500, {
      success: false,
      error: "internal_server_error",
    });
  }
});

/**
 * PATCH /v1/stores/:id/medicines/:medicineId
 * - roles allowed: STORE_OWNER, ADMIN
 */
router.patch(
  "/:id/medicines/:medicineId",
  requireRole(["STORE_OWNER", "ADMIN"]),
  async (req: any, res) => {
    try {
      const parsed = patchMedicineSchema.safeParse(req.body);
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
      const medicineId = String(req.params.medicineId);

      // ensure medicine exists for this store
      const exists = await prisma.medicine.findFirst({
        where: { id: medicineId, storeId },
        select: { id: true },
      });
      if (!exists)
        return respond(res, 404, {
          success: false,
          error: "medicine_not_found",
        });

      const updated = await prisma.medicine.update({
        where: { id: medicineId },
        data: {
          ...parsed.data,
        },
      });

      return respond(res, 200, { success: true, data: updated });
    } catch (err: any) {
      console.error("PATCH /stores/:id/medicines/:medicineId error:", err);
      if (err?.code === "P2025")
        return respond(res, 404, {
          success: false,
          error: "medicine_not_found",
        });
      return respond(res, 500, {
        success: false,
        error: "internal_server_error",
      });
    }
  }
);

/**
 * DELETE /v1/stores/:id/medicines/:medicineId
 * - roles allowed: STORE_OWNER, ADMIN
 * - soft-delete: set isActive = false
 */
router.delete(
  "/:id/medicines/:medicineId",
  requireRole(["STORE_OWNER", "ADMIN"]),
  async (req: any, res) => {
    try {
      const storeId = String(req.params.id);
      const medicineId = String(req.params.medicineId);

      const existing = await prisma.medicine.findFirst({
        where: { id: medicineId, storeId },
        select: { id: true },
      });
      if (!existing)
        return respond(res, 404, {
          success: false,
          error: "medicine_not_found",
        });

      const deleted = await prisma.medicine.update({
        where: { id: medicineId },
        data: { isActive: false },
      });

      return respond(res, 200, { success: true, data: deleted });
    } catch (err) {
      console.error("DELETE /stores/:id/medicines/:medicineId error:", err);
      return respond(res, 500, {
        success: false,
        error: "internal_server_error",
      });
    }
  }
);

export default router;
