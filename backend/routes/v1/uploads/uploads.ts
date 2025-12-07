// routes/v1/uploads.ts
import { Router } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import ExcelJS from "exceljs";
import prisma from "../../../lib/prisma";
import { authenticate } from "../../../middleware/authenticate";
import { storeContext, requireStore } from "../../../middleware/store";
import { requireRole } from "../../../middleware/requireRole";

const router = Router();
const respond = (res: any, status: number, body: object) =>
  res.status(status).json(body);

// Ensure tmp directory exists
const TMP_DIR = path.resolve(process.cwd(), "tmp", "uploads");
fs.mkdirSync(TMP_DIR, { recursive: true });

// multer config
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, TMP_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || "";
    const id = uuidv4();
    cb(null, `${Date.now()}-${id}${ext}`);
  },
});
const uploadMiddleware = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
}); // 20MB limit

/* -----------------------
   Validation schemas
   ----------------------- */
const applySchema = z.object({
  applyAs: z.enum(["create_batches", "update_only"]).optional(), // future extension
});

const listQuerySchema = z.object({
  limit: z.coerce.number().optional(),
  offset: z.coerce.number().optional(),
  status: z.string().optional(),
});

/* -----------------------
   Middleware chain
   ----------------------- */
router.use(authenticate);
router.use(storeContext);
router.use(requireStore);

/* -----------------------
   Helpers
   ----------------------- */

/**
 * Read excel file and return rows as objects.
 * We read the first worksheet and treat the first row as header.
 */
async function parseExcelToJson(filePath: string) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const sheet = workbook.worksheets[0];
  if (!sheet) return { rows: [], errors: [{ message: "no worksheet found" }] };

  // read header row
  const headerRow: any = sheet.getRow(1);
  const headers = headerRow.values
    .slice(1) // exceljs includes an empty 0 index
    .map((h: any) => (h === null || h === undefined ? "" : String(h).trim()));
  // normalize headers: lowercase trimmed
  const normalized = headers.map((h: string) => h.toLowerCase().trim());

  const rows: Record<string, any>[] = [];
  const errors: { rowNumber: number; messages: string[] }[] = [];

  sheet.eachRow((row: any, rowNumber) => {
    if (rowNumber === 1) return; // skip header
    const rowValues = row.values.slice(1);
    const obj: Record<string, any> = {};
    const rowErrors: string[] = [];

    normalized.forEach((colName: string, idx: number) => {
      const cell = rowValues[idx];
      if (cell === undefined) {
        obj[colName] = null;
      } else if (cell instanceof Date) {
        obj[colName] = cell.toISOString();
      } else {
        obj[colName] = String(cell).trim();
      }
    });

    // Quick detection: if entire row empty, skip
    const allNull = Object.values(obj).every((v) => v === null || v === "");
    if (allNull) return;

    // Basic validations expected by upload:
    // require either medicineId OR ndc OR sku OR brandName + qtyReceived
    if (!obj["medicineid"] && !obj["ndc"] && !obj["sku"] && !obj["brandname"]) {
      rowErrors.push(
        "missing identifier: require medicineId or ndc or sku or brandName"
      );
    }

    // qtyReceived required numeric
    const rawQty = obj["qtyreceived"] ?? obj["quantity"] ?? obj["qty"];
    if (rawQty === undefined || rawQty === null || rawQty === "") {
      rowErrors.push("qtyReceived is required");
    } else {
      const qty = Number(rawQty);
      if (
        Number.isNaN(qty) ||
        !Number.isFinite(qty) ||
        !Number.isInteger(qty) ||
        qty < 0
      ) {
        rowErrors.push(`qtyReceived invalid: "${rawQty}"`);
      } else {
        obj["qtyReceived"] = qty;
      }
    }

    // expiryDate normalization
    if (obj["expirydate"]) {
      const d = new Date(obj["expirydate"]);
      if (isNaN(d.getTime())) {
        rowErrors.push(`expiryDate invalid: "${obj["expirydate"]}"`);
      } else {
        obj["expiryDate"] = d.toISOString();
      }
    }

    // parse purchasePrice/mrp
    const parseDecimal = (k: string) => {
      if (!obj[k]) return null;
      const n = Number(obj[k]);
      if (Number.isNaN(n)) {
        rowErrors.push(`${k} invalid number: "${obj[k]}"`);
        return null;
      }
      return n;
    };
    obj["purchasePrice"] = parseDecimal("purchaseprice");
    obj["mrp"] = parseDecimal("mrp");

    if (rowErrors.length) errors.push({ rowNumber, messages: rowErrors });

    rows.push(obj);
  });

  return { rows, errors };
}

/* -----------------------
   Routes
   ----------------------- */

/**
 * POST /v1/stores/:id/uploads
 * multipart/form-data file
 * Allowed roles: STORE_OWNER, ADMIN, MANAGER
 *
 * Creates Upload row with status PENDING and returns uploadId and fileRef.
 */
router.post(
  "/:id/uploads",
  requireRole(["STORE_OWNER", "ADMIN", "MANAGER"]),
  uploadMiddleware.single("file"),
  async (req: any, res) => {
    try {
      const storeId = String(req.params.id);
      const userId = req.user?.id ?? null;

      if (!req.file)
        return respond(res, 400, { success: false, error: "file_missing" });

      const file = req.file;
      const uploadId = uuidv4();
      const fileRef = path.relative(process.cwd(), file.path);

      const created = await prisma.upload.create({
        data: {
          id: uploadId,
          storeId,
          filename: file.originalname,
          fileRef,
          mimeType: file.mimetype,
          status: "PENDING",
          createdById: userId ?? undefined,
        },
        select: { id: true, status: true, createdAt: true },
      });

      return respond(res, 202, {
        success: true,
        data: { uploadId: created.id, previewReady: false },
      });
    } catch (err) {
      console.error("POST /uploads error:", err);
      return respond(res, 500, {
        success: false,
        error: "internal_server_error",
      });
    }
  }
);

/**
 * GET /v1/stores/:id/uploads/:uploadId/preview
 * - roles: STORE_OWNER, ADMIN, MANAGER
 * - If preview not yet generated, parse the file and store preview JSON in Upload.preview, mark PREVIEW_READY
 */
router.get(
  "/:id/uploads/:uploadId/preview",
  requireRole(["STORE_OWNER", "ADMIN", "MANAGER"]),
  async (req: any, res) => {
    try {
      const storeId = String(req.params.id);
      const uploadId = String(req.params.uploadId);

      const upload = await prisma.upload.findUnique({
        where: { id: uploadId },
      });
      if (!upload || upload.storeId !== storeId)
        return respond(res, 404, { success: false, error: "upload_not_found" });

      // If preview exists and status is PREVIEW_READY or APPLIED/FAILED, return it
      if (
        upload.preview &&
        (upload.status === "PREVIEW_READY" ||
          upload.status === "APPLIED" ||
          upload.status === "FAILED")
      ) {
        return respond(res, 200, {
          success: true,
          data: { preview: upload.preview, status: upload.status },
        });
      }

      // parse the file from disk
      const filePath = path.resolve(process.cwd(), upload.fileRef);
      if (!fs.existsSync(filePath)) {
        return respond(res, 500, {
          success: false,
          error: "file_missing_on_disk",
        });
      }

      // parse excel to json rows
      const { rows, errors } = await parseExcelToJson(filePath);

      // build preview object with per-row validation
      const previewRows = rows.map((r, idx) => {
        const issues: string[] = [];
        // push back any validation issues we detected earlier
        // Note: errors is an array with rowNumber; map them to index+2 (header row)
        const errsForRow = errors.filter((e: any) => e.rowNumber === idx + 2);
        errsForRow.forEach((e: any) =>
          e.messages.forEach((m) => issues.push(m))
        );

        // additional checks: if medicineId present ensure it is UUID-like (basic), else rely on brandName
        if (r.medicineid) {
          if (!/^[0-9a-fA-F-]{36,}$/.test(String(r.medicineid))) {
            issues.push("medicineId looks invalid");
          }
        }
        return { original: r, issues, ok: issues.length === 0 };
      });

      // persist preview and mark status PREVIEW_READY
      const saved = await prisma.upload.update({
        where: { id: uploadId },
        data: {
          preview: { rows: previewRows },
          status: "PREVIEW_READY",
          processedAt: new Date(),
        },
        select: { id: true, status: true, preview: true },
      });

      return respond(res, 200, {
        success: true,
        data: { preview: saved.preview, status: saved.status },
      });
    } catch (err) {
      console.error("GET /uploads/:uploadId/preview error:", err);
      return respond(res, 500, {
        success: false,
        error: "internal_server_error",
      });
    }
  }
);

/**
 * POST /v1/stores/:id/uploads/:uploadId/apply
 * - roles: STORE_OWNER, ADMIN
 * - applies previewed rows transactionally: creates InventoryBatch rows and StockMovement RECEIPT
 */
router.post(
  "/:id/uploads/:uploadId/apply",
  requireRole(["STORE_OWNER", "ADMIN"]),
  async (req: any, res) => {
    try {
      const storeId = String(req.params.id);
      const uploadId = String(req.params.uploadId);

      const parsed = applySchema.safeParse(req.body ?? {});
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

      const userId = req.user?.id ?? null;

      const upload = await prisma.upload.findUnique({
        where: { id: uploadId },
      });
      if (!upload || upload.storeId !== storeId)
        return respond(res, 404, { success: false, error: "upload_not_found" });

      if (
        !upload.preview ||
        (upload.status !== "PREVIEW_READY" && upload.status !== "PENDING")
      ) {
        return respond(res, 400, {
          success: false,
          error: "preview_required_or_invalid_status",
          details: { status: upload.status },
        });
      }

      const previewRows = (upload.preview as any).rows as {
        original: any;
        issues: string[];
        ok: boolean;
      }[];
      if (!Array.isArray(previewRows) || previewRows.length === 0) {
        return respond(res, 400, { success: false, error: "no_rows_to_apply" });
      }

      // Collect only ok rows, but also report row-level errors in result
      const rowsToApply = previewRows
        .map((r: any, idx: number) => ({
          idx: idx + 2,
          ok: r.ok,
          errors: r.issues,
          data: r.original,
        }))
        .filter((r: any) => r.ok);

      // Apply in a transaction: for each row create InventoryBatch + StockMovement(RECEIPT)
      const applyResult = await prisma.$transaction(async (tx) => {
        const appliedRows: any[] = [];
        for (const row of rowsToApply) {
          const data = row.data;

          // Attempt to resolve medicineId:
          let medicineId = data.medicineid ?? null;
          if (!medicineId) {
            // try ndc, sku, or brandName + store
            if (data.ndc) {
              const m = await tx.medicine.findFirst({
                where: { storeId, ndc: data.ndc },
                select: { id: true },
              });
              if (m) medicineId = m.id;
            }
            if (!medicineId && data.sku) {
              const m = await tx.medicine.findFirst({
                where: { storeId, sku: data.sku },
                select: { id: true },
              });
              if (m) medicineId = m.id;
            }
            if (!medicineId && data.brandname) {
              // fallback: try to match brandName; if no match create medicine automatically (optional)
              const m = await tx.medicine.findFirst({
                where: { storeId, brandName: data.brandname },
                select: { id: true },
              });
              if (m) medicineId = m.id;
              else {
                // create a medicine automatically - minimal fields
                const createdMed = await tx.medicine.create({
                  data: {
                    storeId,
                    brandName: data.brandname,
                    genericName: data.genericname ?? undefined,
                    sku: data.sku ?? undefined,
                  },
                  select: { id: true },
                });
                medicineId = createdMed.id;
              }
            }
          }

          if (!medicineId) {
            // shouldn't happen given preview ok, but guard
            continue;
          }

          const batchNumber = data.batchnumber ?? undefined;
          const qtyReceived = Number(data.qtyReceived);
          const expiryDate = data.expiryDate
            ? new Date(data.expiryDate)
            : undefined;
          const purchasePrice = data.purchasePrice ?? undefined;
          const mrp = data.mrp ?? undefined;
          const receivedAt = data.receivedat
            ? new Date(data.receivedat)
            : new Date();

          const batch = await tx.inventoryBatch.create({
            data: {
              storeId,
              medicineId,
              batchNumber,
              qtyReceived,
              qtyAvailable: qtyReceived,
              expiryDate: expiryDate ?? undefined,
              purchasePrice,
              mrp,
              receivedAt,
              location: data.location ?? undefined,
            },
          });

          const movement = await tx.stockMovement.create({
            data: {
              storeId,
              inventoryId: batch.id,
              medicineId,
              delta: qtyReceived,
              reason: "RECEIPT",
              note: `Upload ${uploadId} row ${row.idx}`,
              performedById: userId ?? undefined,
            },
          });

          appliedRows.push({
            rowNumber: row.idx,
            batchId: batch.id,
            movementId: movement.id,
          });
        }

        // update upload row with summary
        const updatedUpload = await tx.upload.update({
          where: { id: uploadId },
          data: {
            status: "APPLIED",
            rowsProcessed: appliedRows.length,
            errorsCount: previewRows.length - appliedRows.length,
            processedAt: new Date(),
          },
          select: {
            id: true,
            status: true,
            rowsProcessed: true,
            errorsCount: true,
          },
        });

        return { appliedRows, upload: updatedUpload };
      });

      return respond(res, 200, { success: true, data: applyResult });
    } catch (err: any) {
      console.error("POST /uploads/:uploadId/apply error:", err);
      // mark upload as FAILED if possible
      try {
        const uploadId = String(req.params.uploadId);
        await prisma.upload.update({
          where: { id: uploadId },
          data: { status: "FAILED", processedAt: new Date() },
        });
      } catch (_e) {
        // ignore errors during failure marking
      }
      return respond(res, 500, {
        success: false,
        error: "internal_server_error",
      });
    }
  }
);

/**
 * GET /v1/stores/:id/uploads
 * list uploads (admin/owner)
 */
router.get(
  "/:id/uploads",
  requireRole(["STORE_OWNER", "ADMIN"]),
  async (req: any, res) => {
    try {
      const storeId = String(req.params.id);
      const q = req.query;
      const parsed = listQuerySchema.safeParse(q);
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
      const limit = Math.min(Math.max(Number(q.limit ?? 50), 1), 200);
      const offset = Math.max(Number(q.offset ?? 0), 0);
      const status = typeof q.status === "string" ? q.status : undefined;

      const where: any = { storeId };
      if (status) where.status = status;

      const [items, total] = await Promise.all([
        prisma.upload.findMany({
          where,
          orderBy: { createdAt: "desc" },
          take: limit,
          skip: offset,
          select: {
            id: true,
            filename: true,
            status: true,
            rowsProcessed: true,
            errorsCount: true,
            createdAt: true,
            processedAt: true,
            createdById: true,
          },
        }),
        prisma.upload.count({ where }),
      ]);

      return respond(res, 200, {
        success: true,
        data: { items, total, limit, offset },
      });
    } catch (err) {
      console.error("GET /uploads list error:", err);
      return respond(res, 500, {
        success: false,
        error: "internal_server_error",
      });
    }
  }
);

export default router;
