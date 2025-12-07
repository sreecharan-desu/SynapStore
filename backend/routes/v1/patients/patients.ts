// routes/v1/patients.ts
import { Router } from "express";
import { z } from "zod";
import prisma from "../../../lib/prisma";
import { authenticate } from "../../../middleware/authenticate";
import { storeContext, requireStore } from "../../../middleware/store";
import { requireRole } from "../../../middleware/requireRole";

const router = Router();
const respond = (res: any, status: number, body: object) =>
  res.status(status).json(body);

/* Schemas */
const createPatientSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().optional().nullable(),
  birthdate: z.string().optional().nullable(), // ISO date string
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  gender: z.string().optional().nullable(),
  insuranceId: z.string().optional().nullable(),
});

const patchPatientSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional().nullable(),
  birthdate: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  gender: z.string().optional().nullable(),
  insuranceId: z.string().optional().nullable(),
});

/* Middleware: patients are store-scoped in the earlier API spec.
   Use authenticate + storeContext + requireStore for guard.
*/
router.use(authenticate);
router.use(storeContext);
router.use(requireStore);

/**
 * GET /v1/stores/:id/patients
 * - allowed: STORE_OWNER, ADMIN, MANAGER
 * - query: q (search by name/phone), limit, offset
 */
router.get(
  "/:id/patients",
  requireRole(["STORE_OWNER", "ADMIN", "MANAGER"]),
  async (req: any, res) => {
    try {
      const q = typeof req.query.q === "string" ? req.query.q.trim() : null;
      const limit = Math.min(Math.max(Number(req.query.limit ?? 50), 1), 200);
      const offset = Math.max(Number(req.query.offset ?? 0), 0);
      const where: any = {};

      if (q) {
        where.OR = [
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName: { contains: q, mode: "insensitive" } },
          { phone: { contains: q, mode: "insensitive" } },
        ];
      }

      const [items, total] = await Promise.all([
        prisma.patient.findMany({
          where,
          orderBy: { createdAt: "desc" },
          take: limit,
          skip: offset,
          select: {
            patientID: true,
            firstName: true,
            lastName: true,
            phone: true,
            birthdate: true,
            insuranceId: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
        prisma.patient.count({ where }),
      ]);

      return respond(res, 200, {
        success: true,
        data: { items, total, limit, offset },
      });
    } catch (err) {
      console.error("GET /patients error:", err);
      return respond(res, 500, {
        success: false,
        error: "internal_server_error",
      });
    }
  }
);

/**
 * POST /v1/stores/:id/patients
 * - allowed: ADMIN, STORE_OWNER
 */
router.post(
  "/:id/patients",
  requireRole(["ADMIN", "STORE_OWNER"]),
  async (req: any, res) => {
    try {
      const parsed = createPatientSchema.safeParse(req.body);
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

      const data = parsed.data;
      const created = await prisma.patient.create({
        data: {
          firstName: data.firstName,
          lastName: data.lastName ?? "",
          birthdate: data.birthdate ? new Date(data.birthdate) : undefined,
          address: data.address ?? undefined,
          phone: data.phone ?? undefined,
          gender: data.gender ?? undefined,
          insuranceId: data.insuranceId ?? undefined,
        },
      });

      return respond(res, 201, { success: true, data: created });
    } catch (err) {
      console.error("POST /patients error:", err);
      return respond(res, 500, {
        success: false,
        error: "internal_server_error",
      });
    }
  }
);

/**
 * GET /v1/stores/:id/patients/:patientID
 * - allowed: ADMIN, STORE_OWNER, MANAGER
 */
router.get(
  "/:id/patients/:patientID",
  requireRole(["ADMIN", "STORE_OWNER", "MANAGER"]),
  async (req: any, res) => {
    try {
      const patientID = Number(req.params.patientID);
      if (!patientID)
        return respond(res, 400, {
          success: false,
          error: "invalid_patient_id",
        });

      const patient = await prisma.patient.findUnique({
        where: { patientID },
        select: {
          patientID: true,
          firstName: true,
          lastName: true,
          phone: true,
          birthdate: true,
          address: true,
          gender: true,
          insuranceId: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!patient)
        return respond(res, 404, {
          success: false,
          error: "patient_not_found",
        });

      return respond(res, 200, { success: true, data: patient });
    } catch (err) {
      console.error("GET /patients/:patientID error:", err);
      return respond(res, 500, {
        success: false,
        error: "internal_server_error",
      });
    }
  }
);

/**
 * PATCH /v1/stores/:id/patients/:patientID
 * - allowed: ADMIN, STORE_OWNER
 */
router.patch(
  "/:id/patients/:patientID",
  requireRole(["ADMIN", "STORE_OWNER"]),
  async (req: any, res) => {
    try {
      const patientID = Number(req.params.patientID);
      if (!patientID)
        return respond(res, 400, {
          success: false,
          error: "invalid_patient_id",
        });

      const parsed = patchPatientSchema.safeParse(req.body);
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

      const data = parsed.data;

      const existing = await prisma.patient.findUnique({
        where: { patientID },
      });
      if (!existing)
        return respond(res, 404, {
          success: false,
          error: "patient_not_found",
        });

      const updated = await prisma.patient.update({
        where: { patientID },
        data: {
          firstName: data.firstName ?? undefined,
          lastName: data.lastName ?? undefined,
          birthdate: data.birthdate ? new Date(data.birthdate) : undefined,
          address: data.address ?? undefined,
          phone: data.phone ?? undefined,
          gender: data.gender ?? undefined,
          insuranceId: data.insuranceId ?? undefined,
        },
      });

      return respond(res, 200, { success: true, data: updated });
    } catch (err) {
      console.error("PATCH /patients/:patientID error:", err);
      return respond(res, 500, {
        success: false,
        error: "internal_server_error",
      });
    }
  }
);

/**
 * DELETE /v1/stores/:id/patients/:patientID
 * - allowed: ADMIN, STORE_OWNER
 * - performs a hard delete (schema has no isActive). If you prefer soft delete add isActive flag later.
 */
router.delete(
  "/:id/patients/:patientID",
  requireRole(["ADMIN", "STORE_OWNER"]),
  async (req: any, res) => {
    try {
      const patientID = Number(req.params.patientID);
      if (!patientID)
        return respond(res, 400, {
          success: false,
          error: "invalid_patient_id",
        });

      const existing = await prisma.patient.findUnique({
        where: { patientID },
      });
      if (!existing)
        return respond(res, 404, {
          success: false,
          error: "patient_not_found",
        });

      await prisma.patient.delete({ where: { patientID } });
      return respond(res, 200, { success: true });
    } catch (err) {
      console.error("DELETE /patients/:patientID error:", err);
      return respond(res, 500, {
        success: false,
        error: "internal_server_error",
      });
    }
  }
);

export default router;
