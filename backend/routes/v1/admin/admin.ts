// routes/v1/admin.ts
import { Router } from "express";
import { z } from "zod";
import prisma from "../../../lib/prisma";
import { authenticate } from "../../../middleware/authenticate";
import { requireRole } from "../../../middleware/requireRole";
import { signJwt } from "../../../lib/auth";

const router = Router();
const respond = (res: any, status: number, body: object) =>
  res.status(status).json(body);

/**
 * NOTE
 * - This router is global admin level. It does not require storeContext.
 * - requireRole("SUPERADMIN") is applied to all endpoints here.
 */

router.use(authenticate);

/* -----------------------
   Admin - GET /v1/admin/stats
   - role: SUPERADMIN
   - returns global counts and recent activity summary
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
      prisma.user.count(),
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

    return respond(res, 200, {
      success: true,
      data: {
        counts: {
          users: userCount,
          stores: storeCount,
          medicines: medicineCount,
          batches: inventoryBatches,
          reorders: reordersCount,
          uploads: uploadsCount,
        },
        recentActivity,
      },
    });
  } catch (err) {
    console.error("GET /admin/stats error:", err);
    return respond(res, 500, {
      success: false,
      error: "internal_server_error",
    });
  }
});

/* -----------------------
   Admin - POST /v1/admin/users/:userId/impersonate
   - role: SUPERADMIN
   - returns a token that impersonates the user (signed JWT)
   - audit logs the action
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

      if (!user)
        return respond(res, 404, { success: false, error: "user_not_found" });
      if (!user.isActive)
        return respond(res, 403, { success: false, error: "user_disabled" });

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

      return respond(res, 200, {
        success: true,
        data: {
          token,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            globalRole: user.globalRole,
          },
        },
      });
    } catch (err) {
      console.error("POST /admin/users/:userId/impersonate error:", err);
      return respond(res, 500, {
        success: false,
        error: "internal_server_error",
      });
    }
  }
);

/* -----------------------
   Admin - GET /v1/admin/stores
   - role: SUPERADMIN
   - list stores with pagination and search
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
        }
      }
    });

    console.log(stores);

    return respond(res, 200, { success: true, data: { stores } });
  } catch (err) {
    return respond(res, 500, { error: "internal_error" });
  }
});



/* -----------------------
   Admin - PATCH /v1/admin/stores/:id/suspend
   - role: SUPERADMIN
   - toggle isActive
*/
router.patch("/stores/:id/suspend", requireRole("SUPERADMIN"), async (req: any, res) => {
  try {
    const id = req.params.id;
    const body = req.body; // { isActive: boolean }
    const isActive = body.isActive ?? false;

    const store = await prisma.store.update({
      where: { id },
      data: { isActive },
      select: {
        users : true
      }
    });

    await prisma.user.update({
      where: { id: store.users[0].userId },
      data: { isActive },
    });

    await prisma.auditLog.create({
      data: {
        actorId: req.user?.id,
        actorType: "ADMIN",
        action: isActive ? "ACTIVATE_STORE" : "SUSPEND_STORE",
        resource: "Store",
        resourceId: id,
      }
    });

    return respond(res, 200, { success: true, data: { store } });
  } catch (err) {
    return respond(res, 500, { error: "internal_error" });
  }
});

/* -----------------------
   Admin - GET /v1/admin/suppliers
   - role: SUPERADMIN
   - list global suppliers
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

    return respond(res, 200, { success: true, data: { suppliers } });
  } catch (err) {
    return respond(res, 500, { error: "internal_error" });
  }
});

/* -----------------------
   Admin - PATCH /v1/admin/suppliers/:id/suspend
   - role: SUPERADMIN
   - toggle isActive
*/
router.patch("/suppliers/:id/suspend", requireRole("SUPERADMIN"), async (req: any, res) => {
  try {
    const id = req.params.id;
    const body = req.body; // { isActive: boolean }
    const isActive = body.isActive ?? false;

    const supplier = await prisma.supplier.update({
      where: { id },
      data: { isActive },
    });

    await prisma.user.update({
      where: {
        id : supplier.userId ?? ""
      },
      data: {isActive: isActive }
    })

    await prisma.auditLog.create({
      data: {
        actorId: req.user?.id,
        actorType: "ADMIN",
        action: isActive ? "ACTIVATE_SUPPLIER" : "SUSPEND_SUPPLIER",
        resource: "Supplier",
        resourceId: id,
      }
    });

    return respond(res, 200, { success: true, data: { supplier } });
  } catch (err) {
    return respond(res, 500, { error: "internal_error" });
  }
});




/* -----------------------
   Admin - GET /v1/admin/users
   - role: SUPERADMIN
   - list users with pagination and search
*/
router.get("/users", requireRole("SUPERADMIN"), async (req: any, res) => {
  try {
    const q = req.query.q ? String(req.query.q).trim() : "";
    const showInactive = req.query.showInactive === "true";

    const where: any = {
      // Exclude self
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

    return respond(res, 200, { success: true, data: { users } });
  } catch (err) {
    console.error("GET /admin/users error:", err);
    return respond(res, 500, { error: "internal_error" });
  }
});



/* -----------------------
   Admin - POST /v1/admin/users/:userId/convert-to-supplier
   - role: SUPERADMIN
   - converts user to supplier role
   - ensures supplier profile exists
*/
router.post(
  "/users/:userId/convert-to-supplier",
  requireRole("SUPERADMIN"),
  async (req: any, res) => {
    try {
      const { userId } = req.params;
      
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) return respond(res, 404, { error: "user_not_found" });

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

      await prisma.auditLog.create({
        data: {
          actorId: req.user?.id,
          actorType: "ADMIN",
          action: "CONVERT_TO_SUPPLIER",
          resource: "User",
          resourceId: userId,
        },
      });

      return respond(res, 200, { success: true });
    } catch (err) {
      console.error("Convert user to supplier error:", err);
      return respond(res, 500, { error: "internal_error" });
    }
  }
);

export default router;

/* -----------------------
   Admin - DELETE /v1/admin/users/:id
   - role: SUPERADMIN
   - delete user
*/
router.delete("/users/:id", requireRole("SUPERADMIN"), async (req: any, res) => {
  try {
    const { id } = req.params;
    
    // Prevent deleting self
    if (req.user.id === id) {
      return respond(res, 400, { error: "cannot_delete_self" });
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return respond(res, 404, { error: "user_not_found" });

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

    return respond(res, 200, { success: true });
  } catch (err: any) {
    console.error("Delete user error:", err);
    if (err.code === "P2003") {
      return respond(res, 409, { error: "cannot_delete_user_data_integrity", message: "User has associated records (e.g. stores, sales) that prevent deletion." });
    }
    return respond(res, 500, { error: "internal_error" });
  }
});

/* -----------------------
   Admin - DELETE /v1/admin/stores/:id
   - role: SUPERADMIN
   - delete store
*/
router.delete("/stores/:id", requireRole("SUPERADMIN"), async (req: any, res) => {
  try {
    const { id } = req.params;

    const store = await prisma.store.findUnique({ where: { id } });
    if (!store) return respond(res, 404, { error: "store_not_found" });

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

    return respond(res, 200, { success: true });
  } catch (err: any) {
    console.error("Delete store error:", err);
    if (err.code === "P2003") {
      return respond(res, 409, { error: "cannot_delete_store_data_integrity", message: "Store has associated records (e.g. inventories, sales) that prevent deletion." });
    }
    return respond(res, 500, { error: "internal_error" });
  }
});

/* -----------------------
   Admin - DELETE /v1/admin/suppliers/:id
   - role: SUPERADMIN
   - delete supplier
*/
router.delete("/suppliers/:id", requireRole("SUPERADMIN"), async (req: any, res) => {
  try {
    const { id } = req.params;

    const supplier = await prisma.supplier.findUnique({ where: { id } });
    if (!supplier) return respond(res, 404, { error: "supplier_not_found" });

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

    return respond(res, 200, { success: true });
  } catch (err: any) {
    console.error("Delete supplier error:", err);
    if (err.code === "P2003") {
        return respond(res, 409, { error: "cannot_delete_supplier_data_integrity", message: "Supplier has associated records (e.g. requests, items) that prevent deletion." });
      }
    return respond(res, 500, { error: "internal_error" });
  }
});


/* -----------------------
   Admin - GET /v1/admin/dashboard/analytics
   - role: SUPERADMIN
   - provides extensive analytics data for the dashboard
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

    return respond(res, 200, {
      success: true,
      data: formattedData,
    });
  } catch (err: any) {
    console.error("Admin dashboard analytics error:", err);
    return respond(res, 500, { error: "internal_error" });
  }
});

