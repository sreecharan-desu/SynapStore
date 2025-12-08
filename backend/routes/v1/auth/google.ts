// src/routes/v1/google.ts
import { Router } from "express";
import { OAuth2Client } from "google-auth-library";
import { z } from "zod";
import { signJwt } from "../../../lib/auth";
import type { Request, Response } from "express";
import prisma from "../../../lib/prisma";
import { crypto$ } from "../../../lib/crypto";

const GoogleRouter = Router();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/* request schema */
const googleSchema = z.object({
  idToken: z.string().min(20, "idToken is required"),
});

function respond(res: Response, status: number, body: object) {
  return res.status(status).json(body);
}

GoogleRouter.post("/", async (req: Request, res: Response) => {
  const parsed = googleSchema.safeParse(req.body);
  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => ({
      path: i.path.join("."),
      message: i.message,
    }));
    return respond(res, 400, { error: "validation failed", details });
  }

  const { idToken } = parsed.data;

  try {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload)
      return respond(res, 400, { error: "invalid id token payload" });

    const email = payload.email;
    const name = payload.name ?? "";
    const picture = payload.picture ?? "";

    if (!email)
      return respond(res, 400, { error: "google account missing email" });

    const encEmail = crypto$.encryptCellDeterministic(email);
    const usernamePlain = name || email.split("@")[0];
    const encUsername = crypto$.encryptCellDeterministic(usernamePlain);
    const encImage = picture ? crypto$.encryptCell(picture) : undefined;

    // upsert user (google-verified => isverified true)
    const userRow = await prisma.user.upsert({
      where: { email: encEmail },
      update: {
        username: encUsername,
        imageUrl: encImage ?? undefined,
        isverified: true,
      },
      create: {
        username: encUsername,
        email: encEmail,
        passwordHash: null,
        imageUrl: encImage ?? undefined,
        isverified: true,
      },
      select: {
        id: true,
        email: true,
        username: true,
        imageUrl: true,
        isverified: true,
        globalRole: true,
      },
    });

    const user = crypto$.decryptObject(userRow, [
      "username",
      "email",
      "imageUrl",
    ]) as any;
    user.globalRole = userRow.globalRole ?? null;

    // find single-store assignment (single-store mode)
    const link = await prisma.userStoreRole.findFirst({
      where: { userId: user.id },
      select: {
        role: true,
        storeId: true,
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

    // suppliers (if mapped)
    const supplierRows = await prisma.supplier.findMany({
      where: { userId: user.id },
      select: { id: true, storeId: true, name: true, isActive: true },
    });

    let effectiveStore: any = null;
    if (link?.store) {
      effectiveStore = { ...link.store, roles: [link.role] };
    } else if (supplierRows.length === 1 && supplierRows[0].storeId) {
      // supplier single-store convenience
      const s = await prisma.store.findUnique({
        where: { id: supplierRows[0].storeId },
        select: {
          id: true,
          name: true,
          slug: true,
          timezone: true,
          currency: true,
          settings: true,
        },
      });
      if (s) effectiveStore = { ...s, roles: ["SUPPLIER"] };
    }

    // sign token (include storeId when available)
    const tokenPayload: Record<string, any> = {
      sub: user.id,
      email: user.email,
      provider: "google",
      globalRole: user.globalRole ?? null,
    };
    if (effectiveStore) tokenPayload.storeId = effectiveStore.id;
    const token = signJwt(tokenPayload);

    // persist activity / audit
    try {
      await prisma.$transaction([
        prisma.activityLog.create({
          data: {
            storeId: effectiveStore?.id ?? undefined,
            userId: user.id,
            action: "auth.google_signin",
            payload: { ip: req.ip, provider: "google" },
          },
        }),
        prisma.auditLog.create({
          data: {
            actorId: user.id,
            actorType: "user",
            storeId: effectiveStore?.id ?? undefined,
            action: "signin_google",
            payload: {
              ip: req.ip,
              userAgent: req.headers["user-agent"] ?? null,
            },
          },
        }),
      ]);
    } catch (e) {
      console.error("google signin: failed to persist logs", e);
    }

    // response: if no store, instruct onboarding
    if (!effectiveStore) {
      return respond(res, 200, {
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          globalRole: user.globalRole ?? null,
        },
        effectiveStore: null,
        needsStoreSetup: true,
        suppliers: supplierRows.map((s) => ({
          id: s.id,
          storeId: s.storeId,
          name: s.name,
          isActive: s.isActive,
        })),
      });
    }

    // normal success with effectiveStore
    return respond(res, 200, {
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        globalRole: user.globalRole ?? null,
      },
      effectiveStore,
      suppliers: supplierRows.map((s) => ({
        id: s.id,
        storeId: s.storeId,
        name: s.name,
        isActive: s.isActive,
      })),
    });
  } catch (err: any) {
    console.error("Google sign-in error:", err?.message ?? err);
    if (
      err?.message?.includes("Token used too late") ||
      err?.message?.includes("invalid")
    ) {
      return respond(res, 400, { error: "invalid id token" });
    }
    return respond(res, 502, {
      error: "failed to verify id token with google",
    });
  }
});

export default GoogleRouter;
