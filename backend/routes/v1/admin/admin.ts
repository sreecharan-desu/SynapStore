// routes/v1/admin.ts
import { Router } from "express";
import prisma from "../../../lib/prisma";
import { authenticate } from "../../../middleware/authenticate";
import { requireRole } from "../../../middleware/requireRole";
import { signJwt } from "../../../lib/auth";

import { sendSuccess, sendError, handlePrismaError, sendInternalError} from "../../../lib/api";
import { decryptCell, dekFromEnv } from "../../../middleware/prisma_crypto_middleware";

import { sendMail } from "../../../lib/mailer";
import { notificationQueue } from "../../../lib/queue";
import { z } from "zod";

const router = Router();
// Helper respond removed, using standard helpers from lib/api

// Lazy load DEK to avoid import-hoisting issues with dotenv
let _dek: Buffer;
const getDek = () => {
  if (!_dek) _dek = dekFromEnv();
  return _dek;
};



/**
 * NOTE
 * - This router is global admin level. It does not require storeContext.
 * - requireRole("SUPERADMIN") is applied to all endpoints here.
 */

router.use(authenticate);

/* -----------------------
   Admin - GET /v1/admin/stats
*/

/**
 * GET /v1/admin/stats
 * Description: Returns global counts and recent activity summary for the admin dashboard.
 * Headers: 
 *  - Authorization: Bearer <token> (Role: SUPERADMIN)
 * Body: None
 * Responses:
 *  - 200: { success: true, data: { counts: { ... }, recentActivity: [...] } }
 *  - 500: Internal server error
 */
router.get("/stats", requireRole("SUPERADMIN"), async (_req: any, res) => {
  try {
    // Gather multiple counts in parallel
    const [
      userCount,
      storeCount,
      medicineCount,
      inventoryBatches,
      uploadsCount,
    ] = await Promise.all([
      prisma.user.count({ where: { globalRole: { notIn: ["SUPERADMIN", "ADMIN"] } } }),
      prisma.store.count(),
      prisma.medicine.count(),
      prisma.inventoryBatch.count(),
      prisma.upload.count(),
    ]);

    // Reorder model was removed, defaulting to 0
    const reordersCount = 0;

    // Recent activity: last 20 activity logs
    const recentActivity = await prisma.activityLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        storeId: true,
        userId: true,
        action: true,
        payload: true,
        createdAt: true,
      },
    });

    return sendSuccess(res, "Admin stats retrieved", {
      counts: {
        users: userCount,
        stores: storeCount,
        medicines: medicineCount,
        batches: inventoryBatches,
        reorders: reordersCount,
        uploads: uploadsCount,
      },
      recentActivity,
    });
  } catch (err) {
    return sendInternalError(res, err, "Failed to retrieve admin stats");
  }
});

/* -----------------------
   Admin - POST /v1/admin/users/:userId/impersonate
*/

/**
 * POST /v1/admin/users/:userId/impersonate
 * Description: Generates a JWT token to impersonate a specific user.
 * Headers: 
 *  - Authorization: Bearer <token> (Role: SUPERADMIN)
 * Body: None
 * Responses:
 *  - 200: { success: true, data: { token, user: { ... } } }
 *  - 403: User disabled or other permission error
 *  - 404: User not found
 *  - 500: Internal server error
 */
router.post(
  "/users/:userId/impersonate",
  requireRole("SUPERADMIN"),
  async (req: any, res) => {
    try {
      const targetUserId = String(req.params.userId);

      const user = await prisma.user.findUnique({
        where: { id: targetUserId },
        select: {
          id: true,
          username: true,
          email: true,
          globalRole: true,
          isActive: true,
        },
      });

      if (!user) return sendError(res, "User not found", 404);
      if (!user.isActive) return sendError(res, "User is disabled or suspended", 403, { code: "user_disabled" });

      // sign a token for the user - include an "impersonator" claim for audit
      const token = signJwt({
        sub: user.id,
        email: user.email,
        impersonatedBy: req.user?.id ?? null,
      });

      // write audit log
      await prisma.auditLog.create({
        data: {
          actorId: req.user?.id ?? null,
          actorType: "ADMIN",
          action: "IMPERSONATE_USER",
          resource: "User",
          resourceId: user.id,
          payload: { impersonatedBy: req.user?.id ?? null },
        },
      });

      return sendSuccess(res, "Impersonation successful", {
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          globalRole: user.globalRole,
        },
      });
    } catch (err) {
      return sendInternalError(res, err, "Failed to impersonate user");
    }
  }
);

/* -----------------------
   Admin - GET /v1/admin/stores
*/

/**
 * GET /v1/admin/stores
 * Description: Lists stores with pagination and search capabilities.
 * Headers: 
 *  - Authorization: Bearer <token> (Role: SUPERADMIN)
 * Query Params:
 *  - q: string (search term)
 *  - showInactive: boolean (true to include inactive stores)
 * Body: None
 * Responses:
 *  - 200: { success: true, data: { stores: [...] } }
 *  - 500: Internal server error
 */
router.get("/stores", requireRole("SUPERADMIN"), async (req: any, res) => {
  try {
    const q = req.query.q ? String(req.query.q).trim() : "";
    const showInactive = req.query.showInactive === "true";
    
    const where: any = {};
    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { slug: { contains: q, mode: "insensitive" } },
      ];
    }
    if (!showInactive) {
      where.isActive = true;
    }

    const stores = await prisma.store.findMany({
      where: {
        AND: [
          { OR: [{ isActive: true }, { isActive: false }] },
          {
            // Exclude stores owned by users who are now global Suppliers
            users: {
              none: {
                role: "STORE_OWNER",
                user: {
                  globalRole: "SUPPLIER",
                },
              },
            },
          },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        users: {
          where: { role: "STORE_OWNER" },
          take: 1,
          select: { userId: true, user: { select: { email: true } } }
        },
      },
    });

    // Decrypt emails for store owners
    const decryptedStores = stores.map(store => ({
      ...store,
      users: store.users.map(storeUser => ({
        ...storeUser,
        user: storeUser.user ? { ...storeUser.user, email: decryptEmail(storeUser.user.email) } : null,
      })),
    }));

    return sendSuccess(res, "Stores retrieved", { stores: decryptedStores });
  } catch (err) {
    return sendInternalError(res, err);
  }
});



/* -----------------------
   Admin - PATCH /v1/admin/stores/:id/suspend
*/

/**
 * PATCH /v1/admin/stores/:id/suspend
 * Description: Toggles the active status of a store.
 * Headers: 
 *  - Authorization: Bearer <token> (Role: SUPERADMIN)
 * Body:
 *  - isActive: boolean
 * Responses:
 *  - 200: { success: true, data: { store: { ... } } }
 *  - 500: Internal server error
 */
router.patch("/stores/:id/suspend", requireRole("SUPERADMIN"), async (req: any, res) => {
  try {
    const id = req.params.id;
    const body = req.body; // { isActive: boolean }
    const isActive = body.isActive ?? false;

    // First check existence
    const existingStore = await prisma.store.findUnique({ where: { id }, select: { id: true } });
    if (!existingStore) return sendError(res, "Store not found", 404);

    const store = await prisma.store.update({
      where: { id },
      data: { isActive },
      select: {
        id: true, name: true, isActive: true,
        users : true
      }
    });

    if (store.users && store.users.length > 0) {
      await prisma.user.update({
        where: { id: store.users[0].userId },
        data: { isActive },
      });
    }

    await prisma.auditLog.create({
      data: {
        actorId: req.user?.id,
        actorType: "ADMIN",
        action: isActive ? "ACTIVATE_STORE" : "SUSPEND_STORE",
        resource: "Store",
        resourceId: id,
      }
    });

    return sendSuccess(res, isActive ? "Store activated" : "Store suspended", { store });
  } catch (err) {
    return handlePrismaError(res, err, "Store");
  }
});

/* -----------------------
   Admin - GET /v1/admin/suppliers
*/

/**
 * GET /v1/admin/suppliers
 * Description: Lists global suppliers with search capabilities.
 * Headers: 
 *  - Authorization: Bearer <token> (Role: SUPERADMIN)
 * Query Params:
 *  - q: string (search term)
 * Body: None
 * Responses:
 *  - 200: { success: true, data: { suppliers: [...] } }
 *  - 500: Internal server error
 */
router.get("/suppliers", requireRole("SUPERADMIN"), async (req: any, res) => {
  try {
    const q = req.query.q ? String(req.query.q).trim() : "";
    
    const where: any = {};
    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { contactName: { contains: q, mode: "insensitive" } },
      ];
    }

    const suppliers = await prisma.supplier.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        user: { select: { id: true, email: true, username: true } }
      }
    });

    return sendSuccess(res, "Suppliers retrieved", { suppliers });
  } catch (err) {
    return sendInternalError(res, err);
  }
});

/* -----------------------
   Admin - PATCH /v1/admin/suppliers/:id/suspend
*/

/**
 * PATCH /v1/admin/suppliers/:id/suspend
 * Description: Toggles the active status of a supplier.
 * Headers: 
 *  - Authorization: Bearer <token> (Role: SUPERADMIN)
 * Body:
 *  - isActive: boolean
 * Responses:
 *  - 200: { success: true, data: { supplier: { ... } } }
 *  - 500: Internal server error
 */
router.patch("/suppliers/:id/suspend", requireRole("SUPERADMIN"), async (req: any, res) => {
  try {
    const id = req.params.id;
    const body = req.body; // { isActive: boolean }
    const isActive = body.isActive ?? false;

    // check exist
    const exists = await prisma.supplier.findUnique({ where: { id }, select: { id: true } });
    if (!exists) return sendError(res, "Supplier not found", 404);

    const supplier = await prisma.supplier.update({
      where: { id },
      data: { isActive },
    });

    if (supplier.userId) {
      await prisma.user.update({
        where: {
          id : supplier.userId
        },
        data: { isActive: isActive }
      });
    }

    await prisma.auditLog.create({
      data: {
        actorId: req.user?.id,
        actorType: "ADMIN",
        action: isActive ? "ACTIVATE_SUPPLIER" : "SUSPEND_SUPPLIER",
        resource: "Supplier",
        resourceId: id,
      }
    });

    return sendSuccess(res, isActive ? "Supplier activated" : "Supplier suspended", { supplier });
  } catch (err) {
    return handlePrismaError(res, err, "Supplier");
  }
});




/* -----------------------
   Admin - GET /v1/admin/users
*/

/**
 * GET /v1/admin/users
 * Description: Lists users with pagination and search capabilities.
 * Headers: 
 *  - Authorization: Bearer <token> (Role: SUPERADMIN)
 * Query Params:
 *  - q: string (search term)
 *  - showInactive: boolean
 * Body: None
 * Responses:
 *  - 200: { success: true, data: { users: [...] } }
 *  - 500: Internal server error
 */
router.get("/users", requireRole("SUPERADMIN"), async (req: any, res) => {
  try {
    const q = req.query.q ? String(req.query.q).trim() : "";
    const showInactive = req.query.showInactive === "true";

    const where: any = {
      // Exclude self (optional, maybe superadmin wants to see self too?)
      id: { not: req.user?.id },
    };
    if (q) {
      where.OR = [
        { username: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ];
    }
    if (!showInactive) {
      where.isActive = true;
    }

    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100, // Limit to 100 for now, can be paginated later
      select: {
        id: true,
        username: true,
        email: true,
        globalRole: true,
        isActive: true,
        createdAt: true,
      },
    });

    return sendSuccess(res, "Users retrieved", { users });
  } catch (err) {
    return sendInternalError(res, err);
  }
});



/* -----------------------
   Admin - POST /v1/admin/users/:userId/convert-to-supplier
*/

/**
 * POST /v1/admin/users/:userId/convert-to-supplier
 * Description: Converts a user to a supplier role and ensures a supplier profile exists.
 * Headers: 
 *  - Authorization: Bearer <token> (Role: SUPERADMIN)
 * Body: None
 * Responses:
 *  - 200: { success: true }
 *  - 404: User not found
 *  - 500: Internal server error
 */
router.post(
  "/users/:userId/convert-to-supplier",
  requireRole("SUPERADMIN"),
  async (req: any, res) => {
    try {
      const { userId } = req.params;
      
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) return sendError(res, "User not found", 404);

      await prisma.user.update({
        where: { id: userId },
        data: { globalRole: "SUPPLIER" },
      });

      // Ensure supplier profile exists
      const existingProfile = await prisma.supplier.findUnique({
        where: { userId },
      });

      if (!existingProfile) {
        // Create default profile
        await prisma.supplier.create({
          data: {
            name: `Supplier ${user.username || "User"}`, // rudimentary name
            userId,
          },
        });

      }
      
      // 3. Remove user from any existing store roles (STORE_OWNER, MANAGER, USER)
      // We do NOT delete the store itself immediately, we only remove the user's access.
      // If the user was the ONLY owner, the store becomes ownerless (or we could choose to delete it).
      // For safety, we will just remove the role.
      const userRoles = await prisma.userStoreRole.findMany({
        where: { userId },
        select: { id: true, storeId: true, role: true }
      });

      if (userRoles.length > 0) {
        // Delete all roles for this user
        await prisma.userStoreRole.deleteMany({
          where: { userId }
        });

        // Optional: Check for orphaned stores (stores with no users)
        // This is a "nice to have" cleanup but risky if valuable data exists.
        // We will log them for manual review instead of auto-deleting data.
        for (const role of userRoles) {
          const remainingUsers = await prisma.userStoreRole.count({
            where: { storeId: role.storeId }
          });
          
          if (remainingUsers === 0) {
            console.warn(`[ConvertSupplier] Store ${role.storeId} is now orphaned (no users). Consider deactivating.`);
            // Optionally auto-suspend orphaned stores
            await prisma.store.update({
              where: { id: role.storeId },
              data: { isActive: false }
            }).catch(e => console.error("Failed to suspend orphaned store", e));
          }
        }
      }

      await prisma.auditLog.create({
        data: {
          actorId: req.user?.id,
          actorType: "ADMIN",
          action: "CONVERT_TO_SUPPLIER",
          resource: "User",
          resourceId: userId,
        },
      });

      return sendSuccess(res, "User converted to supplier role");
    } catch (err) {
      return handlePrismaError(res, err, "User");
    }
  }
);

export default router;

/* -----------------------
   Admin - DELETE /v1/admin/users/:id
*/

/**
 * DELETE /v1/admin/users/:id
 * Description: Deletes a user.
 * Headers: 
 *  - Authorization: Bearer <token> (Role: SUPERADMIN)
 * Body: None
 * Responses:
 *  - 200: { success: true }
 *  - 400: Cannot delete self
 *  - 404: User not found
 *  - 409: Data integrity violation (user has associated records)
 *  - 500: Internal server error
 */
router.delete("/users/:id", requireRole("SUPERADMIN"), async (req: any, res) => {
  try {
    const { id } = req.params;
    
    // Prevent deleting self
    if (req.user.id === id) {
      return sendError(res, "Cannot delete your own account", 400);
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return sendError(res, "User not found", 404);

    // Attempt delete
    await prisma.user.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        actorId: req.user?.id,
        actorType: "ADMIN",
        action: "DELETE_USER",
        resource: "User",
        resourceId: id,
        payload: { username: user.username, email: user.email },
      },
    });

    return sendSuccess(res, "User deleted successfully");
  } catch (err: any) {
    if (err.code === "P2003") {
      return sendError(res, "User has associated records (e.g. stores, sales) that prevent deletion.", 409, { code: "cannot_delete_user_data_integrity" });
    }
    return sendInternalError(res, err);
  }
});

/* -----------------------
   Admin - DELETE /v1/admin/stores/:id
*/

/**
 * DELETE /v1/admin/stores/:id
 * Description: Deletes a store.
 * Headers: 
 *  - Authorization: Bearer <token> (Role: SUPERADMIN)
 * Body: None
 * Responses:
 *  - 200: { success: true }
 *  - 404: Store not found
 *  - 409: Data integrity violation (store has associated records)
 *  - 500: Internal server error
 */
router.delete("/stores/:id", requireRole("SUPERADMIN"), async (req: any, res) => {
  try {
    const { id } = req.params;

    const store = await prisma.store.findUnique({ where: { id } });
    if (!store) return sendError(res, "Store not found", 404);

    // Attempt delete
    await prisma.store.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        actorId: req.user?.id,
        actorType: "ADMIN",
        action: "DELETE_STORE",
        resource: "Store",
        resourceId: id,
        payload: { name: store.name },
      },
    });

    return sendSuccess(res, "Store deleted successfully");
  } catch (err: any) {
    if (err.code === "P2003") {
      return sendError(res, "Store has associated records (e.g. inventories, sales) that prevent deletion.", 409, { code: "cannot_delete_store_data_integrity" });
    }
    return sendInternalError(res, err);
  }
});

/* -----------------------
   Admin - DELETE /v1/admin/suppliers/:id
*/

/**
 * DELETE /v1/admin/suppliers/:id
 * Description: Deletes a supplier.
 * Headers: 
 *  - Authorization: Bearer <token> (Role: SUPERADMIN)
 * Body: None
 * Responses:
 *  - 200: { success: true }
 *  - 404: Supplier not found
 *  - 409: Data integrity violation (supplier has associated records)
 *  - 500: Internal server error
 */
router.delete("/suppliers/:id", requireRole("SUPERADMIN"), async (req: any, res) => {
  try {
    const { id } = req.params;

    const supplier = await prisma.supplier.findUnique({ where: { id } });
    if (!supplier) return sendError(res, "Supplier not found", 404);

    // Attempt delete
    await prisma.supplier.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        actorId: req.user?.id,
        actorType: "ADMIN",
        action: "DELETE_SUPPLIER",
        resource: "Supplier",
        resourceId: id,
        payload: { name: supplier.name },
      },
    });

    return sendSuccess(res, "Supplier deleted successfully");
  } catch (err: any) {
    if (err.code === "P2003") {
        return sendError(res, "Supplier has associated records (e.g. requests, items) that prevent deletion.", 409, { code: "cannot_delete_supplier_data_integrity" });
      }
    return sendInternalError(res, err);
  }
});


/* -----------------------
   Admin - GET /v1/admin/dashboard/analytics
*/

/**
 * GET /v1/admin/dashboard/analytics
 * Description: Provides extensive analytics data for the admin dashboard.
 * Headers: 
 *  - Authorization: Bearer <token> (Role: SUPERADMIN)
 * Body: None
 * Responses:
 *  - 200: { success: true, data: { overview: {...}, trends: {...}, distributions: {...}, recentCriticalActivity: [...] } }
 *  - 500: Internal server error
 */
router.get("/dashboard/analytics", requireRole("SUPERADMIN"), async (req: any, res) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // 1. Parallelize high-level count & aggregate queries
    const [
      totalUsers,
      totalStores,
      activeStores,
      totalSuppliers,
      totalMedicines,
      totalSalesCount,
      totalRevenueAgg,
      pendingRequests,
      failedUploads,
      expiringBatches,
    ] = await Promise.all([
      prisma.user.count({ where: { globalRole: { not: "SUPERADMIN" } } }),
      prisma.store.count(),
      prisma.store.count({ where: { isActive: true } }),
      prisma.supplier.count(),
      prisma.medicine.count(),
      prisma.sale.count(),
      prisma.sale.aggregate({
        _sum: { totalValue: true },
        where: { paymentStatus: "PAID" },
      }),
      prisma.supplierRequest.count({ where: { status: "PENDING" } }),
      prisma.upload.count({ where: { status: "FAILED" } }),
      prisma.inventoryBatch.count({
        where: {
          expiryDate: {
            gte: new Date(),
            lte: thirtyDaysAgo, // actually we want next 30 days, so logic needs fix below
          },
          qtyAvailable: { gt: 0 },
        },
      }),
    ]);

    // Fix expiring batches query logic (Batches expiring in NEXT 30 days)
    const next30Days = new Date();
    next30Days.setDate(next30Days.getDate() + 30);
    const expiringSoonCount = await prisma.inventoryBatch.count({
      where: {
        expiryDate: {
          gte: new Date(),
          lte: next30Days,
        },
        qtyAvailable: { gt: 0 },
      },
    });

    // 2. Distributions
    // Payment Methods
    const salesByPaymentMethod = await prisma.sale.groupBy({
      by: ["paymentMethod"],
      _count: { id: true },
      _sum: { totalValue: true },
    });

    // User Roles
    const usersByGlobalRole = await prisma.user.groupBy({
      by: ["globalRole"],
      _count: { id: true },
    });

    // 3. Time Series / Trends (Raw SQL for date truncation)
    // Daily New Users (Last 30 days)
    const dailyUserRegistrations = await prisma.$queryRaw`
      SELECT
        TO_CHAR("createdAt", 'YYYY-MM-DD') as date,
        COUNT(id)::int as count
      FROM "User"
      WHERE "createdAt" >= ${thirtyDaysAgo}
      GROUP BY TO_CHAR("createdAt", 'YYYY-MM-DD')
      ORDER BY date ASC;
    `;

    // Daily Sales Revenue (Last 30 days)
    const dailySalesTrends = await prisma.$queryRaw`
      SELECT
        TO_CHAR("createdAt", 'YYYY-MM-DD') as date,
        COUNT(id)::int as count,
        SUM("totalValue") as revenue
      FROM "Sale"
      WHERE "createdAt" >= ${thirtyDaysAgo}
      AND "paymentStatus" = 'PAID'
      GROUP BY TO_CHAR("createdAt", 'YYYY-MM-DD')
      ORDER BY date ASC;
    `;

    // 4. Inventory Value Estimation (Global)
    // Beware: This can be heavy on large datasets. aggregated per store might be better but global is asked.
    // We sum (qtyAvailable * purchasePrice) if available, else ignored.
    // Prisma doesn't support arithmetic in aggregate _sum easily without raw query or computed fields.
    // We'll calculate a rough estimate via raw query for performance.
    const inventoryValuation = await prisma.$queryRaw`
      SELECT SUM("qtyAvailable" * COALESCE("purchasePrice", 0)) as total_value
      FROM "InventoryBatch"
      WHERE "qtyAvailable" > 0
    `;
    // @ts-ignore
    const totalInventoryValue = inventoryValuation[0]?.total_value || 0;

    // 5. Recent Critical Activities (Audit Logs)
    const recentCriticalActions = await prisma.auditLog.findMany({
      where: {
        action: { in: ["DELETE_USER", "DELETE_STORE", "SUSPEND_STORE", "CONVERT_TO_SUPPLIER"] }
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    const formattedData = {
      overview: {
        users: { total: totalUsers, verified: 0 /* Add if needed */ },
        stores: { total: totalStores, active: activeStores, inactive: totalStores - activeStores },
        suppliers: { total: totalSuppliers },
        medicines: { total: totalMedicines },
        financials: {
          totalRevenue: totalRevenueAgg._sum.totalValue ?? 0,
          inventoryValue: totalInventoryValue,
          totalSalesCount,
        },
        operations: {
          pendingSupplierRequests: pendingRequests,
          failedUploads: failedUploads,
          expiringBatchesNext30Days: expiringSoonCount,
        },
      },
      trends: {
        users: dailyUserRegistrations,
        sales: dailySalesTrends,
      },
      distributions: {
        paymentMethods: salesByPaymentMethod.map(p => ({
            method: p.paymentMethod,
            count: p._count.id,
            revenue: p._sum.totalValue
        })),
        userRoles: usersByGlobalRole.map(r => ({
            role: r.globalRole ?? "NONE",
            count: r._count.id
        })),
      },
      recentCriticalActivity: recentCriticalActions
    };

    return sendSuccess(res, "Admin analytics retrieved", formattedData);
  } catch (err: any) {
    return sendInternalError(res, err, "Failed to retrieve admin analytics");
  }
});

/* -----------------------
   Admin - POST /v1/admin/notifications/send
*/
const sendNotificationSchema = z.object({
  targetRole: z.enum(["ALL", "SUPPLIER", "STORE_OWNER"]).optional(),
  targetUserIds: z.array(z.string()).optional(),
  type: z.enum(["SYSTEM", "EMAIL", "BOTH"]),
  subject: z.string().min(1),
  message: z.string().min(1),
});

router.post("/notifications/send", requireRole("SUPERADMIN"), async (req: any, res) => {
  try {
     const body = sendNotificationSchema.parse(req.body);
     const { targetRole, targetUserIds, type, subject, message } = body;

     let users: any[] = [];
     
     // 1. Fetch Users
     if (targetUserIds && targetUserIds.length > 0) {
       users = await prisma.user.findMany({
         where: { id: { in: targetUserIds } },
         select: { id: true, email: true }
       });
     } else if (targetRole) {
        if (targetRole === 'ALL') {
             users = await prisma.user.findMany({ select: { id: true, email: true } });
        } else if (targetRole === 'SUPPLIER') {
             users = await prisma.user.findMany({ 
                where: { globalRole: 'SUPPLIER' }, 
                select: { id: true, email: true,username : true } 
             });
        } else if (targetRole === 'STORE_OWNER') {
             users = await prisma.user.findMany({
                where: { 
                   OR: [
                     { globalRole: 'STORE_OWNER' },
                     // Also include those with role in Store
                     { stores: { some: { role: 'STORE_OWNER' } } }
                   ]
                },
                select: { id: true, email: true,username : true }
             });
        }
     }

     if (users.length === 0) return sendError(res, "No users found for criteria", 404);

     // 2. Send
     // Calculate operations but don't await them all in the main response loop to avoid blocking if list is huge.
     // However, for admin panel feedback, it's nice to wait or at least ensure no errors. 
     // We will run this in background after responding? Or respond after initiating?
     // Let's iterate using standard loop to properly scope async operations.
     
     const dispatchPromises = users.map(async (u) => {
        // Use the decrypted email helper
        const email = decryptEmail(u.email); 
        // Email
        if ((type === "EMAIL" || type === "BOTH") && email) {
             await sendMail({ to: email, subject, html: message }).catch(e => console.error(`Failed to email ${email}`, e));
        }

        // System
        if (type === "SYSTEM" || type === "BOTH") {
             // We use u.id as websiteUrl to target specific user
             // The frontend App.tsx now listens to `user.id.u.synapstore.com` when authenticated.
             // We MUST send a valid URL structure for the notification service to accept it (fixes 400 error).
             
             const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

             notificationQueue.add("send-notification", {
                websiteUrl: frontendUrl,
                title: `Hello ${u.username}`,
                message: message,
                buttons: [{ label: `Go to Dashboard`, link: `${frontendUrl}` }]
             });
        }
     });
     
     // Wait for all dispatches (or remove await if you want fire-and-forget)
     await Promise.all(dispatchPromises);
     
     return sendSuccess(res, `Notification dispatched to ${users.length} users.`);

  } catch (err) {
     // @ts-ignore
     if (err instanceof z.ZodError) return handleZodError(res, err);
     return sendInternalError(res, err);
  }
});

function decryptEmail(email: string | null): string | null {
  if (!email) return null;
  // Attempt decryption; if it fails (returns null), fallback to original (backward compat or plaintext)
  const val = decryptCell(email, getDek());
  return val !== null ? val : email;
}

