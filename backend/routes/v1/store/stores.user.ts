// routes/v1/stores.users.ts
import { Router } from "express";
import { z } from "zod";
import prisma from "../../../lib/prisma";
import { authenticate } from "../../../middleware/authenticate";
import { storeContext, requireStore } from "../../../middleware/store";
import { requireRole } from "../../../middleware/requireRole";
import { crypto$ } from "../../../lib/crypto";
import { generateOtp, getOtpExpiryDate } from "../../../lib/otp";
import { sendOtpEmail } from "../../../lib/mailer";
import { hashPassword } from "../../../lib/auth";

const UserStoreRouter = Router({ mergeParams: true });
const respond = (res: any, status: number, body: object) =>
  res.status(status).json(body);

// const inviteSchema = z.object({
//   email: z.string().email(),
//   role: z.nativeEnum(require("../../prisma/schema").Role as any).optional(), // fallback - will validate below
// });

// For simplicity - allowable role strings
const ROLE_SET = [
  "STORE_OWNER",
  "ADMIN",
  "MANAGER",
  "STAFF",
  "READ_ONLY",
  "SUPPLIER",
];

/**
 * POST /v1/stores/:id/users/invite
 * - Allowed roles: STORE_OWNER, ADMIN, SUPERADMIN
 * - if user doesn't exist: create user row with no password and send OTP invite
 * - if exists but not member: create UserStoreRole
 */
UserStoreRouter.post(
  "/:id/users/invite",
  authenticate,
  storeContext,
  requireStore,
  requireRole(["STORE_OWNER", "ADMIN"]),
  async (req: any, res) => {
    try {
      const parsed = z
        .object({ email: z.string().email(), role: z.string().optional() })
        .safeParse(req.body);
      if (!parsed.success)
        return respond(res, 400, {
          success: false,
          error: "validation_failed",
          details: parsed.error.issues,
        });

      const storeId = String(req.params.id);
      const { email, role } = parsed.data;
      const assignedRole =
        role && ROLE_SET.includes(role) ? (role as any) : "STAFF";

      // find or create user
      const encEmail = crypto$.encryptCellDeterministic(email);
      let user = await prisma.user.findUnique({
        where: { email: encEmail },
        select: { id: true, email: true, username: true, isActive: true },
      });

      if (!user) {
        // create a user stub with no password and send invite OTP
        const username = email.split("@")[0];
        const encUsername = crypto$.encryptCellDeterministic(username);
        const user = await prisma.user.create({
          data: { username: encUsername, email: encEmail, isverified: false },
          select: { id: true, email: true, username: true },
        });

        // create OTP and send invite email
        const otp = generateOtp();
        const expiresAt = getOtpExpiryDate();
        const encPhone = crypto$.encryptCellDeterministic(email);
        const encOtp = crypto$.encryptCell(otp);

        await prisma.otp.create({
          data: {
            userId: user.id,
            phone: encPhone,
            otpHash: encOtp,
            expiresAt,
            used: false,
            salt: await hashPassword(otp), // store salt for reference
          },
        });

        await sendOtpEmail(email, otp);
      }

      if (user && !user.isActive) {
        try {
          await prisma.userStoreRole.create({
            data: { userId: user.id, storeId, role: assignedRole as any },
          });
        } catch (pErr: any) {
          if (pErr?.code === "P2002") {
            return respond(res, 409, {
              success: false,
              error: "user_already_member",
            });
          }
          throw pErr;
        }

        return respond(res, 201, {
          success: true,
          data: { userId: user.id, inviteSent: true },
        });
      } else {
        // active user - just add membership
        try {
          await prisma.userStoreRole.create({
            data: { userId: user!.id, storeId, role: assignedRole as any },
          });
        } catch (pErr: any) {
          if (pErr?.code === "P2002") {
            return respond(res, 409, {
              success: false,
              error: "user_already_member",
            });
          }
          throw pErr;
        }

        return respond(res, 201, {
          success: true,
          data: { userId: user!.id, inviteSent: false },
        });
      }
    } catch (err) {
      console.error("POST /stores/:id/users/invite error:", err);
      return respond(res, 500, {
        success: false,
        error: "internal_server_error",
      });
    }
  }
);

/**
 * GET /v1/stores/:id/users
 * Allowed roles: STORE_OWNER, ADMIN, MANAGER, SUPERADMIN
 */
UserStoreRouter.get(
  "/:id/users",
  authenticate,
  storeContext,
  requireStore,
  requireRole(["STORE_OWNER", "ADMIN", "MANAGER"]),
  async (req: any, res) => {
    try {
      const storeId = String(req.params.id);
      const rows = await prisma.userStoreRole.findMany({
        where: { storeId },
        select: {
          id: true,
          role: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              username: true,
              email: true,
              imageUrl: true,
              isActive: true,
            },
          },
        },
      });

      const users = rows.map((r) => ({
        id: r.user.id,
        username: r.user.username,
        email: r.user.email,
        imageUrl: r.user.imageUrl ?? null,
        role: r.role,
        addedAt: r.createdAt,
      }));

      return respond(res, 200, { success: true, data: users });
    } catch (err) {
      console.error("GET /stores/:id/users error:", err);
      return respond(res, 500, {
        success: false,
        error: "internal_server_error",
      });
    }
  }
);

/**
 * PATCH /v1/stores/:id/users/:userId/role
 * Allowed roles: STORE_OWNER, ADMIN, SUPERADMIN
 */
UserStoreRouter.patch(
  "/:id/users/:userId/role",
  authenticate,
  storeContext,
  requireStore,
  requireRole(["STORE_OWNER", "ADMIN"]),
  async (req: any, res) => {
    try {
      const storeId = String(req.params.id);
      const userId = String(req.params.userId);
      const parsed = z.object({ role: z.string() }).safeParse(req.body);
      if (!parsed.success)
        return respond(res, 400, {
          success: false,
          error: "validation_failed",
          details: parsed.error.issues,
        });
      const { role } = parsed.data;
      if (!ROLE_SET.includes(role))
        return respond(res, 400, { success: false, error: "invalid_role" });

      const updated = await prisma.userStoreRole.updateMany({
        where: { userId, storeId },
        data: { role: role as any },
      });

      if (updated.count === 0)
        return respond(res, 404, {
          success: false,
          error: "membership_not_found",
        });

      return respond(res, 200, { success: true });
    } catch (err) {
      console.error("PATCH /stores/:id/users/:userId/role error:", err);
      return respond(res, 500, {
        success: false,
        error: "internal_server_error",
      });
    }
  }
);

/**
 * DELETE /v1/stores/:id/users/:userId
 * Allowed: STORE_OWNER, ADMIN
 * Implementation: soft remove membership (delete UserStoreRole)
 */
UserStoreRouter.delete(
  "/:id/users/:userId",
  authenticate,
  storeContext,
  requireStore,
  requireRole(["STORE_OWNER", "ADMIN"]),
  async (req: any, res) => {
    try {
      const storeId = String(req.params.id);
      const userId = String(req.params.userId);
      // delete membership
      await prisma.userStoreRole.deleteMany({ where: { userId, storeId } });
      return respond(res, 200, { success: true });
    } catch (err) {
      console.error("DELETE /stores/:id/users/:userId error:", err);
      return respond(res, 500, {
        success: false,
        error: "internal_server_error",
      });
    }
  }
);

export default UserStoreRouter;
