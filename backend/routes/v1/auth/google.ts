// src/routes/v1/google.ts
import { Router } from "express";
import { OAuth2Client } from "google-auth-library";
import { z } from "zod";
import { signJwt } from "../../../lib/auth";
import type { Request, Response } from "express";
import prisma from "../../../lib/prisma";
import { crypto$ } from "../../../lib/crypto";

import { sendSuccess, sendError, handleZodError, handlePrismaError, sendInternalError } from "../../../lib/api";

const GoogleRouter = Router();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const googleSchema = z.object({
  idToken: z.string().min(20, "idToken is required"),
});

// Helper respond removed, using standard helpers from lib/api

// Block google signin for these global roles
const RESTRICTED_GOOGLE_ROLES = ["SUPERADMIN", "SUPERADMIN"];

/**
 * POST /v1/oauth/google
 * Description: Authenticates a user using a Google ID token.
 * Headers: None
 * Body:
 *  - idToken: string (min 20 chars)
 * Responses:
 *  - 200: { token, user: { ... }, effectiveStore: { ... } | null, suppliers: [...] }
 *  - 400: Validation failed or invalid ID token
 *  - 403: Account suspended or restricted role
 *  - 502: Failed to verify with Google
 */


GoogleRouter.post("/", async (req: Request, res: Response) => {
  const parsed = googleSchema.safeParse(req.body);
  if (!parsed.success) {
    return handleZodError(res, parsed.error);
  }

  const { idToken } = parsed.data;

  try {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload:any = ticket.getPayload();
    if (!payload)
      return sendError(res, "Invalid ID token payload", 400);

    const email = payload.email.trim().toLowerCase();
    const name = payload.name ?? "";
    const picture = payload.picture ?? "";

    if (!email)
      return sendError(res, "Google account missing email address", 400);

    const encEmail = crypto$.encryptCellDeterministic(email);
    const usernamePlain = name || email.split("@")[0];
    
    // 1. Try Find Existing User (Encrypted OR Raw)
    let userRow = await prisma.user.findUnique({ 
        where: { email: encEmail },
        select: { id: true, globalRole: true, isActive: true, username: true, email: true, imageUrl: true, isverified: true } 
    });

    if (!userRow) {
        // Fallback: search by raw email
        userRow = await prisma.user.findUnique({ 
            where: { email: email },
            select: { id: true, globalRole: true, isActive: true, username: true, email: true, imageUrl: true, isverified: true } 
        });
    }

    // Check Restricted Roles
    if (
      userRow?.globalRole &&
      RESTRICTED_GOOGLE_ROLES.includes(userRow.globalRole)
    ) {
      return sendError(res, "Google login not allowed for this account", 403);
    }

    if (userRow) {
        // UPDATE Existing
        userRow = await prisma.user.update({
            where: { id: userRow.id },
            data: {
                imageUrl: picture || null, // Update profile pic
                isverified: true,          // verify email
            },
            select: { 
                id: true, email: true, username: true, imageUrl: true, isverified: true, globalRole: true, isActive: true 
            }
        });
    } else {
        // CREATE New
        try {
            userRow = await prisma.user.create({
                data: {
                    username: usernamePlain, // raw, middleware encrypts
                    email: email,            // raw, middleware encrypts
                    passwordHash: null,
                    imageUrl: picture || null,
                    isverified: true,
                    globalRole: "READ_ONLY", // Only for new users
                },
                select: { 
                    id: true, email: true, username: true, imageUrl: true, isverified: true, globalRole: true, isActive: true 
                }
            });
        } catch (e: any) {
            // Handle Username Collision
            if (e.code === 'P2002') {
                 console.log("[GoogleAuth] Username collision. Attempting to create with suffix.");
                 const randomSuffix = Math.floor(Math.random() * 10000);
                 const uniqueUsername = `${usernamePlain}${randomSuffix}`; 
                 
                 userRow = await prisma.user.create({
                    data: {
                      username: uniqueUsername,
                      email: email,
                      passwordHash: null,
                      imageUrl: picture || null,
                      isverified: true,
                      globalRole: "STORE_OWNER",
                    },
                    select: { 
                        id: true, email: true, username: true, imageUrl: true, isverified: true, globalRole: true, isActive: true 
                    }
                 });
            } else {
              return handlePrismaError(res, e, "User");
            }
        }
    }

    if (!userRow.isActive) {
      return sendError(res, "This account has been temporarily disabled/suspended", 403, { code: "user_not_active" });
    }

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
      storeId: effectiveStore ? effectiveStore.id : "",
      supplierId: supplierRows.length > 0 ? supplierRows[0].id : ""
    };
    const token = signJwt(tokenPayload);

    // persist activity / audit
    // persist activity / audit
    try {
      await prisma.$transaction(async (tx) => {
        await tx.auditLog.create({
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
        });

        // Only create ActivityLog if we have a valid store, as storeId is required by schema
        if (effectiveStore?.id) {
          await tx.activityLog.create({
            data: {
              storeId: effectiveStore.id,
              userId: user.id,
              action: "auth.google_signin",
              payload: { ip: req.ip, provider: "google" },
            },
          });
        }
      }, { timeout: 10000 });
    } catch (e) {
      console.error("google signin: failed to persist logs", e);
    }

    const responseData: any = {
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        globalRole: user.globalRole ?? null,
      },
      effectiveStore: effectiveStore ?? null,
      needsStoreSetup: !effectiveStore && user.globalRole !== "SUPPLIER",
      supplier: supplierRows[0] ?? null,
      suppliers: supplierRows.map((s) => ({
        id: s.id,
        storeId: s.storeId,
        name: s.name,
        isActive: s.isActive,
      })),
      role_data: {
             role: user.globalRole === 'SUPERADMIN' ? 'SUPER_ADMIN' : (user.globalRole || "READ_ONLY"),
             user_id: user.id,
             store_id: null,
             supplier_id: null
      }
    };
    
    if (link && link.store && link.role === 'STORE_OWNER') {
        responseData.role_data.store_id = link.store.id;
    }
    if (supplierRows.length > 0) {
        responseData.role_data.supplier_id = supplierRows[0].id;
    }

    return sendSuccess(res, "Google authentication successful", responseData);

  } catch (err: any) {
    console.error("Google sign-in error:", err?.message ?? err);
    if (
      err?.message?.includes("Token used too late") ||
      err?.message?.includes("invalid")
    ) {
      return sendError(res, "Invalid or expired Google ID token", 400);
    }
    return sendInternalError(res, err, "Failed to verify ID token with Google");
  }
});

export default GoogleRouter;
