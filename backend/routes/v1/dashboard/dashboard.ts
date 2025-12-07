// src/routes/v1/dashboard.ts
import { Router, Request, Response, NextFunction } from "express";
import prisma from "../../../lib/prisma";
import { storeContext, requireStore } from "../../../middleware/store";
import { authenticate } from "../../../middleware/authenticate";
import type { Role } from "@prisma/client"; // <- use Prisma's generated enum type

type RoleEnum = Role;

type AuthRequest = Request & {
  user?: { id: string; username?: string; email?: string };
  store?: any;
};

type StoreInfo = {
  id: string;
  name: string;
  slug: string;
  timezone?: string | null;
  currency?: string | null;
  settings?: any | null;
};

type UserStoreEntry = {
  store: StoreInfo;
  role: RoleEnum;
};

type Permissions = {
  canEditInventory: boolean;
  canCreateReorder: boolean;
  canAcknowledgeAlerts: boolean;
  canViewReports: boolean;
  canManageUsers: boolean;
};

const dashboardRouter = Router();

/**
 * Middleware order:
 * 1) authenticate - populates req.user
 * 2) storeContext - resolves req.store using req.user
 * 3) requireStore - ensures a store was resolved
 */
dashboardRouter.use(authenticate);
dashboardRouter.use(storeContext);
dashboardRouter.use(requireStore);

/**
 * Utility - derive capability flags from role list (conservative)
 */
function permissionsForRoles(roles: RoleEnum[] = []): Permissions {
  const has = (r: RoleEnum) => roles.includes(r);

  // core permission mapping - keep conservative and explicit
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
 * Returns the current active store and the user's roles and derived permissions.
 */
dashboardRouter.get(
  "/store",
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      const store = req.store as StoreInfo | undefined;

      if (!userId) {
        return res
          .status(401)
          .json({ success: false, error: "unauthenticated" });
      }
      if (!store) {
        return res
          .status(404)
          .json({ success: false, error: "store not found" });
      }

      // fetch all roles this user has for the active store
      const roleRows = await prisma.userStoreRole.findMany({
        where: { userId, storeId: store.id },
        select: { role: true, createdAt: true },
      });

      if (roleRows.length === 0) {
        // defense-in-depth: user should not reach this point without a role
        return res.status(403).json({ success: false, error: "forbidden" });
      }

      const roles = roleRows.map((r) => r.role as RoleEnum);
      const roleAssignedAt = roleRows[0]?.createdAt ?? null;

      // gather all stores the user belongs to (for a client store switcher)
      const userStoreRows = await prisma.userStoreRole.findMany({
        where: { userId },
        select: {
          role: true,
          store: {
            select: {
              id: true,
              name: true,
              slug: true,
              timezone: true,
              currency: true,
              settings: true,
            },
          },
        },
      });

      // aggregate roles per store
      const stores = userStoreRows.reduce<
        Record<
          string,
          {
            id: string;
            name: string;
            slug: string;
            timezone?: string | null;
            currency?: string | null;
            settings?: any | null;
            roles: RoleEnum[];
          }
        >
      >((acc, r) => {
        const s = r.store;
        if (!acc[s.id]) {
          acc[s.id] = {
            id: s.id,
            name: s.name,
            slug: s.slug,
            timezone: s.timezone,
            currency: s.currency,
            settings: s.settings ?? null,
            roles: [r.role as RoleEnum],
          };
        } else {
          if (!acc[s.id].roles.includes(r.role as RoleEnum))
            acc[s.id].roles.push(r.role as RoleEnum);
        }
        return acc;
      }, {});

      const storesList = Object.values(stores);

      // derived permissions
      const permissions = permissionsForRoles(roles);

      // short cache hint - this metadata rarely changes for the session
      res.setHeader(
        "Cache-Control",
        "private, max-age=60, stale-while-revalidate=30"
      );

      return res.json({
        success: true,
        data: {
          store: {
            id: store.id,
            name: store.name,
            slug: store.slug,
            timezone: store.timezone ?? null,
            currency: store.currency ?? null,
            settings: store.settings ?? null,
          },
          roles,
          roleAssignedAt,
          permissions,
          stores: storesList,
          user: {
            id: userId,
            username: req.user?.username ?? null,
            email: req.user?.email ?? null,
          },
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /v1/dashboard/overview
 * Returns small summary numbers for the dashboard header.
 */
dashboardRouter.get(
  "/overview",
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const storeId = req.store.id as string;

      const [
        totalMedicines,
        totalBatches,
        totalActiveAlerts,
        totalPendingReorders,
      ] = await Promise.all([
        prisma.medicine.count({ where: { storeId } }),
        prisma.inventoryBatch.count({ where: { storeId } }),
        prisma.alert.count({
          where: {
            storeId,
            status: "ACTIVE",
          },
        }),
        prisma.reorder.count({
          where: {
            storeId,
            status: {
              in: ["DRAFT", "SENT", "CONFIRMED", "PARTIALLY_RECEIVED"],
            },
          },
        }),
      ]);

      return res.json({
        success: true,
        data: {
          overview: {
            totalMedicines,
            totalBatches,
            totalActiveAlerts,
            totalPendingReorders,
          },
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /v1/dashboard/alerts
 * Returns recent active alerts (paginated via ?limit=)
 */
dashboardRouter.get(
  "/alerts",
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const storeId = req.store.id as string;
      const limit = Math.min(Math.max(Number(req.query.limit ?? 10), 1), 100);

      const alerts = await prisma.alert.findMany({
        where: { storeId },
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
          id: true,
          type: true,
          status: true,
          severity: true,
          metadata: true,
          createdAt: true,
        },
      });

      return res.json({ success: true, data: { alerts } });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /v1/dashboard/expiries
 * Soon-to-expire inventory batches.
 * query: days=30 (default)
 */
dashboardRouter.get(
  "/expiries",
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const storeId = req.store.id as string;
      const days = Math.max(Number(req.query.days ?? 30), 1);
      const limit = Math.min(Math.max(Number(req.query.limit ?? 10), 1), 200);

      const horizon = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

      const expiries = await prisma.inventoryBatch.findMany({
        where: {
          storeId,
          expiryDate: { not: null, lte: horizon },
          qtyAvailable: { gt: 0 },
        },
        orderBy: { expiryDate: "asc" },
        take: limit,
        select: {
          id: true,
          medicineId: true,
          batchNumber: true,
          expiryDate: true,
          qtyAvailable: true,
          mrp: true,
          purchasePrice: true,
          location: true,
        },
      });

      const medicineIds = Array.from(
        new Set(expiries.map((e) => e.medicineId))
      );
      const medicines =
        medicineIds.length > 0
          ? await prisma.medicine.findMany({
              where: { id: { in: medicineIds } },
              select: {
                id: true,
                brandName: true,
                genericName: true,
                sku: true,
              },
            })
          : [];

      const medMap = Object.fromEntries(medicines.map((m) => [m.id, m]));

      const result = expiries.map((e) => ({
        ...e,
        medicine: medMap[e.medicineId] ?? null,
      }));

      return res.json({ success: true, data: { expiries: result } });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /v1/dashboard/activity
 * Recent activity log entries (timeline)
 * query: limit=20
 */
dashboardRouter.get(
  "/activity",
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const storeId = req.store.id as string;
      const limit = Math.min(Math.max(Number(req.query.limit ?? 20), 1), 200);

      const activity = await prisma.activityLog.findMany({
        where: { storeId },
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
          id: true,
          userId: true,
          action: true,
          payload: true,
          createdAt: true,
        },
      });

      return res.json({ success: true, data: { activity } });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /v1/dashboard/forecasts
 * recent forecasts (for UI sparkline / preview)
 */
dashboardRouter.get(
  "/forecasts",
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const storeId = req.store.id as string;
      const limit = Math.min(Math.max(Number(req.query.limit ?? 10), 1), 50);

      const forecasts = await prisma.forecast.findMany({
        where: { storeId },
        orderBy: { computedAt: "desc" },
        take: limit,
        select: {
          id: true,
          medicineId: true,
          model: true,
          result: true,
          computedAt: true,
        },
      });

      return res.json({ success: true, data: { forecasts } });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /v1/dashboard/health
 * returns latest store health score and metrics
 */
dashboardRouter.get(
  "/health",
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const storeId = req.store.id as string;

      const health = await prisma.storeHealth.findUnique({
        where: { storeId },
        select: { score: true, metrics: true, computedAt: true },
      });

      return res.json({
        success: true,
        data: {
          health: health ?? { score: 0, metrics: null, computedAt: null },
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

export default dashboardRouter;
