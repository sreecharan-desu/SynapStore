// src/routes/v1/dashboard.ts
import { Router, Request, Response, NextFunction } from "express";
import { storeContext, requireStore, RequestWithUser } from "../../../middleware/store";
import { authenticate } from "../../../middleware/authenticate";
import type { Role } from "@prisma/client";
import prisma from "../../../lib/prisma";
import { requireRole } from "../../../middleware/requireRole";
import { crypto$ } from "../../../lib/crypto";
import { sendMail } from "../../../lib/mailer";
// router from email-auth is unused here? removing.
// import router from "../auth/email-auth"; 
import { sendSuccess, sendError, handlePrismaError, sendInternalError } from "../../../lib/api";

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
    has("SUPERADMIN") || has("ADMIN") || has("STORE_OWNER");
  const canEditInventory = canManageUsers || has("MANAGER") || has("STAFF");
  const canCreateReorder =
    canManageUsers || has("MANAGER") || has("STORE_OWNER") || has("SUPPLIER");
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

      // parallel DB fetches (broad)
      const [
        totalMedicines,
        totalBatches,
        recentSalesCount,
        recentRevenueAgg,
        inventorySums,
        lowStockBatches,
        expiriesSoon,
        topMoversRaw,
        recentSales,
        activity,
        suppliers,
        unreadNotifications,
        webhookFailures,
        saleRows,
        saleItemsAll,
        saleItemsSoldAgg,
        medicinesAll,
        stockMovementsAgg,
      ] = await Promise.all([
        prisma.medicine.count({ where: { storeId } }),
        prisma.inventoryBatch.count({ where: { storeId } }),
        prisma.sale.count({
          where: { storeId, createdAt: { gte: salesWindowStart } },
        }),
        prisma.sale.aggregate({
          where: {
            storeId,
            createdAt: { gte: salesWindowStart },
            paymentStatus: "PAID",
          },
          _sum: { totalValue: true },
        }),
        prisma.inventoryBatch.aggregate({
          where: { storeId },
          _sum: { qtyAvailable: true, qtyReserved: true, qtyReceived: true },
        }),
        prisma.inventoryBatch.findMany({
          where: { storeId, qtyAvailable: { lte: lowStockThreshold } },
          orderBy: { qtyAvailable: "asc" },
          take: 200,
          select: {
            id: true,
            medicineId: true,
            batchNumber: true,
            qtyAvailable: true,
            expiryDate: true,
            receivedAt: true,
          },
        }),
        prisma.inventoryBatch.findMany({
          where: {
            storeId,
            expiryDate: { not: null, lte: expiriesHorizon },
            qtyAvailable: { gt: 0 },
          },
          orderBy: { expiryDate: "asc" },
          take: 500,
          select: {
            id: true,
            medicineId: true,
            batchNumber: true,
            expiryDate: true,
            qtyAvailable: true,
          },
        }),
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
        prisma.sale.findMany({
          where: { storeId },
          orderBy: { createdAt: "desc" },
          take: recentSalesLimit,
          include: {
            items: {
              select: {
                id: true,
                medicineId: true,
                qty: true,
                unitPrice: true,
                lineTotal: true,
              },
            },
          },
        }),
        prisma.activityLog.findMany({
          where: { storeId },
          orderBy: { createdAt: "desc" },
          take: 50,
          select: {
            id: true,
            userId: true,
            action: true,
            payload: true,
            createdAt: true,
          },
        }),
        prisma.supplier.findMany({
          where: { storeId },
          select: {
            id: true,
            name: true,
            phone: true,
            contactName: true,
            isActive: true,
          },
        }),
        prisma.notification.count({ where: { storeId, status: "QUEUED" } }),
        // prisma.webhookDelivery.count({ where: { storeId, success: false, retryCount: { gt: 0 } } }),
        Promise.resolve(0),
        // extra data for richer permutations
        prisma.sale.findMany({
          where: { storeId, createdAt: { gte: salesWindowStart } },
          select: {
            id: true,
            createdAt: true,
            totalValue: true,
            paymentMethod: true,
            paymentStatus: true,
            createdById: true,
          },
          take: 10000, // reasonable cap for client-side aggregations; tune as needed
        }),
        prisma.saleItem.findMany({
          where: { sale: { storeId, createdAt: { gte: salesWindowStart } } },
          select: {
            id: true,
            saleId: true,
            medicineId: true,
            qty: true,
            lineTotal: true,
            createdAt: true,
          },
          take: 20000,
        }),
        prisma.saleItem.groupBy({
          by: ["medicineId"],
          where: { sale: { storeId, paymentStatus: "PAID" } },
          _sum: { qty: true },
        }),
        // medicines (meta)
        prisma.medicine.findMany({
          where: { storeId },
          select: {
            id: true,
            brandName: true,
            genericName: true,
            category: true,
            sku: true,
            dosageForm: true,
            strength: true,
          },
        }),
        // stock movements sums by reason (for stock turnover / inflows)
        prisma.stockMovement.groupBy({
          by: ["reason"],
          where: { storeId },
          _sum: { delta: true },
        }),
      ]);

      // basic conversions
      const recentRevenue = Number(recentRevenueAgg._sum?.totalValue ?? 0);
      const inventoryTotals = {
        qtyAvailable: Number(inventorySums._sum.qtyAvailable ?? 0),
        qtyReserved: Number(inventorySums._sum.qtyReserved ?? 0),
        qtyReceived: Number(inventorySums._sum.qtyReceived ?? 0),
      };

      // medicine map
      const medicinesById = Object.fromEntries(
        medicinesAll.map((m: any) => [m.id, m])
      );

      // top movers enriched
      const topMovers = topMoversRaw.map((t: any) => ({
        medicineId: t.medicineId,
        qtySold: Number(t._sum.qty ?? 0),
        revenue: Number(t._sum.lineTotal ?? 0),
        medicine: medicinesById[t.medicineId] ?? null,
      }));

      // category breakdown: combine saleItemsAll with medicine categories
      const categoryAgg: Record<string, { qty: number; revenue: number }> = {};
      for (const it of saleItemsAll) {
        const med = medicinesById[it.medicineId];
        const cat = med?.category ?? "unknown";
        categoryAgg[cat] = categoryAgg[cat] || { qty: 0, revenue: 0 };
        categoryAgg[cat].qty += it.qty ?? 0;
        categoryAgg[cat].revenue += Number(it.lineTotal ?? 0);
      }
      const categoryBreakdown = Object.entries(categoryAgg)
        .map(([category, v]) => ({ category, qty: v.qty, revenue: v.revenue }))
        .sort((a, b) => b.revenue - a.revenue);

      // payment method breakdown (from saleRows)
      const paymentMethodAgg: Record<
        string,
        { count: number; revenue: number }
      > = {};
      for (const s of saleRows) {
        const pm = String(s.paymentMethod ?? "UNKNOWN");
        paymentMethodAgg[pm] = paymentMethodAgg[pm] || { count: 0, revenue: 0 };
        paymentMethodAgg[pm].count += 1;
        paymentMethodAgg[pm].revenue += Number(s.totalValue ?? 0);
      }
      const paymentMethods = Object.entries(paymentMethodAgg).map(
        ([method, v]) => ({ method, ...v })
      );

      // hourly sales distribution
      const hourAgg: Record<number, { count: number; revenue: number }> = {};
      for (let h = 0; h < 24; h++) hourAgg[h] = { count: 0, revenue: 0 };
      for (const s of saleRows) {
        const h = new Date(s.createdAt).getHours();
        hourAgg[h].count += 1;
        hourAgg[h].revenue += Number(s.totalValue ?? 0);
      }
      const salesByHour = Object.entries(hourAgg).map(([h, v]) => ({
        hour: Number(h),
        ...v,
      }));

      // average order value & avg items per sale
      const totalSalesCount = saleRows.length;
      const totalSoldQty = saleItemsAll.reduce((a: number, b: any) => a + (b.qty ?? 0), 0);
      const totalSoldRevenue = saleRows.reduce(
        (a: number, b: any) => a + Number(b.totalValue ?? 0),
        0
      );
      const avgOrderValue = totalSalesCount
        ? totalSoldRevenue / totalSalesCount
        : 0;
      const avgItemsPerSale = totalSalesCount
        ? totalSoldQty / totalSalesCount
        : 0;

      // repeat customer rate (removed patient support)
      const repeatCustomerRate = 0;

      // inventory aging buckets
      const now = Date.now();
      const agingBucketsResult: Record<string, number> = {};
      for (const b of agingBuckets) agingBucketsResult[`${b}_days`] = 0;
      agingBucketsResult[">365_days"] = 0;
      for (const batch of await prisma.inventoryBatch.findMany({
        where: { storeId, receivedAt: { not: null } },
        select: { id: true, receivedAt: true, qtyAvailable: true },
      })) {
        const received = batch.receivedAt
          ? new Date(batch.receivedAt).getTime()
          : now;
        const ageDays = Math.floor((now - received) / (24 * 3600 * 1000));
        let placed = false;
        for (const b of agingBuckets) {
          if (ageDays <= b) {
            agingBucketsResult[`${b}_days`] += batch.qtyAvailable ?? 0;
            placed = true;
            break;
          }
        }
        if (!placed) agingBucketsResult[">365_days"] += batch.qtyAvailable ?? 0;
      }

      // expiry heatmap: month-year -> count/qty
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


      // alerts by type (removed alerts)
      const alertsByType: any[] = [];

      // stock turnover approximation: soldQty / qtyReceived
      const soldQtyTotal = saleItemsSoldAgg.reduce(
        (a: number, b: any) => a + Number(b._sum?.qty ?? 0),
        0
      );
      const qtyReceivedTotal = Number(inventorySums._sum.qtyReceived ?? 0) || 1;
      const stockTurnover = soldQtyTotal / qtyReceivedTotal;

      // final recentSales summary enrichment (medicine meta)
      const recentSalesSummary = recentSales.map((s: any) => ({
        id: s.id,
        createdAt: s.createdAt,
        totalValue: Number(s.totalValue ?? 0),
        paymentStatus: s.paymentStatus,
        items: s.items.map((it: any) => ({
          ...it,
          medicine: medicinesById[it.medicineId] ?? null,
        })),
      }));

      // Final payload (very rich)
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
          unreadNotifications,
          webhookFailures,
          inventoryTotals,
          reservationsCount: 0,
          reservedQty: 0,
        },
        charts: {
          salesByDay: (() => {
            // build time-series daily from saleRows
            const map: Record<
              string,
              { date: string; revenue: number; count: number }
            > = {};
            for (let i = 0; i < days; i++) {
              const d = new Date(
                Date.now() - (days - 1 - i) * 24 * 3600 * 1000
              );
              const k = d.toISOString().slice(0, 10);
              map[k] = { date: k, revenue: 0, count: 0 };
            }
            for (const s of saleRows) {
              const k = new Date(s.createdAt).toISOString().slice(0, 10);
              map[k] = map[k] ?? { date: k, revenue: 0, count: 0 };
              map[k].revenue += Number(s.totalValue ?? 0);
              map[k].count += 1;
            }
            return Object.values(map);
          })(),
          salesByHour,
          paymentMethods,
          categoryBreakdown,
          topMovers,
          supplierPerformance: [],
          expiryHeatmap: expiryHeatmapArr,
          inventoryAging: agingBucketsResult,
          reorderLeadTimeSummary: [],
          alertsByType,
          stockTurnover,
          avgOrderValue,
          avgItemsPerSale,
          repeatCustomerRate,
        },
        lists: {
          lowStock: lowStockBatches.map((b: any) => ({
            ...b,
            medicine: medicinesById[b.medicineId] ?? null,
          })),
          expiries: expiriesSoon.map((b: any) => ({
            ...b,
            medicine: medicinesById[b.medicineId] ?? null,
          })),
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
  requireRole(["STORE_OWNER", "ADMIN"]),
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
  requireRole(["STORE_OWNER", "ADMIN"]),
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

      await prisma.$transaction([
        prisma.supplierRequest.update({
          where: { id },
          data: { status: "ACCEPTED" },
        }),
        prisma.supplierStore.upsert({
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
        }),
        prisma.activityLog.create({
          data: {
            storeId: store.id,
            userId: user.id,
            action: "supplier_request_accepted",
            payload: { requestId: id, supplierId: reqRow.supplierId },
          },
        }),
      ]);

      // notify supplier (if supplier.userId exists)
      const sup = await prisma.supplier.findUnique({
        where: { id: reqRow.supplierId },
      });
      if (sup?.userId) {
        // IN_APP
        await prisma.notification.create({
          data: {
            storeId: store.id,
            userId: sup.userId,
            channel: "IN_APP",
            recipient: sup.userId,
            subject: "Supplier request accepted",
            body: `Your request to supply ${store.name} was accepted`,
            metadata: { supplierRequestId: id },
            status: "QUEUED",
          },
        });

        // EMAIL - need to fetch user email (encrypted?)
        const supUser = await prisma.user.findUnique({
          where: { id: sup.userId },
          select: { email: true },
        });
        if (supUser?.email) {
          // Email is already decrypted by Prisma extension
          const supEmail = supUser.email;
          if (supEmail) {
            await prisma.notification.create({
              data: {
                storeId: store.id,
                userId: sup.userId,
                channel: "EMAIL",
                recipient: supEmail,
                subject: "Request Accepted!",
                body: `Good news! Your request to supply ${store.name} has been accepted. You can now engage with this store.`,
                status: "SENT",
              },
            });

            try {
              await sendMail({
                to: supEmail,
                subject: `Request Accepted: ${store.name}`,
                text: `Good news!\n\nYour request to supply ${store.name} has been accepted. You can now engage with this store.`,
              });
            } catch (e) {
              console.error("Failed to send email to supplier:", e);
            }
          }
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
  requireRole(["STORE_OWNER", "ADMIN"]),
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
        // IN_APP
        await prisma.notification.create({
          data: {
            storeId: store.id,
            userId: sup.userId,
            channel: "IN_APP",
            recipient: sup.userId,
            subject: "Supplier request rejected",
            body: `Request rejected for ${store.name}`,
            metadata: { supplierRequestId: id },
            status: "QUEUED",
          },
        });

        // EMAIL
        const supUser = await prisma.user.findUnique({
          where: { id: sup.userId },
          select: { email: true },
        });
        if (supUser?.email) {
          // Email is already decrypted by Prisma extension
          const supEmail = supUser.email;
          if (supEmail) {
            await prisma.notification.create({
              data: {
                storeId: store.id,
                userId: sup.userId,
                channel: "EMAIL",
                recipient: supEmail, // store plain email in notification log for visibility? Or keep encrypted? Usually logs have plain.
                subject: `Supplier Request Rejected`,
                body: `Your request to supply ${store.name} was not accepted at this time.`,
                status: "SENT",
              },
            });

            try {
              await sendMail({
                to: supEmail,
                subject: `Request Update: ${store.name}`,
                text: `Hello,\n\nYour request to supply ${store.name} was not accepted at this time.`,
              });
            } catch (e) {
              console.error("Failed to send email to supplier:", e);
            }
          }
        }
      }

      return sendSuccess(res, "Supplier request rejected");
    } catch (err) {
      next(err);
    }
  }
);

export default dashboardRouter;
