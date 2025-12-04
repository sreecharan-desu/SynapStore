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
const ENCRYPTED_FIELDS = ["username", "email", "imageUrl", "OtpCode"];

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

async function findUserByEmail(email: string) {
  // deterministic encryption for lookup
  const enc = crypto$.encryptCellDeterministic(email);
  const row = await prisma.user.findUnique({
    where: { email: enc },
    select: {
      id: true,
      email: true,
      username: true,
      password: true,
      OtpCode: true,
      otpExpiresAt: true,
    },
  });
  if (!row) return null;
  return crypto$.decryptObject(row, ENCRYPTED_FIELDS) as any;
}

async function findUserByUsername(username: string) {
  const enc = crypto$.encryptCellDeterministic(username);
  const row = await prisma.user.findUnique({
    where: { username: enc },
    select: { id: true, username: true, email: true },
  });
  if (!row) return null;
  return crypto$.decryptObject(row, ENCRYPTED_FIELDS) as any;
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
      const existingUsername = await findUserByUsername(username);
      if (existingUsername) {
        return respond(res, 409, {
          error: "user already exists",
          code: "user_exists",
        });
      }

      // prepare data
      const hashed = await hashPassword(password);
      const encUsername = crypto$.encryptCellDeterministic(username);
      const encEmail = crypto$.encryptCellDeterministic(email);

      // create user (password stored hashed, not encrypted)
      let userRow;
      try {
        userRow = await prisma.user.create({
          data: {
            username: encUsername,
            email: encEmail,
            password: hashed,
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

      // generate and store encrypted OTP
      const otp = generateOtp();
      const otpExpiry = getOtpExpiryDate();
      const encOtp = crypto$.encryptCell(otp);

      try {
        await prisma.user.update({
          where: { id: userRow.id },
          data: { OtpCode: encOtp, otpExpiresAt: otpExpiry },
        });
      } catch (pErr: any) {
        console.error("Prisma update OTP error:", pErr);
        // best-effort cleanup: delete user to avoid incomplete account? (optional)
        // For now return error and log
        return respond(res, 502, { error: "database error storing otp" });
      }

      // send OTP to plaintext email provided by client
      try {
        await sendOtpEmail(email, otp);
      } catch (mailErr: any) {
        console.error("Failed to send OTP email:", mailErr);
        // clear otp to avoid leaving unusable OTP
        try {
          await prisma.user.update({
            where: { id: userRow.id },
            data: { OtpCode: null, otpExpiresAt: null },
          });
        } catch (clearErr) {
          console.error("Failed to clear OTP after mail failure:", clearErr);
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
      const encOtp = crypto$.encryptCell(otp);

      try {
        await prisma.user.update({
          where: { id: user.id },
          data: { OtpCode: encOtp, otpExpiresAt: otpExpiry },
        });
      } catch (pErr: any) {
        console.error("Prisma update OTP error:", pErr);
        return respond(res, 502, { error: "failed to update otp" });
      }

      try {
        await sendOtpEmail(email, otp);
      } catch (mailErr: any) {
        console.error("Failed to send resend OTP email:", mailErr);
        try {
          await prisma.user.update({
            where: { id: user.id },
            data: { OtpCode: null, otpExpiresAt: null },
          });
        } catch (clearErr) {
          console.error("Failed to clear OTP after mail failure:", clearErr);
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

      const ok = await comparePassword(password, user.password);
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

      if (!user.OtpCode || !user.otpExpiresAt)
        return respond(res, 400, { error: "no otp pending" });

      if (user.otpExpiresAt < new Date()) {
        try {
          await prisma.user.update({
            where: { id: user.id },
            data: { OtpCode: null, otpExpiresAt: null },
          });
        } catch (clearErr) {
          console.error("Failed to clear expired OTP:", clearErr);
        }
        return respond(res, 400, { error: "otp expired" });
      }

      // user.OtpCode is stored encrypted; compare plaintext by decrypting earlier in findUserByEmail
      if (user.OtpCode !== otp)
        return respond(res, 400, { error: "invalid otp" });

      try {
        await prisma.user.update({
          where: { id: user.id },
          data: { OtpCode: null, otpExpiresAt: null },
        });
      } catch (pErr: any) {
        console.error("Prisma clear OTP error:", pErr);
        return respond(res, 200, {
          message: "otp verified (but failed to persist clear on server)",
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
