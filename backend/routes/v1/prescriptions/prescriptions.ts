// routes/v1/prescriptions.ts
import { Router } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import prisma from "../../../lib/prisma";
import { authenticate } from "../../../middleware/authenticate";
import { storeContext, requireStore } from "../../../middleware/store";
import { requireRole } from "../../../middleware/requireRole";

const router = Router();
const respond = (res: any, status: number, body: object) =>
  res.status(status).json(body);

// tmp folder for prescription files
const TMP_DIR = path.resolve(process.cwd(), "tmp", "prescriptions");
fs.mkdirSync(TMP_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, TMP_DIR),
  filename: (_req, file, cb) =>
    cb(null, `${Date.now()}-${uuidv4()}${path.extname(file.originalname)}`),
});
const uploadMiddleware = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
});

/* Schemas */
const createSchema = z.object({
  patientID: z.coerce.number().optional(), // patient id (int)
  physID: z.coerce.number().optional(), // doctor id (physID)
  medicineId: z.string().uuid(),
  qty: z.number().int().min(1),
  days: z.number().int().optional().nullable(),
  refills: z.number().int().optional().nullable(),
  status: z.string().optional().nullable(),
  issuedAt: z.string().optional().nullable(),
});

const patchSchema = z.object({
  qty: z.number().int().optional(),
  days: z.number().int().optional().nullable(),
  refills: z.number().int().optional().nullable(),
  status: z.string().optional().nullable(),
});

/* Middleware chain */
router.use(authenticate);
router.use(storeContext);
router.use(requireStore);

/**
 * GET /v1/stores/:id/prescriptions
 * - allowed: STORE_OWNER, ADMIN, MANAGER
 * - filter: patientId?, doctorId?, medicineId?, status?
 */
router.get(
  "/:id/prescriptions",
  requireRole(["STORE_OWNER", "ADMIN", "MANAGER"]),
  async (req: any, res) => {
    try {
      const storeId = String(req.params.id);
      const patientId = req.query.patientId
        ? Number(req.query.patientId)
        : undefined;
      const doctorId = req.query.doctorId
        ? Number(req.query.doctorId)
        : undefined;
      const medicineId =
        typeof req.query.medicineId === "string"
          ? req.query.medicineId
          : undefined;
      const status =
        typeof req.query.status === "string" ? req.query.status : undefined;
      const limit = Math.min(Math.max(Number(req.query.limit ?? 50), 1), 200);
      const offset = Math.max(Number(req.query.offset ?? 0), 0);

      const where: any = { storeId };
      if (patientId) where.patientID = patientId;
      if (doctorId) where.physID = doctorId;
      if (medicineId) where.medicineId = medicineId;
      if (status) where.status = status;

      const [items, total] = await Promise.all([
        prisma.prescription.findMany({
          where,
          orderBy: { issuedAt: "desc" },
          take: limit,
          skip: offset,
          select: {
            id: true,
            patientID: true,
            physID: true,
            qty: true,
            days: true,
            refills: true,
            status: true,
            issuedAt: true,
          },
        }),
        prisma.prescription.count({ where }),
      ]);

      return respond(res, 200, {
        success: true,
        data: { items, total, limit, offset },
      });
    } catch (err) {
      console.error("GET /prescriptions error:", err);
      return respond(res, 500, {
        success: false,
        error: "internal_server_error",
      });
    }
  }
);

/**
 * POST /v1/stores/:id/prescriptions
 * - allowed: ADMIN, STORE_OWNER, MANAGER, STAFF
 * - creates a prescription record
 * - optional body field 'file' is not used here; use /upload for doctor uploads if you want file attachments
 */
router.post(
  "/:id/prescriptions",
  requireRole(["ADMIN", "STORE_OWNER", "MANAGER", "STAFF"]),
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
      const data = parsed.data;

      // Validate patient if provided
      if (data.patientID) {
        const p = await prisma.patient.findUnique({
          where: { patientID: Number(data.patientID) },
        });
        if (!p)
          return respond(res, 404, {
            success: false,
            error: "patient_not_found",
          });
      }

      // Validate doctor if provided
      if (data.physID) {
        const doc = await prisma.doctor.findUnique({
          where: { physID: Number(data.physID) },
        });
        if (!doc)
          return respond(res, 404, {
            success: false,
            error: "doctor_not_found",
          });
      }

      // Validate medicine
      const med = await prisma.medicine.findUnique({
        where: { id: data.medicineId },
      });
      if (!med || med.storeId !== storeId)
        return respond(res, 404, {
          success: false,
          error: "medicine_not_found",
        });

      const created = await prisma.prescription.create({
        data: {
          storeId,
          patientID: data.patientID ?? 0,
          physID: data.physID ?? 0,
          medicineId: data.medicineId,
          qty: data.qty,
          days: data.days ?? undefined,
          refills: data.refills ?? undefined,
          status: data.status ?? undefined,
          issuedAt: data.issuedAt ? new Date(data.issuedAt) : new Date(),
        },
      });

      return respond(res, 201, { success: true, data: created });
    } catch (err) {
      console.error("POST /prescriptions error:", err);
      return respond(res, 500, {
        success: false,
        error: "internal_server_error",
      });
    }
  }
);

/**
 * POST /v1/stores/:id/prescriptions/upload
 * - doctor uploads a prescription file and creates a prescription record
 * - allowed: ADMIN, STORE_OWNER, MANAGER, STAFF
 * - use multipart form-data with fields: patientID, physID, medicineId, qty, days, refills
 */
router.post(
  "/:id/prescriptions/upload",
  requireRole(["ADMIN", "STORE_OWNER", "MANAGER", "STAFF"]),
  uploadMiddleware.single("file"),
  async (req: any, res) => {
    try {
      const storeId = String(req.params.id);
      const fields = req.body ?? {};
      const file = req.file ?? null;

      // validate minimal required fields
      const parsed = createSchema.safeParse({
        patientID: fields.patientID ? Number(fields.patientID) : undefined,
        physID: fields.physID ? Number(fields.physID) : undefined,
        medicineId: fields.medicineId,
        qty: fields.qty ? Number(fields.qty) : undefined,
        days: fields.days ? Number(fields.days) : undefined,
        refills: fields.refills ? Number(fields.refills) : undefined,
        issuedAt: fields.issuedAt ?? undefined,
      });

      if (!parsed.success) {
        // cleanup file if present
        if (file && file.path)
          try {
            fs.unlinkSync(file.path);
          } catch (e) {}
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

      // validations: medicine, patient, doctor
      if (data.patientID) {
        const p = await prisma.patient.findUnique({
          where: { patientID: Number(data.patientID) },
        });
        if (!p) {
          if (file && file.path)
            try {
              fs.unlinkSync(file.path);
            } catch (e) {}
          return respond(res, 404, {
            success: false,
            error: "patient_not_found",
          });
        }
      }
      if (data.physID) {
        const d = await prisma.doctor.findUnique({
          where: { physID: Number(data.physID) },
        });
        if (!d) {
          if (file && file.path)
            try {
              fs.unlinkSync(file.path);
            } catch (e) {}
          return respond(res, 404, {
            success: false,
            error: "doctor_not_found",
          });
        }
      }
      const med = await prisma.medicine.findUnique({
        where: { id: data.medicineId },
      });
      if (!med || med.storeId !== storeId) {
        if (file && file.path)
          try {
            fs.unlinkSync(file.path);
          } catch (e) {}
        return respond(res, 404, {
          success: false,
          error: "medicine_not_found",
        });
      }

      // Create prescription record and optionally create an Upload entry linking to the file for auditing
      const result = await prisma.$transaction(async (tx) => {
        const pres = await tx.prescription.create({
          data: {
            storeId,
            patientID: data.patientID ?? 0,
            physID: data.physID ?? 0,
            medicineId: data.medicineId,
            qty: data.qty,
            days: data.days ?? undefined,
            refills: data.refills ?? undefined,
            issuedAt: data.issuedAt ? new Date(data.issuedAt) : new Date(),
          },
        });

        if (file) {
          // store a lightweight Upload record to reuse the Upload model for auditing file location
          await tx.upload.create({
            data: {
              storeId,
              filename: file.originalname,
              fileRef: path.relative(process.cwd(), file.path),
              mimeType: file.mimetype,
              status: "APPLIED",
              rowsProcessed: 0,
              createdById: req.user?.id ?? undefined,
              preview: {
                prescriptionId: pres.id,
                note: "doctor_upload",
              } as any,
              processedAt: new Date(),
            },
          });
        }

        return pres;
      });

      return respond(res, 201, { success: true, data: result });
    } catch (err) {
      console.error("POST /prescriptions/upload error:", err);
      // cleanup file on error
      if (req.file && req.file.path)
        try {
          fs.unlinkSync(req.file.path);
        } catch (e) {}
      return respond(res, 500, {
        success: false,
        error: "internal_server_error",
      });
    }
  }
);

/**
 * GET /v1/stores/:id/prescriptions/:id
 * - allowed: STORE_OWNER, ADMIN, MANAGER
 */
router.get(
  "/:id/prescriptions/:prescriptionId",
  requireRole(["STORE_OWNER", "ADMIN", "MANAGER"]),
  async (req: any, res) => {
    try {
      const storeId = String(req.params.id);
      const pid = Number(req.params.prescriptionId);
      if (!pid)
        return respond(res, 400, { success: false, error: "invalid_id" });

      const pres = await prisma.prescription.findUnique({
        where: { id: pid },
        select: {
          id: true,
          storeId: true,
          patientID: true,
          physID: true,
          medicineId: true,
          qty: true,
          days: true,
          refills: true,
          status: true,
          issuedAt: true,
        },
      });

      if (!pres || pres.storeId !== storeId)
        return respond(res, 404, {
          success: false,
          error: "prescription_not_found",
        });

      return respond(res, 200, { success: true, data: pres });
    } catch (err) {
      console.error("GET /prescriptions/:id error:", err);
      return respond(res, 500, {
        success: false,
        error: "internal_server_error",
      });
    }
  }
);

/**
 * PATCH /v1/stores/:id/prescriptions/:id
 * - allowed: ADMIN, STORE_OWNER, MANAGER
 */
router.patch(
  "/:id/prescriptions/:prescriptionId",
  requireRole(["ADMIN", "STORE_OWNER", "MANAGER"]),
  async (req: any, res) => {
    try {
      const pid = Number(req.params.prescriptionId);
      if (!pid)
        return respond(res, 400, { success: false, error: "invalid_id" });

      const parsed = patchSchema.safeParse(req.body ?? {});
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

      const existing = await prisma.prescription.findUnique({
        where: { id: pid },
      });
      if (!existing)
        return respond(res, 404, {
          success: false,
          error: "prescription_not_found",
        });

      const updated = await prisma.prescription.update({
        where: { id: pid },
        data: {
          qty: data.qty ?? undefined,
          days: data.days ?? undefined,
          refills: data.refills ?? undefined,
          status: data.status ?? undefined,
        },
      });

      return respond(res, 200, { success: true, data: updated });
    } catch (err) {
      console.error("PATCH /prescriptions/:id error:", err);
      return respond(res, 500, {
        success: false,
        error: "internal_server_error",
      });
    }
  }
);

/**
 * DELETE /v1/stores/:id/prescriptions/:id
 * - allowed: ADMIN, STORE_OWNER
 */
router.delete(
  "/:id/prescriptions/:prescriptionId",
  requireRole(["ADMIN", "STORE_OWNER"]),
  async (req: any, res) => {
    try {
      const pid = Number(req.params.prescriptionId);
      if (!pid)
        return respond(res, 400, { success: false, error: "invalid_id" });

      const existing = await prisma.prescription.findUnique({
        where: { id: pid },
      });
      if (!existing)
        return respond(res, 404, {
          success: false,
          error: "prescription_not_found",
        });

      await prisma.prescription.delete({ where: { id: pid } });
      return respond(res, 200, { success: true });
    } catch (err) {
      console.error("DELETE /prescriptions/:id error:", err);
      return respond(res, 500, {
        success: false,
        error: "internal_server_error",
      });
    }
  }
);

export default router;
