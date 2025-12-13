// middleware/store.ts
import { Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma";
import type { Role, Store } from "@prisma/client";

export type RequestWithUser = Request & {
  user?: {
    username: string;
    id: string;
    email?: string;
    globalRole?: Role | null;
  };
  store?: Partial<Store> | null | any;
  userStoreRoles?: Role[];
};

/**
 * storeContext (single-store mode)
 *
 * - user must have exactly one store assigned
 * - fetches store + roles
 * - attaches to req.store and req.userStoreRoles
 * - if user has no store -> needs onboarding
 */
export async function storeContext(
  req: RequestWithUser,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "unauthenticated" });

    // find single store assignment (default)
    let link = await prisma.userStoreRole.findFirst({
      where: { userId },
      select: {
        storeId: true,
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

    // Check header Override
    const headerStoreId = req.headers["x-store-id"];
    if (headerStoreId && typeof headerStoreId === "string") {
       const specificLink = await prisma.userStoreRole.findFirst({
        where: { userId, storeId: headerStoreId },
        select: {
          storeId: true,
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
      if (specificLink) link = specificLink;
    }

    // no store assigned -> user must create one -- UNLESS they are a SUPPLIER/SUPERADMIN
    if (!link) {
      if (req.user?.globalRole === "SUPPLIER" || req.user?.globalRole === "SUPERADMIN") {
        req.store = null;
        req.userStoreRoles = [];
        return next(); // allow proceed without store
      }
      req.store = null;
      req.userStoreRoles = [];
      return res.status(403).json({
        error: "no_store_found",
        needsStoreSetup: true,
      });
    }

    req.store = link.store;
    req.userStoreRoles = [link.role]; // single role per store

    return next();
  } catch (err) {
    console.error("storeContext error:", err);
    return next(err);
  }
}

/**
 * requireStore - ensures storeContext resolved a store
 */
export function requireStore(
  req: RequestWithUser,
  res: Response,
  next: NextFunction
) {
  if (!req.store) {
    return res.status(403).json({
      error: "no_store_found",
      needsStoreSetup: true,
    });
  }
  return next();
}
