
// src/routes/v1/dashboard.ts
import { Router, Request, Response, NextFunction } from "express";
import { storeContext, requireStore, RequestWithUser } from "../../../middleware/store";
import { authenticate } from "../../../middleware/authenticate";
import type { Role } from "@prisma/client";
import prisma from "../../../lib/prisma";
import { requireRole } from "../../../middleware/requireRole";
import { crypto$ } from "../../../lib/crypto";
import { sendMail } from "../../../lib/mailer";
import { getRequestAcceptedEmailTemplate, getRequestRejectedEmailTemplate, getStoreConnectionRequestEmailTemplate, getSupplierRequestEmailTemplate, getDisconnectionEmailTemplate, getReorderRequestEmailTemplate } from "../../../lib/emailTemplates";
// import router from "../auth/email-auth"; 
import { sendSuccess, sendError, handlePrismaError, sendInternalError, handleZodError } from "../../../lib/api";
import { notificationQueue } from "../../../lib/queue";
import { z } from "zod";
import PDFDocument from "pdfkit";
import { generateReceiptPDF } from "../../../utils/receipt_generator";
import { decryptCell, dekFromEnv } from "../../../middleware/prisma_crypto_middleware";

type RoleEnum = Role;

type AuthRequest = Request & {
  user?: {
    id: string;
    username?: string | null;
    email?: string | null;
    globalRole?: RoleEnum | null;
  };
  store?: any;
  userStoreRoles?: RoleEnum[];
};

const dashboardRouter = Router();

/**
 * Middleware stack:
 *  - authenticate populates req.user
 *  - storeContext populates req.store and req.userStoreRoles (single-store)
 *  - requireStore enforces a store exists
 */
dashboardRouter.use(authenticate);
dashboardRouter.use(storeContext);
dashboardRouter.use(requireStore);

/**
 * Utility - derive capability flags from role list (conservative)
 */
function permissionsForRoles(roles: RoleEnum[] = []) {
  const has = (r: RoleEnum) => roles.includes(r);

  const canManageUsers =
    has("SUPERADMIN") || has("STORE_OWNER");
  const canEditInventory = canManageUsers || has("MANAGER") || has("STAFF");
  const canCreateReorder =
    canManageUsers || has("MANAGER") || has("STORE_OWNER");
  const canAcknowledgeAlerts = canManageUsers || has("MANAGER") || has("STAFF");
  const canViewReports = canManageUsers || has("MANAGER") || has("READ_ONLY");

  return {
    canEditInventory,
    canCreateReorder,
    canAcknowledgeAlerts,
    canViewReports,
    canManageUsers,
  };
}

/**
 * GET /v1/dashboard/store
 * Description: Returns the current store context and permissions for the authenticated user.
 * Headers: 
 *  - Authorization: Bearer <token>
 * Body: None
 * Responses:
 *  - 200: { success: true, data: { user: {...}, store: {...}, roles: [...], permissions: {...} } }
 *  - 401: Unauthenticated
 *  - 403: No store found or Forbidden
 *  - 500: Internal server error
 */
dashboardRouter.get(
  "/store",
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      if (!user) return sendError(res, "Unauthenticated", 401);

      const store = req.store;
      if (!store) {
        return sendError(res, "No store found in context", 403, { code: "no_store_found", needsStoreSetup: true });
      }

      const roles = (req.userStoreRoles ?? []) as RoleEnum[];
      if (roles.length === 0 && user.globalRole !== "SUPERADMIN") {
        return sendError(res, "Forbidden: No role in this store", 403);
      }

      const permissions = permissionsForRoles(roles);

      res.setHeader(
        "Cache-Control",
        "private, max-age=60, stale-while-revalidate=30"
      );

      return sendSuccess(res, "Store context retrieved", {
        user: {
          id: user.id,
          username: user.username ?? null,
          email: user.email ?? null,
          globalRole: user.globalRole ?? null,
        },
        store: {
          id: store.id,
          name: store.name,
          slug: store.slug,
          timezone: store.timezone ?? null,
          currency: store.currency ?? null,
          settings: store.settings ?? null,
        },
        roles,
        permissions,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /v1/dashboard/bootstrap
 * Description: Bootstraps the dashboard with extensive data (sales, inventory, low stock, etc.).
 * Headers: 
 *  - Authorization: Bearer <token>
 * Query Params:
 *  - days: number (default 30) - number of days for sales window
 *  - top: number (default 10) - limit for top movers
 *  - recent: number (default 20) - limit for recent sales
 *  - threshold: number (default 5) - low stock threshold
 *  - expiriesDays: number (default 90) - expiry lookahead
 * Body: None
 * Responses:
 *  - 200: { success: true, data: { user: {...}, store: {...}, overview: {...}, charts: {...}, lists: {...} } }
 *  - 401: Unauthenticated
 *  - 403: No store found
 *  - 500: Internal server error
 */
dashboardRouter.get(
  "/bootstrap",
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      if (!user) return sendError(res, "Unauthenticated", 401);

      const store = req.store;
      if (!store)
        return sendError(res, "No store found", 403, { code: "no_store_found", needsStoreSetup: true });

      const storeId = String(store.id);

      // query params / limits
      const days = Math.max(Number(req.query.days ?? 30), 7);
      const topLimit = Math.min(Math.max(Number(req.query.top ?? 10), 1), 100);
      const recentSalesLimit = Math.min(
        Math.max(Number(req.query.recent ?? 20), 1),
        200
      );
      const lowStockThreshold = Math.max(Number(req.query.threshold ?? 5), 1);
      const expiriesDays = Math.max(Number(req.query.expiriesDays ?? 90), 1);
      const agingBuckets = req.query.agingBuckets
        ? String(req.query.agingBuckets)
          .split(",")
          .map((s) => Number(s))
        : [30, 90, 180, 365]; // days
      const salesWindowStart = new Date(
        Date.now() - days * 24 * 60 * 60 * 1000
      );
      const expiriesHorizon = new Date(
        Date.now() + expiriesDays * 24 * 60 * 60 * 1000
      );

      // 2. Parallel Optimized Fetches
      const [
        totalMedicines,
        totalBatches,
        // recentSalesCount removed (duplicate of salesStats._count)
        recentRevenueAgg,
        inventorySums,
        lowStockBatches,
        expiriesSoon,
        topMoversRaw,
        recentSales,
        activity,
        suppliers,
        webhookFailures,
        // Aggregations replacing huge fetches
        salesStats, // avg order value, count
        salesByDayRaw,
        salesByHourRaw,
        paymentMethodsAgg,
        categoryBreakdownRaw,
        stockTurnoverAgg,
        agingBucketsRaw // Optimization for aging buckets? 
      ] = await Promise.all([
        prisma.medicine.count({ where: { storeId } }),
        prisma.inventoryBatch.count({ where: { storeId } }),
        // prisma.sale.count removed
        prisma.sale.aggregate({
          where: {
            storeId,
            createdAt: { gte: salesWindowStart },
            paymentStatus: "PAID",
          },
          _sum: { totalValue: true },
        }),
        // Inventory Totals
        prisma.inventoryBatch.aggregate({
          where: { storeId },
          _sum: { qtyAvailable: true, qtyReserved: true, qtyReceived: true },
        }),
        // Low Stock (enriched)
        prisma.inventoryBatch.findMany({
          where: { storeId, qtyAvailable: { lte: lowStockThreshold } },
          orderBy: { qtyAvailable: "asc" },
          take: 200,
          include: { medicine: true }
        }),
        // Expiries (enriched)
        prisma.inventoryBatch.findMany({
          where: {
            storeId,
            expiryDate: { not: null, lte: expiriesHorizon },
            qtyAvailable: { gt: 0 },
          },
          orderBy: { expiryDate: "asc" },
          take: 500,
          include: { medicine: true }
        }),
        // Top Movers (qty)
        prisma.saleItem.groupBy({
          by: ["medicineId"],
          where: {
            sale: {
              storeId,
              createdAt: { gte: salesWindowStart },
              paymentStatus: "PAID",
            },
          },
          _sum: { qty: true, lineTotal: true },
          orderBy: [{ _sum: { qty: "desc" } }],
          take: topLimit,
        }),
        // Recent Sales (enriched)
        prisma.sale.findMany({
          where: { storeId },
          orderBy: { createdAt: "desc" },
          take: recentSalesLimit,
          include: {
            items: {
              include: { medicine: true } // Include medicine details directly
            },
          },
        }),
        // Activity
        prisma.activityLog.findMany({
          where: { storeId },
          orderBy: { createdAt: "desc" },
          take: 4,
          select: {
            id: true,
            userId: true,
            action: true,
            payload: true,
            createdAt: true,
          },
        }),
        // Suppliers (Owned OR Connected)
        prisma.supplier.findMany({
          where: {
            OR: [
              { storeId },
              { supplierStores: { some: { storeId } } }
            ]
          },
          select: {
            id: true,
            name: true,
            phone: true,
            contactName: true,
            isActive: true,
            user: {
              select: { email: true }
            }
          },
        }),
        Promise.resolve(0), // Webhooks placeholder

        // --- NEW AGGREGATIONS ---

        // AVG Order Value & Total Items (approx) & Count (replacing standalone count)
        prisma.sale.aggregate({
          where: { storeId, createdAt: { gte: salesWindowStart } },
          _avg: { totalValue: true },
          _count: true
        }),

        // Sales by Day
        prisma.$queryRaw`
            SELECT TO_CHAR("createdAt", 'YYYY-MM-DD') as date, 
                   COUNT(*)::int as count, 
                   SUM("totalValue") as revenue
            FROM "Sale"
            WHERE "storeId" = ${storeId} AND "createdAt" >= ${salesWindowStart}
            GROUP BY TO_CHAR("createdAt", 'YYYY-MM-DD')
            ORDER BY date ASC
        `,

        // Sales by Hour
        prisma.$queryRaw`
            SELECT EXTRACT(HOUR FROM "createdAt")::int as hour, 
                   COUNT(*)::int as count, 
                   SUM("totalValue") as revenue
            FROM "Sale"
            WHERE "storeId" = ${storeId} AND "createdAt" >= ${salesWindowStart}
            GROUP BY EXTRACT(HOUR FROM "createdAt")
            ORDER BY hour ASC
        `,

        // Payment Methods
        prisma.sale.groupBy({
          by: ['paymentMethod'],
          where: { storeId, createdAt: { gte: salesWindowStart } },
          _count: true,
          _sum: { totalValue: true }
        }),

        // Category Breakdown
        prisma.$queryRaw`
            SELECT m.category, 
                   SUM(si.qty)::int as qty, 
                   SUM(si."lineTotal") as revenue
            FROM "SaleItem" si
            JOIN "Sale" s ON s.id = si."saleId"
            JOIN "Medicine" m ON m.id = si."medicineId"
            WHERE s."storeId" = ${storeId} 
              AND s."createdAt" >= ${salesWindowStart} 
              AND s."paymentStatus" = 'PAID'
            GROUP BY m.category
            ORDER BY revenue DESC
        `,

        // Stock Movements (for turnover)
        prisma.stockMovement.groupBy({
          by: ["reason"],
          where: { storeId },
          _sum: { delta: true },
        }),

        // Inventory Aging (Optimized to fetching just dates, not full objects if possible, or just standard fetch)
        // Check if we can do this with raw query? 
        // "receivedAt" buckets: <30, 30-90, 90-180, 180-365, >365
        prisma.$queryRaw`
            SELECT 
                CASE 
                    WHEN NOW() - "receivedAt" <= interval '30 days' THEN '30_days'
                    WHEN NOW() - "receivedAt" <= interval '90 days' THEN '90_days'
                    WHEN NOW() - "receivedAt" <= interval '180 days' THEN '180_days'
                    WHEN NOW() - "receivedAt" <= interval '365 days' THEN '365_days'
                    ELSE '>365_days'
                END as bucket,
                SUM("qtyAvailable")::int as qty
            FROM "InventoryBatch"
            WHERE "storeId" = ${storeId} AND "receivedAt" IS NOT NULL
            GROUP BY bucket
        `
      ]);

      // Cache for 30s
      res.setHeader('Cache-Control', 'private, max-age=10, stale-while-revalidate=30');

      // --- Processing ---

      const recentSalesCount = salesStats._count ?? 0;

      const recentRevenue = Number(recentRevenueAgg._sum?.totalValue ?? 0);
      const inventoryTotals = {
        qtyAvailable: Number(inventorySums._sum.qtyAvailable ?? 0),
        qtyReserved: Number(inventorySums._sum.qtyReserved ?? 0),
        qtyReceived: Number(inventorySums._sum.qtyReceived ?? 0),
      };

      // Helper to fetch medicine details for Top Movers (since groupBy doesn't include relation)
      const topMoverMedIds = topMoversRaw.map(t => t.medicineId);
      const topMoverMeds = await prisma.medicine.findMany({
        where: { id: { in: topMoverMedIds } },
        select: { id: true, brandName: true, genericName: true, category: true, sku: true, strength: true, dosageForm: true }
      });
      const topMoverMedsMap = Object.fromEntries(topMoverMeds.map(m => [m.id, m]));

      // Enrich Top Movers
      const topMovers = topMoversRaw.map((t: any) => ({
        medicineId: t.medicineId,
        qtySold: Number(t._sum.qty ?? 0),
        revenue: Number(t._sum.lineTotal ?? 0),
        medicine: topMoverMedsMap[t.medicineId] ?? null,
      }));

      // Parse Raw Aggregations
      const salesByDay = (salesByDayRaw as any[]).map(r => ({
        date: r.date,
        count: Number(r.count),
        revenue: Number(r.revenue)
      }));

      // Sales By Hour (fill gaps)
      const salesByHourMap: Record<number, any> = {};
      for (let h = 0; h < 24; h++) salesByHourMap[h] = { hour: h, count: 0, revenue: 0 };
      (salesByHourRaw as any[]).forEach(r => {
        salesByHourMap[r.hour] = { hour: r.hour, count: Number(r.count), revenue: Number(r.revenue) };
      });
      const salesByHour = Object.values(salesByHourMap);

      const paymentMethods = paymentMethodsAgg.map(p => ({
        method: p.paymentMethod || "UNKNOWN",
        count: p._count,
        revenue: Number(p._sum.totalValue ?? 0)
      }));

      const categoryBreakdown = (categoryBreakdownRaw as any[]).map(r => ({
        category: r.category || "Uncategorized",
        qty: Number(r.qty),
        revenue: Number(r.revenue)
      }));

      const avgOrderValue = Number(salesStats._avg.totalValue ?? 0);
      // Avg Items Per Sale - We need total sold items / total sales count
      // We can query sum of qty from sales in window
      const totalSoldQtyAgg = await prisma.saleItem.aggregate({
        where: { sale: { storeId, createdAt: { gte: salesWindowStart } } },
        _sum: { qty: true }
      });
      const totalSoldQtyInWindow = Number(totalSoldQtyAgg._sum.qty ?? 0);
      const avgItemsPerSale = (salesStats._count ?? 0) > 0 ? totalSoldQtyInWindow / salesStats._count : 0;


      // Inventory Aging
      const agingBucketsResult: Record<string, number> = {};
      // Initialize buckets
      for (const b of agingBuckets) agingBucketsResult[`${b}_days`] = 0;
      agingBucketsResult[">365_days"] = 0;

      (agingBucketsRaw as any[]).forEach(r => {
        if (agingBucketsResult[r.bucket] !== undefined) {
          agingBucketsResult[r.bucket] = Number(r.qty);
        }
      });


      // Expiry Heatmap
      const expiryHeatmap: Record<string, { count: number; qty: number }> = {};
      for (const b of expiriesSoon) {
        const m = new Date(b.expiryDate!).toISOString().slice(0, 7); // YYYY-MM
        expiryHeatmap[m] = expiryHeatmap[m] || { count: 0, qty: 0 };
        expiryHeatmap[m].count += 1;
        expiryHeatmap[m].qty += b.qtyAvailable ?? 0;
      }
      const expiryHeatmapArr = Object.entries(expiryHeatmap)
        .map(([month, v]) => ({ month, ...v }))
        .sort((a, b) => a.month.localeCompare(b.month));


      // Stock Turnover
      // soldQtyTotal / qtyReceivedTotal
      // soldQtyTotal is total sold EVER? Or in window? 
      // Original code used `saleItemsSoldAgg` which was grouped by medicine for PAID sales (ever).
      // We need total sold qty all time? Or just fetch aggregations.
      // Let's do a quick aggregate for "all time paid sales qty"
      const totalSoldAllTimeAgg = await prisma.saleItem.aggregate({
        where: { sale: { storeId, paymentStatus: "PAID" } },
        _sum: { qty: true }
      });
      const soldQtyTotal = Number(totalSoldAllTimeAgg._sum.qty ?? 0);
      const qtyReceivedTotal = Number(inventorySums._sum.qtyReceived ?? 0) || 1;
      const stockTurnover = soldQtyTotal / qtyReceivedTotal;


      // recentSalesSummary - map items to use included medicine
      const recentSalesSummary = recentSales.map((s: any) => ({
        id: s.id,
        createdAt: s.createdAt,
        totalValue: Number(s.totalValue ?? 0),
        paymentStatus: s.paymentStatus,
        items: s.items.map((it: any) => ({
          ...it,
          medicine: it.medicine // Already included
        })),
      }));


      // Final payload
      return sendSuccess(res, "Dashboard bootstrap data", {
        user: {
          id: user.id,
          username: user.username ?? null,
          email: user.email ?? null,
          globalRole: user.globalRole ?? null,
        },
        store: {
          id: store.id,
          name: store.name,
          slug: store.slug,
          timezone: store.timezone ?? null,
          currency: store.currency ?? null,
          settings: store.settings ?? null,
        },
        overview: {
          totalMedicines,
          totalBatches,
          totalActiveAlerts: 0,
          totalPendingReorders: 0,
          recentSalesCount,
          recentRevenue,
          unreadNotifications: 0,
          webhookFailures,
          inventoryTotals,
          reservationsCount: 0,
          reservedQty: 0,
        },
        charts: {
          salesByDay: salesByDay,
          salesByHour,
          paymentMethods,
          categoryBreakdown,
          topMovers,
          supplierPerformance: [],
          expiryHeatmap: expiryHeatmapArr,
          inventoryAging: agingBucketsResult,
          reorderLeadTimeSummary: [],
          alertsByType: [],
          stockTurnover,
          avgOrderValue,
          avgItemsPerSale,
          repeatCustomerRate: 0,
        },
        lists: {
          lowStock: lowStockBatches, // Already includes medicine
          expiries: expiriesSoon,    // Already includes medicine
          recentSales: recentSalesSummary,
          activity,
          suppliers,
          recentReceivedReorders: [],
        },
      });
    } catch (err) {
      next(err);
    }
  }
);



/**
 * GET /v1/dashboard/supplier-requests
 * Description: Lists all supplier requests for the current store.
 * Headers: 
 *  - Authorization: Bearer <token> (Role: STORE_OWNER or ADMIN)
 * Body: None
 * Responses:
 *  - 200: { success: true, data: [...] }
 *  - 500: Internal server error
 */
dashboardRouter.get(
  "/supplier-requests",
  authenticate,
  storeContext,
  requireStore,
  requireRole(["STORE_OWNER"]),
  async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const store = req.store!;

      const supplierRequests = await prisma.supplierRequest.findMany({
        where: {
          storeId: store.id,
        },
        orderBy: {
          createdAt: "desc",
        },
        include: {
          supplier: true
        }
      });

      return sendSuccess(res, "Supplier requests retrieved", supplierRequests);
    } catch (err) {
      next(err);
    }
  }
);






// STORE OWNER ACCEPT AND REJECT REQUEST

/**
 * POST /v1/dashboard/:id/accept
 * Description: Accepts a supplier request.
 * Headers: 
 *  - Authorization: Bearer <token> (Role: STORE_OWNER or ADMIN)
 * Body: None
 * Path Params:
 *  - id: string (Request UUID)
 * Responses:
 *  - 200: { success: true, message: "accepted" }
 *  - 400: Invalid state
 *  - 404: Request not found
 *  - 500: Internal server error
 */
dashboardRouter.post(
  "/:id/accept",
  authenticate,
  storeContext,
  requireStore,
  requireRole(["STORE_OWNER"]),
  async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const id = String(req.params.id);
      const store = req.store!;
      const user = req.user!;

      const reqRow = await prisma.supplierRequest.findUnique({ where: { id } });
      if (!reqRow || reqRow.storeId !== store.id)
        return sendError(res, "Request not found", 404);

      if (reqRow.status !== "PENDING")
        return sendError(res, "Invalid request state (must be PENDING)", 400);

      await prisma.$transaction(async (tx) => {
        await tx.supplierRequest.update({
          where: { id },
          data: { status: "ACCEPTED" },
        });
        await tx.supplierStore.upsert({
          where: {
            supplierId_storeId: {
              supplierId: reqRow.supplierId,
              storeId: store.id,
            },
          },
          create: {
            supplierId: reqRow.supplierId,
            storeId: store.id,
            linkedAt: new Date(),
          },
          update: { linkedAt: new Date() },
        });
        await tx.activityLog.create({
          data: {
            storeId: store.id,
            userId: user.id,
            action: "supplier_request_accepted",
            payload: { requestId: id, supplierId: reqRow.supplierId },
          },
        });
      }, { timeout: 45000 });

      // notify supplier (if supplier.userId exists)
      // notify supplier (if supplier.userId exists)
      const sup = await prisma.supplier.findUnique({
        where: { id: reqRow.supplierId },
      });
      if (sup?.userId) {
        // EMAIL - need to fetch user email (encrypted?)
        const supUser = await prisma.user.findUnique({
          where: { id: sup.userId },
          select: { email: true },
        });
        if (supUser?.email) {
          const supEmail = supUser.email;
          if (supEmail) {
            try {
              await sendMail({
                to: supEmail,
                subject: `Request Accepted: ${store.name}`,
                html: getRequestAcceptedEmailTemplate(store.name),
              });
            } catch (e) {
              console.error("Failed to send email to supplier:", e);
            }
          }

          // NOTIFICATION WORKER removed as per requirement

        }
      }

      return sendSuccess(res, "Supplier request accepted");
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /v1/dashboard/:id/reject
 * Description: Rejects a supplier request.
 * Headers: 
 *  - Authorization: Bearer <token> (Role: STORE_OWNER or ADMIN)
 * Body: None
 * Path Params:
 *  - id: string (Request UUID)
 * Responses:
 *  - 200: { success: true, message: "rejected" }
 *  - 400: Invalid state
 *  - 404: Request not found
 *  - 500: Internal server error
 */
dashboardRouter.post(
  "/:id/reject",
  authenticate,
  storeContext,
  requireStore,
  requireRole(["STORE_OWNER"]),
  async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const id = String(req.params.id);
      const store = req.store!;
      const user = req.user!;

      const reqRow = await prisma.supplierRequest.findUnique({ where: { id } });
      if (!reqRow || reqRow.storeId !== store.id)
        return sendError(res, "Request not found", 404);

      if (reqRow.status !== "PENDING")
        return sendError(res, "Invalid request state", 400);

      await prisma.supplierRequest.update({
        where: { id },
        data: { status: "REJECTED" },
      });
      await prisma.activityLog.create({
        data: {
          storeId: store.id,
          userId: user.id,
          action: "supplier_request_rejected",
          payload: { requestId: id },
        },
      });

      const sup = await prisma.supplier.findUnique({
        where: { id: reqRow.supplierId },
      });
      if (sup?.userId) {
        // EMAIL
        const supUser = await prisma.user.findUnique({
          where: { id: sup.userId },
          select: { email: true },
        });
        if (supUser?.email) {
          const supEmail = supUser.email;
          if (supEmail) {
            try {
              await sendMail({
                to: supEmail,
                subject: `Request Update: ${store.name}`,
                html: getRequestRejectedEmailTemplate(store.name),
              });
            } catch (e) {
              console.error("Failed to send email to supplier:", e);
            }
          }
          // NOTIFICATION WORKER removed as per requirement

        }
      }

      return sendSuccess(res, "Supplier request rejected");
    } catch (err) {
      next(err);
    }
  }
);




/**
 * GET /v1/dashboard/suppliers-directory
 * Description: List all active suppliers for the directory, including connection status.
 */
dashboardRouter.get(
  "/suppliers-directory",
  authenticate,
  storeContext,
  requireStore,
  requireRole(["STORE_OWNER", "MANAGER"]),
  async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const store = req.store!;
      const q = req.query.q ? String(req.query.q).trim() : "";

      const where: any = { isActive: true };
      if (q) {
        where.name = { contains: q, mode: "insensitive" };
      }

      // Fetch all basic suppliers first
      // Assuming Prisma Crypto Middleware handles field decryption automatically
      const suppliers = await prisma.supplier.findMany({
        where,
        select: {
          id: true,
          name: true,
          contactName: true,
          phone: true,
          address: true,
          // include user email for display
          user: {
            select: { email: true }
          }
        },
        take: 50, // limit for directory
      });

      // Fetch connections to determine status
      const existingConnections = await prisma.supplierStore.findMany({
        where: { storeId: store.id },
        select: { supplierId: true }
      });
      const connectedSet = new Set(existingConnections.map(c => c.supplierId));

      // Fetch pending requests with createdById
      const pendingReqs = await prisma.supplierRequest.findMany({
        where: { storeId: store.id, status: "PENDING" },
        select: { id: true, supplierId: true, createdById: true, createdAt: true }
      });
      const pendingMap = new Map(pendingReqs.map(r => [r.supplierId, r]));

      // Map results with status
      const directory = suppliers.map((s: any) => {
        const req: any = pendingMap.get(s.id);
        let status = "NONE";
        let requestId = null;
        let requestDate = null;

        if (connectedSet.has(s.id)) {
          status = "CONNECTED";
        } else if (req) {
          requestId = req.id;
          requestDate = req.createdAt;
          // Check if inbound or outbound
          // If createdById matches the supplier's userId, it is Inbound (Supplier -> Store)
          if (s.userId && req.createdById === s.userId) {
            status = "PENDING_INBOUND";
          } else {
            status = "PENDING_OUTBOUND";
          }
        }

        return {
          id: s.id,
          name: s.name,
          contactName: s.contactName,
          phone: s.phone,
          address: s.address,
          email: s.user?.email || null,
          connectionStatus: status,
          requestId,
          requestDate
        };
      });

      return sendSuccess(res, "Suppliers directory retrieved", { suppliers: directory });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /v1/dashboard/supplier-requests
 * Description: Store Owner initiates a connection request to a supplier.
 */
const createReqSchema = z.object({
  supplierId: z.string().uuid(),
  message: z.string().optional(),
});

dashboardRouter.post(
  "/supplier-requests",
  authenticate,
  storeContext,
  requireStore,
  requireRole(["STORE_OWNER"]),
  async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const parsed = createReqSchema.safeParse(req.body);
      if (!parsed.success) {
        // @ts-ignore
        return handleZodError(res, parsed.error);
      }

      const store = req.store!;
      const user = req.user!;
      const { supplierId, message } = parsed.data;

      // Check if supplier exists
      const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
      if (!supplier) return sendError(res, "Supplier not found", 404);

      // Check if already connected
      const existingConn = await prisma.supplierStore.findUnique({
        where: {
          supplierId_storeId: {
            supplierId,
            storeId: store.id
          }
        }
      });
      if (existingConn) return sendError(res, "Already connected to this supplier", 409);

      // Check if pending request exists
      const existing = await prisma.supplierRequest.findFirst({
        where: { supplierId: parsed.data.supplierId, storeId: store.id, status: "PENDING" },
      });
      if (existing) return sendError(res, "Request already pending", 409);

      const newReq = await prisma.supplierRequest.create({
        data: {
          supplierId: parsed.data.supplierId,
          storeId: store.id,
          message: parsed.data.message ?? undefined,
          createdById: user.id,
          status: "PENDING"
        },
      });

      // Notify Supplier
      if (supplier.userId) {
        const supUser = await prisma.user.findUnique({ where: { id: supplier.userId } });
        if (supUser?.email) {
          sendMail({
            to: supUser.email,
            subject: `New Connection Request from ${store.name}`,
            html: getStoreConnectionRequestEmailTemplate(store.name, message)
          }).catch(e => console.error("Email failed", e));
        }
      }

      await prisma.activityLog.create({
        data: {
          storeId: store.id,
          userId: user.id,
          action: "supplier_request_created",
          payload: { requestId: newReq.id, supplierId }
        }
      });

      return sendSuccess(res, "Connection request sent", newReq);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /v1/dashboard/suppliers/:supplierId
 * Description: Disconnects the store from a supplier.
 * Headers: 
 *  - Authorization: Bearer <token> (Role: STORE_OWNER or ADMIN)
 * Body: None
 * Responses:
 *  - 200: { success: true }
 *  - 404: Connection not found
 *  - 500: Internal server error
 */
dashboardRouter.delete(
  "/suppliers/:supplierId",
  authenticate,
  storeContext,
  requireStore,
  requireRole(["STORE_OWNER"]),
  async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const { supplierId } = req.params;
      const store = req.store!;
      const user = req.user!;

      // Check if connection exists
      const conn = await prisma.supplierStore.findUnique({
        where: {
          supplierId_storeId: {
            supplierId,
            storeId: store.id
          }
        }
      });

      if (!conn) return sendError(res, "Connection not found", 404);

      // Delete connection
      await prisma.supplierStore.delete({
        where: {
          supplierId_storeId: {
            supplierId,
            storeId: store.id
          }
        }
      });

      await prisma.supplierRequest.deleteMany({
        where: {
          storeId: store.id,
          supplierId
        }
      })

      // Delete ALL requests (Accepted, Pending, etc.) to ensure clean re-discovery
      await prisma.supplierRequest.deleteMany({
        where: {
          supplierId,
          storeId: store.id
        }
      });

      // Also mark any ACCEPTED requests as... actually keep them as history.
      // But maybe we should cleanup pending ones?
      // If there is a PENDING request, cancelling connection (if initiated) should cancel request?
      // Usually "Disconnect" button is for Active connections.
      // "Cancel Request" button is for Pending.
      // We'll stick to Disconnect = Delete SupplierStore.

      // If the user wants to cancel a pending request, they can use a different endpoint or we can overload this one?
      // Let's assume this is for active connections.
      // For pending requests, we can add DELETE /supplier-requests/:id

      await prisma.activityLog.create({
        data: {
          storeId: store.id,
          userId: user.id,
          action: "supplier_disconnected",
          payload: { supplierId }
        }
      });

      // Notify Supplier
      const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
      if (supplier && supplier.userId) {
        const supUser = await prisma.user.findUnique({ where: { id: supplier.userId } });
        if (supUser?.email) {
          sendMail({
            to: supUser.email,
            subject: `Connection Ended: ${store.name}`,
            html: getDisconnectionEmailTemplate(store.name)
          }).catch(e => console.error("Email failed", e));
        }
      }

      return sendSuccess(res, "Disconnected from supplier");
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /v1/dashboard/:requestId/accept
 * Description: Store owner accepts a supplier's inbound request.
 */
dashboardRouter.post(
  "/:requestId/accept",
  authenticate,
  storeContext,
  requireStore,
  requireRole(["STORE_OWNER"]),
  async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const { requestId } = req.params;
      const store = req.store!;
      const user = req.user!;

      const request = await prisma.supplierRequest.findUnique({ where: { id: requestId } });
      if (!request) return sendError(res, "Request not found", 404);
      if (request.storeId !== store.id) return sendError(res, "Unauthorized request", 403);
      if (request.status !== "PENDING") return sendError(res, "Request is not pending", 400);

      // Verify connection doesn't already exist
      const existingConn = await prisma.supplierStore.findUnique({
        where: { supplierId_storeId: { supplierId: request.supplierId, storeId: store.id } }
      });
      if (existingConn) {
        // just update status if needed
        await prisma.supplierRequest.update({ where: { id: requestId }, data: { status: "ACCEPTED" } });
        return sendSuccess(res, "Already connected");
      }

      await prisma.$transaction(async (tx) => {
        // Update request
        await tx.supplierRequest.update({
          where: { id: requestId },
          data: { status: "ACCEPTED" }
        });

        // Create connection
        await tx.supplierStore.create({
          data: {
            supplierId: request.supplierId,
            storeId: store.id,
            linkedAt: new Date()
          }
        });

        // Log Activity
        await tx.activityLog.create({
          data: {
            storeId: store.id,
            userId: user.id,
            action: "store_owner_request_accepted",
            payload: { requestId, supplierId: request.supplierId }
          }
        });
      });

      // Notify Supplier
      const supplier = await prisma.supplier.findUnique({ where: { id: request.supplierId } });
      if (supplier && supplier.userId) {
        const supUser = await prisma.user.findUnique({ where: { id: supplier.userId } });
        if (supUser?.email) {
          sendMail({
            to: supUser.email,
            subject: `Request Accepted: ${store.name}`,
            html: getRequestAcceptedEmailTemplate(store.name)
          }).catch(e => console.error("Email failed", e));
        }
      }

      return sendSuccess(res, "Request accepted");
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /v1/dashboard/:requestId/reject
 * Description: Store owner rejects a supplier's inbound request.
 */
dashboardRouter.post(
  "/:requestId/reject",
  authenticate,
  storeContext,
  requireStore,
  requireRole(["STORE_OWNER"]),
  async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const { requestId } = req.params;
      const store = req.store!;
      const user = req.user!;

      const request = await prisma.supplierRequest.findUnique({ where: { id: requestId } });
      if (!request) return sendError(res, "Request not found", 404);
      if (request.storeId !== store.id) return sendError(res, "Unauthorized request", 403);

      // Allow rejecting pending
      if (request.status !== "PENDING") return sendError(res, "Request is not pending", 400);

      await prisma.supplierRequest.update({
        where: { id: requestId },
        data: { status: "REJECTED" }
      });

      await prisma.activityLog.create({
        data: {
          storeId: store.id,
          userId: user.id,
          action: "store_owner_request_rejected",
          payload: { requestId, supplierId: request.supplierId }
        }
      });

      // Notify Supplier
      const supplier = await prisma.supplier.findUnique({ where: { id: request.supplierId } });
      if (supplier && supplier.userId) {
        const supUser = await prisma.user.findUnique({ where: { id: supplier.userId } });
        if (supUser?.email) {
          sendMail({
            to: supUser.email,
            subject: `Request Declined: ${store.name}`,
            html: getRequestRejectedEmailTemplate(store.name)
          }).catch(e => console.error("Email failed", e));
        }
      }

      return sendSuccess(res, "Request rejected");
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /v1/dashboard/inventory
 * Description: List all medicines with comprehensive inventory data for reordering.
 */
dashboardRouter.get(
  "/inventory",
  authenticate,
  storeContext,
  requireStore,
  async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const store = req.store!;
      const q = (req.query.q as string || "").toLowerCase();

      // Fetch all active medicines for store (filtering in memory after decryption)
      const medicines = await prisma.medicine.findMany({
        where: { storeId: store.id, isActive: true },
        include: {
          inventory: {
            where: { qtyAvailable: { gt: 0 } },
            orderBy: { expiryDate: 'asc' }
          },
          suppliers: {
            select: { id: true, name: true, contactName: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      const dek = dekFromEnv();

      const result = medicines.map(m => {
        let brandName = m.brandName;
        let genericName = m.genericName;
        let strength = m.strength;

        try {
          // Decrypt fields
          const db = decryptCell(m.brandName, dek); if (db) brandName = db;
          const dg = decryptCell(m.genericName, dek); if (dg) genericName = dg;
          const ds = decryptCell(m.strength, dek); if (ds) strength = ds;
        } catch (e) { }

        const totalQty = m.inventory.reduce((sum, b) => sum + b.qtyAvailable, 0);
        const expiringSoon = m.inventory.some(b => b.expiryDate && new Date(b.expiryDate) < new Date(Date.now() + 90 * 24 * 60 * 60 * 1000));
        const isLowStock = totalQty < 20;

        return {
          ...m,
          brandName,
          genericName,
          strength,
          totalQty,
          expiringSoon,
          isLowStock,
          batches: m.inventory
        };
      }).filter(m => {
        // Filter by search query if present
        if (!q) return true;
        return (
          (m.brandName && m.brandName.toLowerCase().includes(q)) ||
          (m.genericName && m.genericName.toLowerCase().includes(q)) ||
          (m.sku && m.sku.toLowerCase().includes(q))
        );
      }).sort((a, b) => {
        // Sort Priority: LowStock (2 points) > Expiring (1 point) > Normal (0)
        // This ensures critical items appear first, but doesn't hide others (mixed result)
        const scoreA = (a.isLowStock ? 2 : 0) + (a.expiringSoon ? 1 : 0);
        const scoreB = (b.isLowStock ? 2 : 0) + (b.expiringSoon ? 1 : 0);
        return scoreB - scoreA;
      });

      return sendSuccess(res, "Inventory list for reorder", { inventory: result });
    } catch (err) {
      next(err);
    }
  }
);

const reorderSchema = z.object({
  supplierId: z.string().uuid(),
  items: z.array(z.object({
    medicineId: z.string().uuid(),
    quantity: z.number().int().positive(),
  })).min(1),
  note: z.string().optional()
});

/**
 * POST /v1/dashboard/reorder
 * Description: Create a reorder request for a supplier.
 */
dashboardRouter.post(
  "/reorder",
  authenticate,
  storeContext,
  requireStore,
  requireRole(["STORE_OWNER", "MANAGER"]),
  async (req: RequestWithUser, res: Response, next: NextFunction) => {
    try {
      const parsed = reorderSchema.safeParse(req.body);
      if (!parsed.success) {
        // @ts-ignore
        return handleZodError(res, parsed.error);
      }

      const store = req.store!;
      const user = req.user!;
      const { supplierId, items, note } = parsed.data;

      // Verify supplier exists
      const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
      if (!supplier) return sendError(res, "Supplier not found", 404);

      // Fetch medicine names for the email/message details
      const medIds = items.map(i => i.medicineId);
      const meds = await prisma.medicine.findMany({
        where: { id: { in: medIds } },
        select: { id: true, brandName: true, strength: true }
      });
      const medMap = new Map(meds.map(m => [m.id, m]));

      // Construct readable message and enhanced items for payload
      let details = "Items:\n";
      const enhancedItems = items.map(item => {
        const m = medMap.get(item.medicineId);
        const name = m ? `${m.brandName} ${m.strength || ''}` : "Unknown Item";
        details += `- ${name}: ${item.quantity} units\n`;
        return {
          ...item,
          medicineName: name
        };
      });
      console.log(enhancedItems)

      if (note) details += `\nNote: ${note}`;

      const payloadData = {
        items: enhancedItems,
        note: note || "",
        type: "REORDER"
      };

      const request = await prisma.supplierRequest.create({
        data: {
          storeId: store.id,
          supplierId,
          message: JSON.stringify(payloadData),
          payload: payloadData,
          status: "PENDING",
          createdById: user.id
        }
      });

      // Notify Supplier
      if (supplier.userId) {
        const supUser = await prisma.user.findUnique({ where: { id: supplier.userId } });
        if (supUser?.email) {
          sendMail({
            to: supUser.email,
            subject: `New Reorder Request from ${store.name}`,
            html: getReorderRequestEmailTemplate(
              supUser.email,
              store.name,
              request.id,
              details,
              process.env.FRONTEND_URL || "http://localhost:5173"
            ),
          });
        }
      }

      // Notify Store Owner (Confirmation)
      if (user.email) {
        // Optional: send confirmation email to requester
      }

      await prisma.activityLog.create({
        data: {
          storeId: store.id,
          userId: user.id,
          action: "reorder_created",
          payload: { requestId: request.id, supplierId, itemCount: items.length }
        }
      });

      return sendSuccess(res, "Reorder request sent successfully", { request });
    } catch (err) {
      next(err);
    }
  }
);


/**
 * GET /v1/dashboard/suggestions
 * Desc: Get automated reorder suggestions based on low stock
 */
dashboardRouter.get(
  "/suggestions",
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const { user } = req;
    if (!user) return sendError(res, "Unauthenticated", 401);

    const store = req.store;
    if (!store) return sendError(res, "Store context not found", 404);

    // 1. Group inventory by medicine for distinct counts (Low Stock Check)
    const inventory = await prisma.inventoryBatch.groupBy({
      by: ['medicineId'],
      where: { storeId: store.id },
      _sum: { qtyAvailable: true }
    });

    const lowStockThreshold = 20;
    const currentStockMap = new Map<string, number>();
    inventory.forEach(i => currentStockMap.set(i.medicineId, i._sum.qtyAvailable || 0));

    const lowStockIds = inventory
      .filter(i => (i._sum.qtyAvailable || 0) < lowStockThreshold)
      .map(i => i.medicineId);

    // 2. Find Expiring Batches (within 90 days)
    const ninetyDays = new Date();
    ninetyDays.setDate(ninetyDays.getDate() + 90);

    const expiringBatches = await prisma.inventoryBatch.findMany({
      where: {
        storeId: store.id,
        qtyAvailable: { gt: 0 },
        expiryDate: { lte: ninetyDays, gt: new Date() }
      },
      select: { medicineId: true },
      distinct: ['medicineId']
    });
    const expiringIds = Array.from(new Set(expiringBatches.map(b => b.medicineId)));

    // 3. Combine Target IDs
    // @ts-ignore
    const targetIds = Array.from(new Set([...lowStockIds, ...expiringIds]));

    if (targetIds.length === 0) {
      return sendSuccess(res, "No suggestions", { suggestions: [] });
    }

    const medicines = await prisma.medicine.findMany({
      where: { id: { in: targetIds } },
      select: { id: true, brandName: true, strength: true, genericName: true }
    });

    const dek = dekFromEnv();

    // 4. Calculate suggestions
    const suggestions = medicines.map(m => {
      let brandName = m.brandName;
      try {
        const db = decryptCell(m.brandName, dek);
        if (db) brandName = db;
      } catch (e) { }

      const current = currentStockMap.get(m.id) || 0;
      const isLow = current < lowStockThreshold;
      // @ts-ignore
      const isExpiring = expiringIds.includes(m.id);

      let reason = "Low Stock";
      let suggestedQty = 50 - current;

      if (isExpiring) {
        if (isLow) reason = "Low Stock & Expiring";
        else {
          reason = "Expiring Soon";
          suggestedQty = 30; // Suggest replacement stock
        }
      }

      if (suggestedQty < 10) suggestedQty = 10; // Min order

      return {
        medicineId: m.id,
        brandName,
        currentStock: current,
        suggestedQty,
        reason
      };
    });

    return sendSuccess(res, "Suggestions generated", { suggestions });
  }
);





/**
 * GET /v1/dashboard/medicines/search
 * Search medicines by brandName, genericName, or SKU.
 */
dashboardRouter.get(
  "/medicines/search",
  async (req: AuthRequest, res: Response) => {
    try {
      const q = (req.query.q as string || "").toLowerCase();

      // Fetch all active medicines for this store
      // Note: For large inventories, this in-memory filtering is not scalable. 
      // Ideally, use a search service or deterministic encryption for searchable fields.
      const allMedicines = await prisma.medicine.findMany({
        where: {
          storeId: req.store.id,
          isActive: true
        },
        include: {
          inventory: {
            where: { qtyAvailable: { gt: 0 } },
            select: { id: true, qtyAvailable: true, batchNumber: true, expiryDate: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      const dek = dekFromEnv();

      // Decrypt and Filter in-memory
      const matchedMedicines = allMedicines.map(med => {
        let brandName = med.brandName;
        let genericName = med.genericName;
        let strength = med.strength;

        try {
          // Attempt decryption
          const decryptedBrand = decryptCell(med.brandName, dek);
          if (decryptedBrand) brandName = decryptedBrand;

          const decryptedGeneric = decryptCell(med.genericName, dek);
          if (decryptedGeneric) genericName = decryptedGeneric;

          const decryptedStrength = decryptCell(med.strength, dek);
          if (decryptedStrength) strength = decryptedStrength;

        } catch (e) { }

        return { ...med, brandName, genericName, strength };
      }).filter(med => {
        if (!q) return true;
        return (
          (med.brandName && med.brandName.toLowerCase().includes(q)) ||
          (med.genericName && med.genericName.toLowerCase().includes(q)) ||
          (med.sku && med.sku.toLowerCase().includes(q))
        );
      });

      return sendSuccess(res, "Medicines found", { medicines: matchedMedicines });
    } catch (error) {
      handlePrismaError(res, error);
    }
  }
);

/* ----------------------------------------
   SALES CHECKOUT (FIXED TRANSACTION)
----------------------------------------- */

dashboardRouter.post(
  "/sales/checkout",
  authenticate,
  storeContext,
  requireStore,
  // @ts-ignore
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { items, paymentMethod } = req.body; // Expect items: { medicineId, qty }[], paymentMethod?

      if (!items || !Array.isArray(items) || items.length === 0) {
        return sendError(res, "Invalid items", 400);
      }

      const result = await prisma.$transaction(
        async (tx) => {
          let subtotal = 0;
          const saleItemsCreate: any[] = [];

          for (const item of items) {
            const medicine = await tx.medicine.findUnique({
              where: { id: item.medicineId },
              include: { inventory: { orderBy: { expiryDate: 'asc' } } }
            });

            if (!medicine) throw new Error(`Medicine ${item.medicineId} not found`);

            // Check stock
            const availableBatches = medicine.inventory.filter(b => b.qtyAvailable > 0);
            const totalStock = availableBatches.reduce((acc, b) => acc + b.qtyAvailable, 0);

            if (totalStock < item.qty) {
              throw new Error(`Insufficient stock for ${medicine.brandName}. Requested: ${item.qty}, Available: ${totalStock}`);
            }

            // Use MRP of first batch as selling price (Simplification)
            const sellingPrice = Number(availableBatches[0]?.mrp) || 0;
            const itemTotal = sellingPrice * item.qty;
            subtotal += itemTotal;

            // Deduct Stock
            let qtyToDeduct = item.qty;
            for (const batch of availableBatches) {
              if (qtyToDeduct <= 0) break;
              const deduct = Math.min(batch.qtyAvailable, qtyToDeduct);

              await tx.inventoryBatch.update({
                where: { id: batch.id },
                data: { qtyAvailable: { decrement: deduct } }
              });

              // Log Movement
              await tx.stockMovement.create({
                data: {
                  storeId: req.store!.id,
                  inventoryId: batch.id,
                  medicineId: medicine.id,
                  delta: -deduct,
                  reason: "SALE",
                  performedById: req.user?.id
                }
              });

              qtyToDeduct -= deduct;
            }

            saleItemsCreate.push({
              medicineId: medicine.id,
              qty: item.qty,
              unitPrice: sellingPrice,
              lineTotal: itemTotal,
              _medicine: medicine
            });
          }

          // Create Sale
          const sale = await tx.sale.create({
            data: {
              storeId: req.store!.id,
              totalValue: subtotal,
              paymentMethod: paymentMethod || "CASH",
              createdById: req.user?.id
            }
          });

          // Create SaleItems
          if (saleItemsCreate.length > 0) {
            await tx.saleItem.createMany({
              data: saleItemsCreate.map(si => ({
                saleId: sale.id,
                medicineId: si.medicineId,
                qty: si.qty,
                unitPrice: si.unitPrice,
                lineTotal: si.lineTotal
              }))
            });
          }

          // Reconstruct items with medicine info for receipt
          const extendedItems = saleItemsCreate.map(si => ({
            ...si,
            medicine: si._medicine
          }));

          const receiptNo = `REC-${Date.now()}`;

          // Create Receipt
          const receiptData = {
            storeName: req.store!.name,
            date: sale.createdAt,
            saleId: sale.id,
            total: sale.totalValue,
            items: extendedItems.map((i: any) => ({ name: i.medicine.brandName, qty: i.qty, price: i.unitPrice, total: i.lineTotal }))
          };

          await tx.receipt.create({
            data: {
              saleId: sale.id,
              data: receiptData as any,
              receiptNo
            }
          });

          return {
            sale: {
              ...sale,
              items: extendedItems
            },
            receiptNo
          };
        }
      );

      // Generate & Stream PDF (Outside transaction)
      const { sale, receiptNo } = result;
      const doc = new PDFDocument({ margin: 50 });

      res.setHeader('x-sale-id', sale.id);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=receipt-${sale.id}.pdf`);

      doc.pipe(res);

      await generateReceiptPDF(doc, sale, receiptNo, req.store!, res);

    } catch (error) {
      if (!res.headersSent) {
        // @ts-ignore
        next(error);
      }
    }
  }
);

/* -----------------------
   Dashboard - POST /v1/dashboard/receipts
*/
/*
 * GET /v1/dashboard/receipts
 * Description: Retrieves all receipts for the store.
 * Headers: 
 *  - Authorization: Bearer <token> (Role: STORE_OWNER, Store Context)
 * Body: None
 * Responses:
 *  - 200: { success: true, data: { receipts: [...] } }
 *  - 500: Internal server error
*/
dashboardRouter.get("/receipts", requireRole("STORE_OWNER"), async (req: any, res) => {
  try {
    const receipts = await prisma.receipt.findMany({
      where: {
        sale: {
          storeId: req.store.id
        }
      },
      orderBy: {
        createdAt: "desc"
      },
      include: {
        sale: {
          select: {
            totalValue: true,
            createdAt: true,
            items: {
              include: {
                medicine: true
              }
            }
          }
        }
      }
    });

    // Map data if necessary to match frontend expectations, or send raw
    return sendSuccess(res, "Receipts retrieved", { receipts });
  } catch (err) {
    return sendInternalError(res, err, "Failed to retrieve receipts");
  }
});

/* -----------------------
   Dashboard - GET /v1/dashboard/receipts/:id/pdf
*/
dashboardRouter.get("/receipts/:id/pdf", requireRole("STORE_OWNER"), async (req: any, res) => {
  try {
    const { id } = req.params;

    const receipt = await prisma.receipt.findFirst({
      where: {
        id,
        sale: {
          storeId: req.store.id
        }
      },
      include: {
        sale: {
          include: {
            items: {
              include: {
                medicine: true
              }
            },
            createdBy: true,
            store: true
          }
        }
      }
    });

    if (!receipt) {
      return sendError(res, "Receipt not found", 404);
    }

    const sale = receipt.sale;
    if (!sale) {
      return sendError(res, "Associated sale data missing", 404);
    }

    const doc = new PDFDocument({ margin: 50 });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename=receipt-${receipt.receiptNo || id}.pdf`);

    doc.pipe(res);


    await generateReceiptPDF(doc, sale, receipt.receiptNo || sale.id.slice(0, 8), sale.store, res);

  } catch (err) {
    return sendInternalError(res, err, "Failed to generate receipt PDF");
  }
});




export default dashboardRouter;
