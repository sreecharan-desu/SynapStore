// src/routes/v1/dashboard.ts
import { Router, Request, Response, NextFunction } from "express";
import { storeContext, requireStore } from "../../../middleware/store";
import { authenticate } from "../../../middleware/authenticate";
import type { Role } from "@prisma/client";
import prisma from "../../../lib/prisma";

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

dashboardRouter.get(
  "/store",
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      if (!user)
        return res
          .status(401)
          .json({ success: false, error: "unauthenticated" });

      const store = req.store;
      if (!store) {
        return res.status(403).json({
          success: false,
          error: "no_store_found",
          needsStoreSetup: true,
        });
      }

      const roles = (req.userStoreRoles ?? []) as RoleEnum[];
      if (roles.length === 0 && user.globalRole !== "SUPERADMIN") {
        return res.status(403).json({ success: false, error: "forbidden" });
      }

      const permissions = permissionsForRoles(roles);

      res.setHeader(
        "Cache-Control",
        "private, max-age=60, stale-while-revalidate=30"
      );

      return res.json({
        success: true,
        data: {
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
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

dashboardRouter.get(
  "/bootstrap",
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      if (!user)
        return res
          .status(401)
          .json({ success: false, error: "unauthenticated" });

      const store = req.store;
      if (!store)
        return res.status(403).json({
          success: false,
          error: "no_store_found",
          needsStoreSetup: true,
        });

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
      return res.json({
        success: true,
        data: {
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
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

export default dashboardRouter;
