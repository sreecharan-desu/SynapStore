// middleware/authenticate.ts
import { Request, Response, NextFunction } from "express";
import { verifyJwt } from "../lib/auth";

export function authenticate(
  req: Request & { user?: any },
  res: Response,
  next: NextFunction
) {
  try {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith("Bearer ")) {
      return res.status(401).json({ error: "unauthenticated" });
    }

    const token = auth.split(" ")[1];
    const decoded = verifyJwt(token) as any;

    // Normalise token claims to req.user for downstream code
    // - your signJwt uses { sub: user.id, email }, so map sub -> id
    req.user = {
      id: decoded.sub ?? decoded.id ?? null,
      email: decoded.email ?? null,
      roles: decoded.roles ?? null,
      provider: decoded.provider ?? null,
      raw: decoded,
    };

    // quick guard - ensure we have an id
    if (!req.user.id) {
      console.warn("authenticate: token missing sub/id claim", decoded);
      return res.status(401).json({ error: "unauthenticated" });
    }

    // Useful debug
    console.log("authenticate: req.user =", {
      id: req.user.id,
      email: req.user.email,
      provider: req.user.provider,
    });

    return next();
  } catch (err: any) {
    console.error("authenticate - verify failed:", err?.message ?? err);
    return res.status(401).json({ error: "invalid token" });
  }
}
