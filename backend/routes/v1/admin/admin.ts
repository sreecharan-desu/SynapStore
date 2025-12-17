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

const decryptUser = (user: any) => {
  if (!user) return null;
  const dek = getDek();
  try {
    return {
      ...user,
      email: user.email ? decryptCell(user.email, dek) : user.email,
      username: user.username ? decryptCell(user.username, dek) : user.username,
      phone: user.phone ? decryptCell(user.phone, dek) : user.phone,
    };
  } catch (e) {
    return user;
  }
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
      prisma.user.count({ where: { globalRole: { notIn: ["SUPERADMIN", "SUPERADMIN"] } } }),
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

// /**
//  * POST /v1/admin/users/:userId/impersonate
//  * Description: Generates a JWT token to impersonate a specific user.
//  * Headers: 
//  *  - Authorization: Bearer <token> (Role: SUPERADMIN)
//  * Body: None
//  * Responses:
//  *  - 200: { success: true, data: { token, user: { ... } } }
//  *  - 403: User disabled or other permission error
//  *  - 404: User not found
//  *  - 500: Internal server error
//  */
// router.post(
//   "/users/:userId/impersonate",
//   requireRole("SUPERADMIN"),
//   async (req: any, res) => {
//     try {
//       const targetUserId = String(req.params.userId);

//       const user = await prisma.user.findUnique({
//         where: { id: targetUserId },
//         select: {
//           id: true,
//           username: true,
//           email: true,
//           globalRole: true,
//           isActive: true,
//         },
//       });

//       if (!user) return sendError(res, "User not found", 404);
//       if (!user.isActive) return sendError(res, "User is disabled or suspended", 403, { code: "user_disabled" });

//       // sign a token for the user - include an "impersonator" claim for audit
//       const token = signJwt({
//         sub: user.id,
//         email: user.email,
//         impersonatedBy: req.user?.id ?? null,
//       });

//       // write audit log
//       await prisma.auditLog.create({
//         data: {
//           actorId: req.user?.id ?? null,
//           actorType: "SUPERADMIN",
//           action: "IMPERSONATE_USER",
//           resource: "User",
//           resourceId: user.id,
//           payload: { impersonatedBy: req.user?.id ?? null },
//         },
//       });

//       return sendSuccess(res, "Impersonation successful", {
//         token,
//         user: decryptUser({
//           id: user.id,
//           username: user.username,
//           email: user.email,
//           globalRole: user.globalRole,
//         }),
//       });
//     } catch (err) {
//       return sendInternalError(res, err, "Failed to impersonate user");
//     }
//   }
// );

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
    const decryptedStores = stores.map((store:any) => ({
      ...store,
      users: store.users.map((storeUser:any) => ({
        ...storeUser,
        user: decryptUser(storeUser.user),
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
        actorType: "SUPERADMIN",
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

    const decryptedSuppliers = suppliers.map((s: any) => ({
        ...s,
        user: s.user ? decryptUser(s.user) : null
    }));

    return sendSuccess(res, "Suppliers retrieved", { suppliers: decryptedSuppliers });
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
        actorType: "SUPERADMIN",
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

    const decryptedUsers = users.map((u: any) => decryptUser(u));

    return sendSuccess(res, "Users retrieved", { users: decryptedUsers });
  } catch (err) {
    return sendInternalError(res, err);
  }
});




/* -----------------------
   Admin - PATCH /v1/admin/users/:userId/suspend
*/
router.patch("/users/:userId/suspend", requireRole("SUPERADMIN"), async (req: any, res) => {
  try {
    const { userId } = req.params;
    const body = req.body; // { isActive: boolean }
    const isActive = body.isActive ?? false;

    // Prevent suspending self
    if (req.user?.id === userId) {
      return sendError(res, "Cannot suspend your own account", 400);
    }

    const startUser = await prisma.user.findUnique({ where: { id: userId }, select: { username: true } });
    if (!startUser) return sendError(res, "User not found", 404);

    const user = await prisma.user.update({
      where: { id: userId },
      data: { isActive },
      select: { id: true, username: true, isActive: true, email: true }
    });

    await prisma.auditLog.create({
      data: {
        actorId: req.user?.id,
        actorType: "SUPERADMIN",
        action: isActive ? "ACTIVATE_USER" : "SUSPEND_USER",
        resource: "User",
        resourceId: userId,
        payload: { username: user.username }
      }
    });

    return sendSuccess(res, isActive ? "User activated" : "User suspended", { user: decryptUser(user) });
  } catch (err: any) {
    return handlePrismaError(res, err, "User");
  }
});


import { EntityManager } from "../../../lib/entity-manager";


router.post(
  "/users/:userId/convert-to-supplier",
  requireRole("SUPERADMIN"),
  async (req: any, res) => {
    try {
      const { userId } = req.params;

      await prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({ where: { id: userId } });
        if (!user) throw new Error("User not found");

        // 1. Update Global Role
        await tx.user.update({
          where: { id: userId },
          data: { globalRole: "SUPPLIER" },
        });

        // 2. Ensure Supplier Profile
        const existingProfile = await tx.supplier.findUnique({ where: { userId } });
        if (!existingProfile) {
          await tx.supplier.create({
            data: {
              name: `Supplier ${user.username || "Inc."}`,
              userId,
            },
          });
        }

        // 3. Handle existing Store Roles
        const userRoles = await tx.userStoreRole.findMany({ where: { userId } });
        
        // Remove direct roles
        await tx.userStoreRole.deleteMany({ where: { userId } });

        // Check for orphaned stores
        for (const role of userRoles) {
          // If the converted user was an owner, check if other owners exist
          if (role.role === "STORE_OWNER") {
            const ownerCount = await tx.userStoreRole.count({
              where: { storeId: role.storeId, role: "STORE_OWNER" }
            });

            if (ownerCount === 0) {
              console.log(`[ConvertSupplier] Store ${role.storeId} orphaned. Deleting...`);
              // @ts-ignore
              await EntityManager.deleteStore(role.storeId, tx);
            }
          }
        }

        // Audit Log
        await tx.auditLog.create({
          data: {
            actorId: req.user?.id,
            actorType: "SUPERADMIN",
            action: "CONVERT_TO_SUPPLIER",
            resource: "User",
            resourceId: userId,
          },
        });
      }, { timeout: 45000 });

      return sendSuccess(res, "User converted to supplier role");
    } catch (err: any) {
       if (err.message === "User not found") return sendError(res, "User not found", 404);
       return handlePrismaError(res, err, "User");
    }
  }
);

/* -----------------------
   Admin - GET /v1/admin/graph
*/

/**
 * GET /v1/admin/graph
 * Description: Returns a graph representation of the system (Users, Stores, Suppliers and their relations).
 * Headers: 
 *  - Authorization: Bearer <token> (Role: SUPERADMIN)
 * Body: None
 * Responses:
 *  - 200: { success: true, data: { nodes: [...], edges: [...] } }
 *  - 500: Internal server error
 */
router.get("/graph", requireRole("SUPERADMIN"), async (req: any, res) => {
  try {
    // Fetch all entities in parallel
    const [
      users,
      stores,
      suppliers,
      userStoreRoles,
      supplierStores,
      supplierRequests
    ] = await Promise.all([
      prisma.user.findMany({
        select: { id: true, username: true, email: true, globalRole: true }
      }),
      prisma.store.findMany({
        select: { id: true, name: true, isActive: true }
      }),
      prisma.supplier.findMany({
        select: { id: true, name: true, userId: true }
      }),
      prisma.userStoreRole.findMany({
        select: { userId: true, storeId: true, role: true }
      }),
      prisma.supplierStore.findMany({
        select: { supplierId: true, storeId: true }
      }),
      prisma.supplierRequest.findMany({
          where: { status: "PENDING" },
          select: { supplierId: true, storeId: true, createdById: true }
      })
    ]);

    const nodes: any[] = [];
    const edges: any[] = [];

    // 1. User Nodes
    users.forEach(u => {
      const decrypted = decryptUser(u);
      nodes.push({
        id: `u_${u.id}`,
        type: "USER",
        label: decrypted?.username || "Unknown",
        subLabel: decrypted?.email || "",
        data: { role: u.globalRole }
      });
    });

    // 2. Store Nodes
    stores.forEach(s => {
      nodes.push({
        id: `s_${s.id}`,
        type: "STORE",
        label: s.name,
        data: { isActive: s.isActive }
      });
    });

    // 3. Supplier Nodes
    suppliers.forEach(sup => {
      nodes.push({
        id: `sup_${sup.id}`,
        type: "SUPPLIER",
        label: sup.name,
      });

      // Edge: User -> Supplier (Management)
      if (sup.userId) {
        edges.push({
          source: `u_${sup.userId}`,
          target: `sup_${sup.id}`,
          type: "MANAGES",
          label: "Admin"
        });
      }
    });

    // 4. Edges: User -> Store
    userStoreRoles.forEach(role => {
      edges.push({
        source: `u_${role.userId}`,
        target: `s_${role.storeId}`,
        type: "WORKS_AT",
        label: role.role
      });
    });

    // 5. Edges: Supplier <-> Store (Active Connection)
    supplierStores.forEach(rel => {
      edges.push({
        source: `sup_${rel.supplierId}`,
        target: `s_${rel.storeId}`,
        type: "CONNECTED",
        label: "Active"
      });
    });

    // 6. Edges: SupplierRequest (Pending)
    supplierRequests.forEach(req => {
        // Need to be careful not to duplicate if multiple requests exist (though pending should be uniqueish)
       if (req.supplierId && req.storeId) {
            edges.push({
                source: `sup_${req.supplierId}`,
                target: `s_${req.storeId}`,
                type: "REQUEST",
                label: "Pending"
            });
       }
    });

    return sendSuccess(res, "Graph data retrieved", { nodes, edges });
  } catch (err) {
    return sendInternalError(res, err, "Failed to retrieve graph data");
  }
});

router.delete("/users/:id", requireRole("SUPERADMIN"), async (req: any, res) => {
  try {
    const { id } = req.params;
    
    if (req.user.id === id) {
      return sendError(res, "Cannot delete your own account", 400);
    }

    const { username, email } = await prisma.user.findUnique({ where: { id }, select: { username: true, email: true } }) || {};
    if (!username) return sendError(res, "User not found", 404);

    await prisma.$transaction(async (tx:any) => {
      await EntityManager.deleteUser(id, tx);
      
      await tx.auditLog.create({
        data: {
          actorId: req.user?.id,
          actorType: "SUPERADMIN",
          action: "DELETE_USER",
          resource: "User",
          resourceId: id,
          payload: { username, email },
        },
      });
    }, { timeout: 45000 });

    return sendSuccess(res, "User deleted successfully");
  } catch (err: any) {
    return sendInternalError(res, err);
  }
});

/* -----------------------
   Admin - DELETE /v1/admin/stores/:id
*/
router.delete("/stores/:id", requireRole("SUPERADMIN"), async (req: any, res) => {
  try {
    const { id } = req.params;

    const store = await prisma.store.findUnique({ where: { id }, select: { name: true } });
    if (!store) return sendError(res, "Store not found", 404);

    await prisma.$transaction(async (tx:any) => {
      await EntityManager.deleteStore(id, tx);

      await tx.auditLog.create({
        data: {
          actorId: req.user?.id,
          actorType: "SUPERADMIN",
          action: "DELETE_STORE",
          resource: "Store",
          resourceId: id,
          payload: { name: store.name },
        },
      });
    }, { timeout: 45000 });

    return sendSuccess(res, "Store deleted successfully");
  } catch (err: any) {
    return sendInternalError(res, err);
  }
});

/* -----------------------
   Admin - DELETE /v1/admin/suppliers/:id
*/
router.delete("/suppliers/:id", requireRole("SUPERADMIN"), async (req: any, res) => {
  try {
    const { id } = req.params;

    const supplier = await prisma.supplier.findUnique({ where: { id }, select: { name: true } });
    if (!supplier) return sendError(res, "Supplier not found", 404);

    await prisma.$transaction(async (tx:any) => {
      await EntityManager.deleteSupplier(id, tx);

      await tx.auditLog.create({
        data: {
          actorId: req.user?.id,
          actorType: "SUPERADMIN",
          action: "DELETE_SUPPLIER",
          resource: "Supplier",
          resourceId: id,
          payload: { name: supplier.name },
        },
      });
    }, { timeout: 45000 });

    return sendSuccess(res, "Supplier deleted successfully");
  } catch (err: any) {
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
        users: { total: totalUsers, verified: 0 },
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
        paymentMethods: salesByPaymentMethod.map((p:any) => ({
            method: p.paymentMethod,
            count: p._count.id,
            revenue: p._sum.totalValue
        })),
        userRoles: usersByGlobalRole.map((r:any) => ({
            role: r.globalRole ?? "NONE",
            count: r._count.id
        })),
      },
      recentCriticalActivity: recentCriticalActions
    };

    // Ensure we are actually returning it
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

import { startWorker, processAndDrain } from "../../../worker/notificationworker";

router.post("/notifications/send", requireRole("SUPERADMIN"), async (req: any, res) => {
  try {
     const isSeverless = !!process.env.VERCEL;

     // Start worker in background for standard server, skip for serverless (we drain later)
     if (!isSeverless) {
        startWorker().catch(e => console.error("Failed to start worker lazily", e));
     }

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
             users = await prisma.user.findMany({
                where: { globalRole: { notIn: ["SUPERADMIN", "ADMIN"] } },
                select: { id: true, email: true }
             });
        } else if (targetRole === 'SUPPLIER') {
             users = await prisma.user.findMany({ 
                where: { globalRole: 'SUPPLIER' }, 
                select: { id: true, email: true, username: true } 
             });
        } else if (targetRole === 'STORE_OWNER') {
             users = await prisma.user.findMany({
                where: { 
                   globalRole: { notIn: ["SUPERADMIN", "ADMIN"] }, // Exclude SUPERADMIN & ADMIN
                   OR: [
                     { globalRole: 'STORE_OWNER' },
                     { stores: { some: { role: 'STORE_OWNER' } } }
                   ]
                },
                select: { id: true, email: true, username: true }
             });
        }
     }

     if (users.length === 0) {
        return res.status(200).json({
            success: false,
            error: "No users found for criteria",
            details: null
        });
     }

     // 2. Send
     const dispatchPromises = users.map(async (u) => {
        const email = decryptEmail(u.email); 
        if ((type === "EMAIL" || type === "BOTH") && email) {
             await sendMail({ to: email, subject, html: message }).catch(e => console.error(`Failed to email ${email}`, e));
        }

        if (type === "SYSTEM" || type === "BOTH") {
             const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

             notificationQueue.add("send-notification", {
                websiteUrl: frontendUrl,
                title: subject,
                message: `Hello ${u.username ? u.username : "Synaps!"} ${message}`,
                buttons: [{ label: `Go to Dashboard`, link: `${frontendUrl}` }]
             });
        }
     });
     
     await Promise.all(dispatchPromises);
     
     // For Serverless: Process queue immediately before exiting
     if (process.env.VERCEL) {
         await processAndDrain();
     }
     
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

export default router;