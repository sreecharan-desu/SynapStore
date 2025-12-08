// routes/v1/stores.ts
import { Router } from "express";
import { z } from "zod";
import prisma from "../../../lib/prisma";
import { authenticate } from "../../../middleware/authenticate";
import { requireRole } from "../../../middleware/requireRole";
import { crypto$ } from "../../../lib/crypto";

const StoreRouter = Router();

const respond = (res: any, status: number, body: object) =>
  res.status(status).json(body);

/* Schemas */
const createStoreSchema = z.object({
  name: z.string().min(2),
  slug: z.string().optional(),
  timezone: z.string().optional(),
  currency: z.string().optional(),
  settings: z.any().optional(),
});

const patchStoreSchema = z.object({
  name: z.string().min(2).optional(),
  slug: z.string().optional(),
  timezone: z.string().optional(),
  currency: z.string().optional(),
  settings: z.any().optional(),
});

/* Routes */

// GET /v1/stores/my - list stores current user belongs to
StoreRouter.get("/my", authenticate, async (req: any, res) => {
  try {
    const userId = req.user?.id;
    if (!userId)
      return respond(res, 401, { success: false, error: "unauthenticated" });

    const rows = await prisma.userStoreRole.findMany({
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

    const stores = rows.map((r) => ({
      id: r.store.id,
      name: r.store.name,
      slug: r.store.slug,
      timezone: r.store.timezone,
      currency: r.store.currency,
      settings: r.store.settings ?? null,
      roles: [r.role],
    }));

    return respond(res, 200, { success: true, data: stores });
  } catch (err) {
    console.error("GET /stores/my error:", err);
    return respond(res, 500, {
      success: false,
      error: "internal_server_error",
    });
  }
});

// POST /v1/stores - create store (SUPERADMIN only)
StoreRouter.post(
  "/",
  authenticate,
  requireRole("SUPERADMIN"),
  async (req: any, res) => {
    try {
      const parsed = createStoreSchema.safeParse(req.body);
      if (!parsed.success) {
        return respond(res, 400, {
          success: false,
          error: "validation_failed",
          details: parsed.error.issues,
        });
      }
      const { name, slug, timezone, currency, settings } = parsed.data;

      // slug uniqueness check
      if (slug) {
        const exists = await prisma.store.findUnique({ where: { slug } });
        if (exists)
          return respond(res, 409, { success: false, error: "slug_conflict" });
      }

      const store: any = await prisma.store.create({
        data: {
          name,
          // @ts-ignore
          slug: slug ?? undefined,
          timezone: timezone ?? undefined,
          currency: currency ?? undefined,
          settings: settings ?? undefined,
        },
      });

      return respond(res, 201, { success: true, data: store });
    } catch (err: any) {
      console.error("POST /stores error:", err);
      if (err?.code === "P2002")
        return respond(res, 409, { success: false, error: "slug_conflict" });
      return respond(res, 500, {
        success: false,
        error: "internal_server_error",
      });
    }
  }
);

// GET /v1/stores/:id - get store (requires membership or SUPERADMIN)
StoreRouter.get("/:id", authenticate, async (req: any, res) => {
  try {
    const storeId = String(req.params.id);
    const userId = req.user?.id;
    if (!userId)
      return respond(res, 401, { success: false, error: "unauthenticated" });

    // allow SUPERADMIN via requireRole not used here - check membership
    const membership = await prisma.userStoreRole.findFirst({
      where: { userId, storeId },
    });
    const isSuper = req.user?.globalRole === "SUPERADMIN";
    if (!membership && !isSuper)
      return respond(res, 403, { success: false, error: "forbidden" });

    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: {
        id: true,
        name: true,
        slug: true,
        timezone: true,
        currency: true,
        settings: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!store)
      return respond(res, 404, { success: false, error: "store_not_found" });
    return respond(res, 200, { success: true, data: store });
  } catch (err) {
    console.error("GET /stores/:id error:", err);
    return respond(res, 500, {
      success: false,
      error: "internal_server_error",
    });
  }
});

// PATCH /v1/stores/:id - update store (OWNER/ADMIN/SUPERADMIN)
StoreRouter.patch("/:id", authenticate, async (req: any, res) => {
  try {
    const parsed = patchStoreSchema.safeParse(req.body);
    if (!parsed.success)
      return respond(res, 400, {
        success: false,
        error: "validation_failed",
        details: parsed.error.issues,
      });

    const storeId = String(req.params.id);
    const userId = req.user?.id;

    // check role
    const isSuper = req.user?.globalRole === "SUPERADMIN";
    const roleRow = await prisma.userStoreRole.findFirst({
      where: { userId, storeId },
    });
    const allowedRoles = ["STORE_OWNER", "ADMIN"];
    const ok = isSuper || (roleRow && allowedRoles.includes(roleRow.role));
    if (!ok)
      return respond(res, 403, { success: false, error: "insufficient_role" });

    const updated = await prisma.store.update({
      where: { id: storeId },
      data: parsed.data,
    });
    return respond(res, 200, { success: true, data: updated });
  } catch (err: any) {
    console.error("PATCH /stores/:id error:", err);
    if (err?.code === "P2025")
      return respond(res, 404, { success: false, error: "store_not_found" });
    return respond(res, 500, {
      success: false,
      error: "internal_server_error",
    });
  }
});

// DELETE /v1/stores/:id - soft delete (SUPERADMIN)
StoreRouter.delete(
  "/:id",
  authenticate,
  requireRole("SUPERADMIN"),
  async (req: any, res) => {
    try {
      const storeId = String(req.params.id);
      const soft = await prisma.store.update({
        where: { id: storeId },
        data: { isActive: false },
      });
      return respond(res, 200, { success: true, data: soft });
    } catch (err: any) {
      console.error("DELETE /stores/:id error:", err);
      if (err?.code === "P2025")
        return respond(res, 404, { success: false, error: "store_not_found" });
      return respond(res, 500, {
        success: false,
        error: "internal_server_error",
      });
    }
  }
);

export default StoreRouter;
