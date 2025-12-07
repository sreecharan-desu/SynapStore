import { Request, Response, NextFunction } from "express";
import type { Role } from "@prisma/client";

/**
 * Request type expected by this guard
 */
type Req = Request & {
  user?: { id: string; globalRole?: Role | null };
  userStoreRoles?: Role[];
};

/**
 * requireRole - middleware factory
 *
 * - allowed: string | string[] of Role values (from Prisma enum)
 * - SUPERADMIN bypass: if req.user.globalRole === "SUPERADMIN" the check passes
 *
 * Example usage:
 *   router.post("/", authenticate, storeContext, requireRole(["ADMIN","STORE_OWNER"]), handler)
 */
export function requireRole(allowed: Role | Role[]) {
  const allowedArr = Array.isArray(allowed) ? allowed : [allowed];

  return (req: Req, res: Response, next: NextFunction) => {
    try {
      // global SUPERADMIN bypass
      if (req.user?.globalRole === "SUPERADMIN") return next();

      const storeRoles = req.userStoreRoles ?? [];

      // if no store roles and allowed includes SUPPLIER but user has global SUPPLIER, allow
      if (storeRoles.length === 0) {
        if (req.user?.globalRole && allowedArr.includes(req.user.globalRole)) {
          return next();
        }
        return res.status(403).json({ error: "insufficient role" });
      }

      // check for any intersection
      const ok = storeRoles.some((r) => allowedArr.includes(r));
      if (!ok) return res.status(403).json({ error: "insufficient role" });

      return next();
    } catch (err) {
      console.error("requireRole error:", err);
      return res.status(500).json({ error: "internal_server_error" });
    }
  };
}
