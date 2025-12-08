// src/routes/v1/inventory.ts
import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import fs from "fs/promises";
import path from "path";
import XLSX from "xlsx";
import prisma from "../../../lib/prisma";
import { authenticate } from "../../../middleware/authenticate";
import {
  storeContext,
  requireStore,
  RequestWithUser,
} from "../../../middleware/store";
import { z } from "zod";

const router = Router();

// store files in memory then write to /tmp; small uploads assumed
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
}); // 10MB

// Validation schema for a parsed row (common columns we expect)
const rowSchema = z.object({
  brandName: z.string().min(1),
  genericName: z.string().optional().nullable(),
  sku: z.string().optional().nullable(),
  batchNumber: z.string().optional().nullable(),
  qtyReceived: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? 0 : Number(v)),
    z.number().int().nonnegative()
  ),
  mrp: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
    z.number().positive().nullable()
  ),
  purchasePrice: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
    z.number().positive().nullable()
  ),
  expiryDate: z.string().optional().nullable(), // we'll parse to Date later; allow many formats
  supplierName: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
});

/**
 * Helper: parse XLSX buffer to rows (first sheet).
 * Returns array of raw objects (header normalized to camelCase).
 */
function parseXlsxBuffer(buffer: Buffer) {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const raw: any = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, {
    // @ts-ignore
    defval: null,
  });
  // normalize keys: lower-case, trim, replace spaces with camelCase-ish keys
  return raw.map((row) => {
    const out: Record<string, any> = {};
    for (const k of Object.keys(row)) {
      const key = String(k)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+([a-z0-9])/g, (_m, p1) => p1.toUpperCase())
        .replace(/[^a-z0-9]/g, "");
      out[key] = row[k];
    }
    return out;
  });
}

/**
 * Helper: try to coerce expiry values into ISO date string or null
 */
function parseExpiry(v: any): string | null {
  if (!v && v !== 0) return null;
  // Excel dates may be numbers (days since 1900) — xlsx library already converts when using sheet_to_json with defval?
  // Try Date
  const d = new Date(v);
  if (!isNaN(d.getTime())) return d.toISOString();
  // fallback: try parse string
  const s = String(v).trim();
  if (!s) return null;
  const d2 = new Date(s);
  if (!isNaN(d2.getTime())) return d2.toISOString();
  return null;
}

/**
 * POST /v1/inventory/upload?preview=true
 * Accepts multipart/form upload file field named "file"
 *
 * If preview=true -> parse and return preview rows + validation results (no DB writes)
 * If preview is absent/false -> apply immediately (writes) and return created counts + row errors
 *
 * Behavior:
 *  - For each valid row:
 *    * find or create Medicine by (storeId + brandName + sku?) - upserts minimal meta
 *    * find or create Supplier by name if provided and store-scoped
 *    * create InventoryBatch for the medicine with qtyReceived, qtyAvailable = qtyReceived, batchNumber, expiryDate, mrp, purchasePrice, receivedAt=now
 *    * create StockMovement of reason=RECEIPT with delta=qtyReceived
 *  - Row-level failures reported in response (index, error message)
 */
router.post(
  "/upload",
  authenticate,
  storeContext,
  requireStore,
  upload.single("file"),
  async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const store = req.store!;
      const user = req.user!;
      // @ts-ignore
      if (!req.file)
        return res.status(400).json({
          success: false,
          error: "file required (multipart form field 'file')",
        });

      const previewOnly =
        String(req.query.preview ?? "true").toLowerCase() !== "false";

      // parse file buffer
      // @ts-ignore
      const rowsRaw = parseXlsxBuffer(req.file.buffer);
      if (!rowsRaw.length)
        return res
          .status(400)
          .json({ success: false, error: "no rows found in sheet" });

      // map to expected columns heuristically
      // preferred column names that map to our schema keys
      const mappingHints = {
        brand: ["brand", "brandname", "product", "name"],
        generic: ["generic", "genericname"],
        sku: ["sku", "productcode", "code"],
        batch: ["batch", "batchnumber", "batchno"],
        qty: ["qty", "quantity", "qtyreceived", "amount"],
        mrp: ["mrp", "mrpprice"],
        purchasePrice: ["purchaseprice", "cost", "buyprice"],
        expiry: ["expiry", "expirydate", "exp", "expdate"],
        supplier: ["supplier", "suppliername", "vendor"],
        location: ["location", "storelocation"],
      };

      // normalize each raw row to our expected keys
      const normalized = rowsRaw.map((r, idx) => {
        // cheap heuristic: search for keys in row matching hints
        const out: Record<string, any> = {};
        const keys = Object.keys(r);
        const findKey = (hints: string[]) => {
          for (const h of hints) {
            const found = keys.find((k) => k.toLowerCase().includes(h));
            if (found) return found;
          }
          return null;
        };

        out.brandName =
          r[findKey(mappingHints.brand) ?? "brandname"] ??
          r["brandname"] ??
          r["brand"] ??
          null;
        out.genericName =
          r[findKey(mappingHints.generic) ?? "genericname"] ?? null;
        out.sku = r[findKey(mappingHints.sku) ?? "sku"] ?? null;
        out.batchNumber =
          r[findKey(mappingHints.batch) ?? "batchnumber"] ?? null;
        out.qtyReceived =
          r[findKey(mappingHints.qty) ?? "qtyreceived"] ?? r["qty"] ?? 0;
        out.mrp = r[findKey(mappingHints.mrp) ?? "mrp"] ?? null;
        out.purchasePrice =
          r[findKey(mappingHints.purchasePrice) ?? "purchaseprice"] ?? null;
        out.expiryDate =
          r[findKey(mappingHints.expiry) ?? "expirydate"] ?? null;
        out.supplierName =
          r[findKey(mappingHints.supplier) ?? "suppliername"] ?? null;
        out.location = r[findKey(mappingHints.location) ?? "location"] ?? null;

        return { rowIndex: idx + 1, raw: r, mapped: out };
      });

      // validate each mapped row
      const previewResults: Array<any> = [];
      for (const r of normalized) {
        const trimmed: Record<string, any> = { ...r.mapped };
        // coerce expiry to iso string or null
        trimmed.expiryDate = parseExpiry(trimmed.expiryDate);
        const validation = rowSchema.safeParse(trimmed);
        if (!validation.success) {
          previewResults.push({
            row: r.rowIndex,
            ok: false,
            errors: validation.error.issues.map(
              (i) => `${i.path.join(".")}: ${i.message}`
            ),
            mapped: trimmed,
          });
        } else {
          previewResults.push({
            row: r.rowIndex,
            ok: true,
            mapped: validation.data,
          });
        }
      }

      // If preview only: return preview results and summary counts
      if (previewOnly) {
        return res.json({
          success: true,
          preview: true,
          totalRows: previewResults.length,
          validRows: previewResults.filter((p) => p.ok).length,
          invalidRows: previewResults.filter((p) => !p.ok).length,
          rows: previewResults.slice(0, 200), // cap payload
        });
      }

      // APPLY: iterate rows and write to DB; collect row-level results
      const results: Array<any> = [];
      // we perform row writes sequentially to better report row-level failures and avoid massive DB transaction size.
      for (const pr of previewResults) {
        if (!pr.ok) {
          results.push({ row: pr.row, ok: false, errors: pr.errors });
          continue;
        }
        const r = pr.mapped as z.infer<typeof rowSchema>;
        try {
          // transaction per row: upsert medicine, optionally supplier, create InventoryBatch, create StockMovement
          const created = await prisma.$transaction(async (tx) => {
            // find or create medicine by storeId + (sku or brandName)
            let medicine: any = null;
            if (r.sku) {
              medicine = await tx.medicine.findFirst({
                where: { storeId: store.id, sku: String(r.sku) },
              });
            }
            if (!medicine) {
              // try brand/generic match
              medicine = await tx.medicine.findFirst({
                where: {
                  storeId: store.id,
                  brandName: String(r.brandName),
                },
              });
            }
            if (!medicine) {
              medicine = await tx.medicine.create({
                data: {
                  storeId: store.id ?? "",
                  brandName: String(r.brandName),
                  genericName: r.genericName ?? undefined,
                  sku: r.sku ?? undefined,
                  dosageForm: undefined,
                  strength: undefined,
                  uom: undefined,
                  category: undefined,
                },
                select: { id: true },
              });
            }

            // find or create supplier if name provided
            let supplierId: string | null = null;
            if (r.supplierName) {
              const ex = await tx.supplier.findFirst({
                where: { storeId: store.id, name: String(r.supplierName) },
              });
              if (ex) supplierId = ex.id;
              else {
                const createdSup = await tx.supplier.create({
                  data: {
                    storeId: store.id,
                    name: String(r.supplierName),
                  },
                  select: { id: true },
                });
                supplierId = createdSup.id;
              }
            }

            // build InventoryBatch
            const qty = Number(r.qtyReceived ?? 0);
            const batchData: any = {
              storeId: store.id,
              medicineId: medicine.id,
              batchNumber: r.batchNumber ?? undefined,
              qtyReceived: qty,
              qtyAvailable: qty,
              qtyReserved: 0,
              expiryDate: r.expiryDate ? new Date(r.expiryDate) : undefined,
              purchasePrice: r.purchasePrice ?? undefined,
              mrp: r.mrp ?? undefined,
              receivedAt: new Date(),
              location: r.location ?? undefined,
            };

            const batch = await tx.inventoryBatch.create({
              data: batchData,
              select: { id: true },
            });

            // add StockMovement record for this receipt
            await tx.stockMovement.create({
              data: {
                storeId: store.id ?? "",
                inventoryId: batch.id,
                medicineId: medicine.id,
                delta: qty,
                reason: "RECEIPT",
                note: `Upload by ${user.username ?? user.id}`,
                performedById: user.id,
              },
            });

            // optional: link supplier<->medicine
            if (supplierId) {
              // create many-to-many linking in Supplier.medicines is implicit relation in Prisma; use connect if relation exists
              // we created Supplier.medicines as array on Supplier side; we need a relation table? In schema it's direct relation array:
              await tx.supplier
                .update({
                  where: { id: supplierId },
                  data: {
                    medicines: { connect: { id: medicine.id } },
                  },
                })
                .catch(() => {}); // ignore unique/connect errors
            }

            return { medicineId: medicine.id, batchId: batch.id, qty };
          });

          results.push({ row: pr.row, ok: true, created });
        } catch (rowErr: any) {
          console.error("row apply error row", pr.row, rowErr);
          results.push({
            row: pr.row,
            ok: false,
            errors: [String(rowErr.message ?? rowErr)],
          });
        }
      }

      const createdCount = results.filter((r) => r.ok).length;
      const failedCount = results.length - createdCount;

      return res.json({
        success: true,
        preview: false,
        totalRows: results.length,
        createdCount,
        failedCount,
        results: results.slice(0, 200),
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /v1/inventory/template
 * Returns an XLSX template for uploads (headers + example row)
 */
router.get(
  "/template",
  authenticate,
  storeContext,
  requireStore,
  async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const headers = [
        "Brand Name",
        "Generic Name",
        "SKU",
        "Batch Number",
        "Qty Received",
        "MRP",
        "Purchase Price",
        "Expiry Date (YYYY-MM-DD or Excel date)",
        "Supplier Name",
        "Location",
      ];

      const exampleRow = [
        "Paracetamol 500mg Tablet",
        "Paracetamol",
        "PARA-500",
        "BATCH-001",
        100,
        50.0,
        30.0,
        new Date().toISOString().slice(0, 10),
        "Acme Pharma",
        "Shelf A1",
      ];

      // cast utils to any to avoid typing issues
      const utils: any = XLSX.utils as any;

      const wb: any = utils.book_new();
      const ws = utils.aoa_to_sheet([headers, exampleRow]);

      // append a blank row then a note row
      utils.sheet_add_aoa(ws, [[]], { origin: -1 });
      utils.sheet_add_aoa(
        ws,
        [
          [
            "Notes:",
            "Keep column names unchanged. Use ISO dates (YYYY-MM-DD) or Excel date cells for Expiry Date.",
          ],
        ],
        { origin: -1 }
      );

      utils.book_append_sheet(wb, ws, "template");

      const buffer = XLSX.write(wb, {
        type: "buffer",
        bookType: "xlsx",
      });

      const filename = `inventory-upload-template.xlsx`;
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`
      );
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      return res.send(buffer);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
