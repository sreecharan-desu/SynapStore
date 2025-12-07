import { Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma";
import type { Role, Store } from "@prisma/client";

/**
 * Augmented request types used by these middlewares
 */
export type RequestWithUser = Request & {
  user?: {
    id: string;
    email?: string;
    username?: string;
    globalRole?: Role | null;
  };
  store?: Partial<Store> | null;
  userStoreRoles?: Role[]; // roles the user has for the active store
};

/**
 * Read storeId from common places (header first, then body/query)
 */
function resolveStoreId(req: Request): string | null {
  const hdr = req.header("x-store-id");
  if (hdr && typeof hdr === "string" && hdr.trim() !== "") return hdr;
  if (req.body && req.body.storeId) return String(req.body.storeId);
  if (req.query && req.query.storeId) return String(req.query.storeId);
  return null;
}

/**
 * storeContext middleware
 *
 * - requires authenticate() to have run earlier to populate req.user.id
 * - resolves the Store and the user's role(s) for that store
 * - attaches req.store and req.userStoreRoles
 */
export async function storeContext(
  req: RequestWithUser,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "unauthenticated" });

    const storeId = resolveStoreId(req);
    if (!storeId) {
      return res.status(400).json({
        error: "store id required (x-store-id header or storeId param)",
      });
    }

    // fetch store minimally
    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: {
        id: true,
        name: true,
        slug: true,
        timezone: true,
        currency: true,
        settings: true,
      },
    });

    if (!store) {
      // do not attach anything - allow requireStore to surface 404
      return res.status(404).json({ error: "store not found" });
    }

    // fetch user roles for this store (a user should normally have one role per store)
    const roleRows = await prisma.userStoreRole.findMany({
      where: { userId, storeId },
      select: { role: true },
    });

    const roles: Role[] = roleRows.map((r) => r.role);

    // attach to request for downstream handlers
    req.store = store;
    req.userStoreRoles = roles;

    return next();
  } catch (err) {
    console.error("storeContext error:", err);
    return next(err);
  }
}

/**
 * requireStore - lightweight guard that ensures req.store is present
 * Useful when storeContext is optional in a chain and you want to enforce it for a route
 */
export function requireStore(
  req: RequestWithUser,
  res: Response,
  next: NextFunction
) {
  if (!req.store) {
    return res.status(404).json({ error: "store not resolved" });
  }
  return next();
}
