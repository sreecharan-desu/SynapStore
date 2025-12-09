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
      prisma.store.count({ where: { isActive: true } }),
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
      where,
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
