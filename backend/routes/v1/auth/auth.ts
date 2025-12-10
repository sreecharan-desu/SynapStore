// routes/v1/auth.ts
import { Router } from "express";
import { generateOtp, getOtpExpiryDate } from "../../../lib/otp";
import { sendOtpEmail } from "../../../lib/mailer";
import { hashPassword, comparePassword, signJwt } from "../../../lib/auth";
import { z } from "zod";
import prisma from "../../../lib/prisma";
import type { Request, Response } from "express";
import { crypto$ } from "../../../lib/crypto";
import rateLimiter from "../../../middleware/ratelimitter";

const router = Router();

// encrypted fields stored with crypto$.encryptCell / encryptCellDeterministic
const ENCRYPTED_FIELDS = ["username", "email", "imageUrl"];

/* Schemas */
const registerSchema = z.object({
  username: z.string().min(3, "username must be at least 3 characters"),
  email: z.string().email("invalid email"),
  password: z.string().min(6, "password must be at least 6 characters"),
});

const resendSchema = z.object({
  email: z.string().email("invalid email"),
});

const signinSchema = z.object({
  email: z.string().email("invalid email"),
  password: z.string().min(6, "password must be at least 6 characters"),
});

const verifyOtpSchema = z.object({
  email: z.string().email("invalid email"),
  otp: z.string().min(4, "otp too short"),
});

/* Helpers */
type ErrorResponse = { error: string; code?: string; details?: any[] };
const respond = (res: Response, status: number, body: object) =>
  res.status(status).json(body);

const zodDetails = (err: any) =>
  err?.issues?.map((i: any) => ({
    path: i.path.join("."),
    message: i.message,
  })) ?? [];

/**
 - findUserByEmail
 - uses deterministic encryption for lookup, returns decrypted fields
 - keeps passwordHash property intact (not decrypted)
*/
async function findUserByEmail(email: string) {
  // Try finding by deterministic encryption (legacy/if extension is off)
  const enc = crypto$.encryptCellDeterministic(email);
  let row = await prisma.user.findUnique({
    where: { email: enc },
    select: {
      id: true,
      email: true,
      username: true,
      imageUrl: true,
      passwordHash: true,
      phone: true,
      isActive: true,
      isverified: true,
      createdAt: true,
      updatedAt: true,
      globalRole: true,
    },
  });

  // If not found, try finding by raw email (if extension is on/transparent or field is plaintext)
  if (!row) {
     row = await prisma.user.findUnique({
      where: { email }, // Prisma extension *might* encrypt this under the hood if active
      select: {
        id: true,
        email: true,
        username: true,
        imageUrl: true,
        passwordHash: true,
        phone: true,
        isActive: true,
        isverified: true,
        createdAt: true,
        updatedAt: true,
        globalRole: true,
      },
    });
  }

  if (!row) return null;

  // Manual decryption attempt on fields if they look encrypted (doesn't hurt if already plaintext)
  // Use safeDecryptCell which returns original value if decrypt fails
  const decrypted: any = { ...row };
  decrypted.email = crypto$.safeDecryptCell(row.email);
  decrypted.username = crypto$.safeDecryptCell(row.username);
  decrypted.imageUrl = crypto$.safeDecryptCell(row.imageUrl);
  
  // Double check: if input email matches decrypted email, we found the right user
  if (decrypted.email !== email) {
    // Edge case: Hash collision or wrong user found? 
    // Usually harmless if unique constraint holds, but ensuring safety.
    return null;
  }

  return decrypted;
}

/* Rate limiters (in-memory) */
const registerLimiter = rateLimiter({
  keyPrefix: "register-ip",
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.ip ?? null,
});

const resendLimiter = rateLimiter({
  keyPrefix: "resend-email",
  windowMs: 60 * 1000,
  max: 1,
  burstWindowMs: 60 * 60 * 1000,
  burstMax: 5,
  keyGenerator: (req) =>
    req.body?.email ? String(req.body.email).toLowerCase() : req.ip ?? null,
});

const signinIpLimiter = rateLimiter({
  keyPrefix: "signin-ip",
  windowMs: 60 * 1000,
  max: 20,
  keyGenerator: (req) => req.ip ?? null,
});

const signinEmailLimiter = rateLimiter({
  keyPrefix: "signin-email",
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: (req) =>
    req.body?.email ? String(req.body.email).toLowerCase() : null,
});

const verifyLimiter = rateLimiter({
  keyPrefix: "verify-email",
  windowMs: 60 * 1000,
  max: 5,
  keyGenerator: (req) =>
    req.body?.email ? String(req.body.email).toLowerCase() : req.ip ?? null,
});

/* Helpers - OTP model interaction
 - We store email OTPs in Otp.phone deterministically encrypted so lookups work.
 - otpHash is stored via crypto$.encryptCell (symmetric) so we can decrypt and compare.
*/
async function createOtpForUser(
  userId: string | null,
  email: string,
  otpPlain: string,
  expiresAt: Date
) {
  // deterministic encryption for phone (email) so we can query by it
  const encPhone = crypto$.encryptCellDeterministic(email);
  const encOtp = crypto$.encryptCell(otpPlain);
  const otpRow = await prisma.otp.create({
    data: {
      userId: userId ?? undefined,
      storeId: undefined,
      phone: encPhone,
      otpHash: encOtp,
      salt: "",
      expiresAt,
      used: false,
      attempts: 0,
    },
  });
  return otpRow;
}

/* Routes */

/* Register */
router.post(
  "/register",
  registerLimiter,
  async (req: Request, res: Response, next) => {
    try {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        return respond(res, 400, {
          error: "validation failed",
          details: zodDetails(parsed.error),
        } as ErrorResponse);
      }
      const { username, email, password } = parsed.data;

      // check duplicates via deterministic encryption lookups
      const existingEmail = await findUserByEmail(email);
      if (existingEmail) {
        return respond(res, 409, {
          error: "user already exists",
          code: "user_exists",
        });
      }

      // check username duplicate (deterministic)
      const encUsername = crypto$.encryptCellDeterministic(username);
      const existingUsernameRow = await prisma.user.findUnique({
        where: { username: encUsername },
        select: { id: true },
      });
      if (existingUsernameRow) {
        return respond(res, 409, {
          error: "user already exists",
          code: "user_exists",
        });
      }

      // prepare data
      const hashed = await hashPassword(password);
      const encEmail = crypto$.encryptCellDeterministic(email);

      // create user (password stored hashed, not encrypted)
      let userRow;
      try {
        userRow = await prisma.user.create({
          data: {
            username: encUsername,
            email: encEmail,
            passwordHash: hashed,
            globalRole: "STORE_OWNER"
            // isverified defaults to false per schema
          },
          select: { id: true, username: true, email: true },
        });
      } catch (pErr: any) {
        console.error("Prisma create user error:", pErr);
        if (pErr?.code === "P2002") {
          return respond(res, 409, {
            error: "user already exists",
            code: "user_exists",
          });
        }
        return respond(res, 502, { error: "database error creating user" });
      }

      // generate and store OTP (in Otp table)
      const otp = generateOtp();
      const otpExpiry = getOtpExpiryDate();

      try {
        await createOtpForUser(userRow.id, email, otp, otpExpiry);
      } catch (pErr: any) {
        console.error("Prisma create OTP error:", pErr);
        return respond(res, 502, { error: "database error storing otp" });
      }

      // send OTP to plaintext email provided by client
      try {
        await sendOtpEmail(email, otp);
      } catch (mailErr: any) {
        console.error("Failed to send OTP email:", mailErr);
        try {
          // mark unused OTPs for this contact as used to avoid lingering OTPs
          const encPhone = crypto$.encryptCellDeterministic(email);
          await prisma.otp.updateMany({
            where: { phone: encPhone, used: false },
            data: { used: true },
          });
        } catch (clearErr) {
          console.error(
            "Failed to mark OTP used after mail failure:",
            clearErr
          );
        }
        return respond(res, 502, {
          error: "failed to send verification email, please try again later",
        });
      }

      // Prisma extension automatically decrypts fields
      return respond(res, 201, {
        message: "registered - otp sent",
        user: {
          id: userRow.id,
          username: userRow.username,
          email: userRow.email,
        },
      });
    } catch (err: any) {
      console.error("Register handler error:", err);
      if (err?.name === "ZodError") {
        return respond(res, 400, {
          error: "validation failed",
          details: err.errors,
        });
      }
      next(err);
    }
  }
);

/* Resend OTP */
router.post(
  "/resend-otp",
  resendLimiter,
  async (req: Request, res: Response, next) => {
    try {
      const parsed = resendSchema.safeParse(req.body);
      if (!parsed.success) {
        return respond(res, 400, {
          error: "validation failed",
          details: zodDetails(parsed.error),
        } as ErrorResponse);
      }
      const { email } = parsed.data;

      const user = await findUserByEmail(email);
      if (!user) return respond(res, 404, { error: "user not found" });
      if (user.isverified) {
        return respond(res, 400, {
          error: "email already verified",
          code: "email_already_verified",
        });
      }
      // Strict server-side rate limit per email:
      // allow only one unused OTP created per 60 seconds.
      const encPhone = crypto$.encryptCellDeterministic(email);
      const latestOtp = await prisma.otp.findFirst({
        where: {
          phone: encPhone,
          used: false,
        },
        orderBy: { createdAt: "desc" as const },
        select: { id: true, createdAt: true },
      });

      const MIN_SECONDS = 60;
      if (latestOtp && latestOtp.createdAt) {
        const ageSeconds = Math.floor(
          (Date.now() - new Date(latestOtp.createdAt).getTime()) / 1000
        );
        if (ageSeconds < MIN_SECONDS) {
          const retryAfter = MIN_SECONDS - ageSeconds;
          res.setHeader("Retry-After", String(retryAfter));
          return respond(res, 429, {
            error: "too many requests",
            code: "otp_rate_limited",
            message: `please wait ${retryAfter} second(s) before requesting another OTP`,
          });
        }
      }

      const otp = generateOtp();
      const otpExpiry = getOtpExpiryDate();

      try {
        await createOtpForUser(user.id, email, otp, otpExpiry);
      } catch (pErr: any) {
        console.error("Prisma create OTP error:", pErr);
        return respond(res, 502, { error: "failed to create otp" });
      }

      try {
        await sendOtpEmail(email, otp);
      } catch (mailErr: any) {
        console.error("Failed to send resend OTP email:", mailErr);
        try {
          await prisma.otp.updateMany({
            where: { phone: encPhone, used: false },
            data: { used: true },
          });
        } catch (clearErr) {
          console.error(
            "Failed to mark OTP used after mail failure:",
            clearErr
          );
        }
        return respond(res, 502, {
          error: "failed to send verification email, please try again later",
        });
      }

      return respond(res, 200, { message: "otp resent" });
    } catch (err: any) {
      console.error("Resend OTP error:", err);
      if (err?.name === "ZodError")
        return respond(res, 400, {
          error: "validation failed",
          details: err.errors,
        });
      next(err);
    }
  }
);

/* Signin */
router.post(
  "/signin",
  signinIpLimiter,
  signinEmailLimiter,
  async (req: Request, res: Response, next) => {
    try {
      const parsed = signinSchema.safeParse(req.body);
      if (!parsed.success) {
        return respond(res, 400, {
          error: "validation failed",
          details: zodDetails(parsed.error),
        });
      }

      const { email, password } = parsed.data;

      const user = await findUserByEmail(email);
      if (!user) return respond(res, 401, { error: "invalid credentials" });

      if (!user.isverified) {
        return respond(res, 403, {
          error: "email not verified",
          code: "email_not_verified",
        });
      }

      if (!user.isActive) {
        return respond(res, 403, {
          error: "This account has been temprarily disabled/suspended",
          code: "user_not_active",
        });
      }

      const ok = await comparePassword(password, user.passwordHash);
      if (!ok) return respond(res, 401, { error: "invalid credentials" });

      const token = signJwt({
        sub: user.id,
        email,
        globalRole: user.globalRole ?? null,
      });
      // if SUPERADMIN, bypass store checks and return global admin context
      if (user.globalRole === "SUPERADMIN") {
        return respond(res, 200, {
          token,
          user: {
            id: user.id,
            username: user.username, // already decrypted by Prisma extension
            email,
            globalRole: "SUPERADMIN",
          },
          effectiveStore: null, // superadmin sees global view
          stores: [],
        });
      }
      else if (user.globalRole === "SUPPLIER") {
        const supplier = await prisma.supplier.findUnique({
          where: { userId: user.id },
          select: {
            id: true,
            name: true,
            storeId: true,
            isActive: true,
          },
        });
        
        return respond(res, 200, {
          token,
          user: {
            id: user.id,
            username: crypto$.decryptCell(user.username),
            email,
            globalRole: "SUPPLIER",
          },
          // Supplier portal context
          effectiveStore: null,
          needsStoreSetup: false,
          needsStoreSelection: false,
          supplier: supplier, // Full supplier object or null
          suppliers: supplier ? [supplier] : [], // Consistency array
        });
      }
      else {

        // fetch store roles for this user
        const stores = await prisma.userStoreRole.findMany({
          where: { userId: user.id },
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

        // NO STORE → must create one
        if (stores.length === 0) {
          return respond(res, 200, {
            token,
            user: {
              id: user.id,
              username: user.username, // already decrypted by Prisma extension
              email,
              globalRole: user.globalRole, // expose global role
            },
            effectiveStore: null,
            needsStoreSetup: true,
          });
        }

        // ONE STORE → use directly
        if (stores.length === 1) {
          const s = stores[0];
          return respond(res, 200, {
            token,
            user: {
              id: user.id,
              username: user.username, // already decrypted by Prisma extension
              email,
              globalRole: user.globalRole, // expose global role (e.g. SUPPLIER)
            },
            effectiveStore: {
              id: s.store.id,
              name: s.store.name, // already decrypted by Prisma extension
              slug: s.store.slug,
              timezone: s.store.timezone,
              currency: s.store.currency,
              settings: s.store.settings,
              roles: [s.role],
            },
          });
        }

        // (future support) MULTIPLE STORES → frontend must show switcher
        return respond(res, 200, {
          token,
          user: {
            id: user.id,
            username: user.username, // already decrypted by Prisma extension
            email,
            globalRole: user.globalRole, // expose global role
          },
          effectiveStore: null,
          stores, // store names already decrypted by Prisma extension
          needsStoreSelection: true,
        });

      }

    } catch (err: any) {
      console.error("Signin error:", err);
      next(err);
    }
  }
);

/* Verify OTP */
router.post(
  "/verify-otp",
  verifyLimiter,
  async (req: Request, res: Response, next) => {
    try {
      const parsed = verifyOtpSchema.safeParse(req.body);
      if (!parsed.success) {
        return respond(res, 400, {
          error: "validation failed",
          details: zodDetails(parsed.error),
        } as ErrorResponse);
      }
      const { email, otp } = parsed.data;

      const user = await findUserByEmail(email);
      if (!user) return respond(res, 404, { error: "user not found" });

      // fetch latest unused OTP rows for this contact (encrypted phone)
      const encPhone = crypto$.encryptCellDeterministic(email);
      const otpRow = await prisma.otp.findFirst({
        where: {
          phone: encPhone,
          used: false,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: "desc" as const },
      });

      if (!otpRow)
        return respond(res, 400, { error: "no otp pending or otp expired" });

      // decrypt stored otpHash then compare
      let storedOtpPlain: string | null = null;
      try {
        // Try manual decrypt first
        storedOtpPlain = crypto$.decryptCell(otpRow.otpHash);
        // If null (fail), maybe it's plaintext?
        if (!storedOtpPlain) storedOtpPlain = otpRow.otpHash;
      } catch (dErr) {
        console.error("Failed to decrypt stored OTP:", dErr);
        // Fallback
        storedOtpPlain = otpRow.otpHash;
      }

      if (storedOtpPlain !== otp) {
        // increment attempts for audit
        try {
          await prisma.otp.update({
            where: { id: otpRow.id },
            data: { attempts: otpRow.attempts + 1 },
          });
        } catch (_e) {
          // ignore
        }
        return respond(res, 400, { error: "invalid otp" });
      }

      // mark OTP as used and set user's isverified = true
      try {
        await prisma.$transaction([
          prisma.otp.update({
            where: { id: otpRow.id },
            data: { used: true },
          }),
          // update user verification - prefer userId from otp row if present
          prisma.user.update({
            where: { id: otpRow.userId ?? user.id },
            data: { isverified: true },
          }),
        ]);
      } catch (pErr: any) {
        console.error("Prisma mark OTP used / verify user error:", pErr);
        // if transaction failed, still respond success but warn
        return respond(res, 200, {
          message:
            "otp verified (but failed to persist used/verified state on server)",
        });
      }

      return respond(res, 200, { message: "otp verified" });
    } catch (err: any) {
      console.error("Verify OTP error:", err);
      if (err?.name === "ZodError")
        return respond(res, 400, {
          error: "validation failed",
          details: err.errors,
        });
      next(err);
    }
  }
);

export default router;
