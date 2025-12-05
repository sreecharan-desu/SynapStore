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
  const enc = crypto$.encryptCellDeterministic(email);
  const row = await prisma.user.findUnique({
    where: { email: enc },
    select: {
      id: true,
      email: true,
      username: true,
      imageUrl: true,
      passwordHash: true,
      phone: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!row) return null;

  // decrypt encrypted fields
  const decrypted = crypto$.decryptObject(row, ENCRYPTED_FIELDS) as any;
  // keep passwordHash (already present)
  decrypted.passwordHash = row.passwordHash ?? null;
  return decrypted as any;
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
 - We store email OTPs in Otp.phone to avoid changing schema
 - otpHash is stored via crypto$.encryptCell for symmetric encryption so we can decrypt and compare
*/
async function createOtpForUser(
  userId: string | null,
  email: string,
  otpPlain: string,
  expiresAt: Date
) {
  const encOtp = crypto$.encryptCell(otpPlain);
  // store phone = email to preserve schema
  const otpRow = await prisma.otp.create({
    // note: Prisma generates model accessor name from model 'Otp' -> 'oTP'
    // If your generated client uses a different name, update accordingly.
    data: {
      userId: userId ?? undefined,
      storeId: undefined,
      phone: email,
      otpHash: encOtp,
      salt: "", // not used with encryptCell approach
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

      // check username duplicate
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
          },
          select: { id: true, username: true, email: true },
        });
      } catch (pErr: any) {
        console.error("Prisma create user error:", pErr);
        // In case of race unique violation, return friendly message
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
        // Consider deleting user to avoid incomplete account - for now return error
        return respond(res, 502, { error: "database error storing otp" });
      }

      // send OTP to plaintext email provided by client
      try {
        await sendOtpEmail(email, otp);
      } catch (mailErr: any) {
        console.error("Failed to send OTP email:", mailErr);
        // best-effort: mark latest OTP as used / remove it to avoid lingering OTPs
        try {
          await prisma.otp.updateMany({
            where: { phone: email, used: false },
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

      // decrypt user fields for response
      const decrypted = crypto$.decryptObject(userRow, ENCRYPTED_FIELDS) as any;

      return respond(res, 201, {
        message: "registered - otp sent",
        user: {
          id: decrypted.id,
          username: decrypted.username,
          email: decrypted.email,
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
        // attempt to mark latest OTP as used
        try {
          await prisma.otp.updateMany({
            where: { phone: email, used: false },
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
        } as ErrorResponse);
      }
      const { email, password } = parsed.data;

      const user = await findUserByEmail(email);
      if (!user) return respond(res, 401, { error: "invalid credentials" });

      const ok = await comparePassword(password, user.passwordHash);
      if (!ok) return respond(res, 401, { error: "invalid credentials" });

      const token = signJwt({ sub: user.id, email });

      return respond(res, 200, {
        token,
        user: { id: user.id, username: user.username, email },
      });
    } catch (err: any) {
      console.error("Signin error:", err);
      if (err?.name === "ZodError")
        return respond(res, 400, {
          error: "validation failed",
          details: err.errors,
        });
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

      // fetch latest unused OTP rows for this phone (email)
      const otpRow = await prisma.otp.findFirst({
        where: {
          phone: email,
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
        storedOtpPlain = crypto$.decryptCell(otpRow.otpHash);
      } catch (dErr) {
        console.error("Failed to decrypt stored OTP:", dErr);
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

      // mark OTP as used
      try {
        await prisma.otp.update({
          where: { id: otpRow.id },
          data: { used: true },
        });
      } catch (pErr: any) {
        console.error("Prisma mark OTP used error:", pErr);
        // still treat as success but warn
        return respond(res, 200, {
          message: "otp verified (but failed to persist used state on server)",
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
