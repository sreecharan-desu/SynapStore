// src/middleware/store.ts

import { Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma";

/**
 * storeContext
 * - Extracts storeId from:
 *    • X-Store-Id header
 *    • ?storeId= query
 *    • req.body.storeId (optional)
 * - Verifies that the authenticated user has access to that store
 * - Attaches: req.store = { id, role, meta }
 *
 * REQUIREMENT:
 * Your auth middleware must set req.user = { id, ... } before this runs.
 */

export async function storeContext(
  req: Request & { user?: any; store?: any },
  res: Response,
  next: NextFunction
) {
  try {
    const storeId =
      (req.headers["x-store-id"] as string) ||
      (req.query.storeId as string) ||
      (req.body?.storeId as string);

    if (!storeId) return next(); // allow unscoped routes

    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: "unauthenticated" });
    }

    // Verify membership
    const roleRow = await prisma.userStoreRole.findFirst({
      where: { userId: req.user.id, storeId },
      select: {
        role: true,
        store: {
          select: {
            id: true,
            name: true,
            slug: true,
            timezone: true,
            currency: true,
          },
        },
      },
    });

    if (!roleRow) {
      return res.status(403).json({ error: "access to store denied" });
    }

    req.store = {
      id: storeId,
      role: roleRow.role,
      meta: roleRow.store,
    };

    return next();
  } catch (err) {
    next(err);
  }
}

/**
 * requireStore
 * - Ensures that storeContext resolved a store.
 */
export function requireStore(
  req: Request & { store?: any },
  res: Response,
  next: NextFunction
) {
  if (!req.store) {
    return res
      .status(400)
      .json({ error: "store not specified or access denied" });
  }
  return next();
}

/**
 * requireRole(...roles)
 * - Restricts route access by role inside the selected store
 *
 * Example:
 * router.post("/update", requireRole("ADMIN", "STORE_OWNER"), handler)
 */

export function requireRole(...allowedRoles: string[]) {
  return (
    req: Request & { store?: any },
    res: Response,
    next: NextFunction
  ) => {
    const role = req.store?.role;
    if (!role) return res.status(403).json({ error: "forbidden" });

    if (!allowedRoles.includes(role)) {
      return res.status(403).json({ error: "insufficient role" });
    }

    return next();
  };
}
