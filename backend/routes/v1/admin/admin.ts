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
      reordersCount,
      uploadsCount,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.store.count({ where: { isActive: true } }),
      prisma.medicine.count(),
      prisma.inventoryBatch.count(),
      prisma.reorder.count(),
      prisma.upload.count(),
    ]);

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

export default router;
