// middleware/authenticate.ts
import { Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma";
import { verifyJwt } from "../lib/auth";
import { crypto$ } from "../lib/crypto";

/**
 * Augmented authenticate middleware
 *
 * - accepts Authorization: Bearer <token> or cookie token
 * - verifies JWT and fetches user row from DB
 * - decrypts deterministic fields (email, username)
 * - attaches req.user = { id, email, username, globalRole, isActive, raw }
 *
 * NOTE - keep store-scoped role lookups inside storeContext middleware.
 */
export async function authenticate(
  req: Request & { user?: any },
  res: Response,
  next: NextFunction
) {
  try {
    // Accept Bearer token first, then cookie fallback
    const authHeader = req.headers.authorization;
    const cookieToken = (req.cookies && (req.cookies.token as string)) || null;
    let token: string | null = null;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    } else if (cookieToken) {
      token = cookieToken;
    }

    if (!token) {
      return res.status(401).json({ error: "unauthenticated" });
    }

    // verify JWT signature and expiry
    let decoded: any;
    try {
      decoded = verifyJwt(token);
    } catch (err) {
      console.error("authenticate: token verification failed");
      return res.status(401).json({ error: "invalid token" });
    }

    // normalize subject
    const userId = decoded.sub ?? decoded.id ?? null;
    if (!userId) {
      console.warn("authenticate: token missing sub/id claim");
      return res.status(401).json({ error: "unauthenticated" });
    }

    // fetch user row from DB (minimal select)
    const userRow = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        imageUrl: true,
        isActive: true,
        isverified: true,
        globalRole: true,
      },
    });

    if (!userRow) {
      return res.status(401).json({ error: "user not found" });
    }

    if (!userRow.isActive) {
      return res.status(403).json({ error: "user disabled" });
    }

    // decrypt deterministic fields stored in DB (email, username)
    const decrypted = crypto$.decryptObject(userRow, [
      "email",
      "username",
      "imageUrl",
    ]) as any;

    // attach sanitized user object to req for downstream middlewares
    req.user = {
      id: userRow.id,
      email: decrypted.email ?? null,
      username: decrypted.username ?? null,
      imageUrl: decrypted.imageUrl ?? null,
      globalRole: userRow.globalRole ?? null,
      isverified: userRow.isverified ?? false,
      rawTokenClaims: decoded,
    };

    // small debug - avoid printing token or secrets
    console.log("authenticate: user authenticated:", {
      id: req.user.id,
      email: req.user.email,
      username: req.user.username,
      globalRole: req.user.globalRole,
    });

    return next();
  } catch (err: any) {
    console.error("authenticate: unexpected error:", err?.message ?? err);
    return res.status(500).json({ error: "internal_server_error" });
  }
}
