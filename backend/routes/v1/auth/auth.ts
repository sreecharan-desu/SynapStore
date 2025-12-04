// routes/v1/auth.ts
import { Router } from "express";
import { generateOtp, getOtpExpiryDate } from "../../../lib/otp";
import { sendOtpEmail } from "../../../lib/mailer";
import { hashPassword, comparePassword, signJwt } from "../../../lib/auth";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import type { Request, Response } from "express";
import rateLimiter from "../../../middleware/ratelimitter";

/**
 Robust Auth Router
 - POST /api/v1/auth/register
 - POST /api/v1/auth/resend-otp
 - POST /api/v1/auth/signin
 - POST /api/v1/auth/verify-otp
*/

// ---------- Prisma client (kept local to avoid import mismatch) ----------
const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

// ---------- Helper types & functions ----------
type ErrorResponse = { error: string; code?: string; details?: any[] };

const respond = (res: Response, status: number, body: object) =>
  res.status(status).json(body);

// Normalized zod error -> friendly list
const zodDetails = (err: any) =>
  err?.issues?.map((i: any) => ({
    path: i.path.join("."),
    message: i.message,
  })) ?? [];

const safeParseBody = <T>(schema: z.ZodTypeAny, body: unknown) => {
  const parsed = schema.safeParse(body);
  return parsed.success
    ? { ok: true, data: parsed.data as T }
    : { ok: false, error: parsed.error };
};

// ---------- Schemas ----------
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

const router = Router();

// ---------- Rate limiters (in-memory) ----------
const registerLimiter = rateLimiter({
  keyPrefix: "register-ip",
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req) => (req.ip ? req.ip : null),
});

const resendLimiter = rateLimiter({
  keyPrefix: "resend-email",
  windowMs: 60 * 1000,
  max: 1,
  burstWindowMs: 60 * 60 * 1000,
  burstMax: 5,
  // @ts-ignore
  keyGenerator: (req) =>
    req.body?.email ? String(req.body.email).toLowerCase() : req.ip,
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
  // @ts-ignore
  keyGenerator: (req) =>
    req.body?.email ? String(req.body.email).toLowerCase() : req.ip,
});

// ---------- POST /register ----------
router.post(
  "/register",
  registerLimiter,
  async (req: Request, res: Response) => {
    try {
      const parsed: any = safeParseBody(registerSchema, req.body);
      if (!parsed.ok) {
        return respond(res, 400, {
          error: "validation failed",
          details: zodDetails(parsed.error),
        });
      }

      const { username, email, password } = parsed.data;

      const otp = generateOtp();
      const otpExpiry = getOtpExpiryDate();
      const hashed = await hashPassword(password);

      let user;

      try {
        user = await prisma.user.create({
          data: {
            username,
            email,
            password: hashed,
            OtpCode: otp,
            otpExpiresAt: otpExpiry,
          },
          select: {
            id: true,
            email: true,
            username: true,
          },
        });
      } catch (pErr: any) {
        // Friendly error for existing user
        if (pErr?.code === "P2002") {
          return respond(res, 409, {
            error: "user already exists",
            code: "user_exists",
          });
        }

        console.error("Prisma create user error:", pErr);
        return respond(res, 502, { error: "database error creating user" });
      }

      try {
        await sendOtpEmail(user.email, otp);
      } catch (mailErr: any) {
        console.error("Failed to send OTP email:", mailErr);
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

      return respond(res, 201, {
        message: "registered - otp sent to email",
        user,
      });
    } catch (err: any) {
      console.error("Unhandled register error:", err);
      return respond(res, 500, { error: "unexpected server error" });
    }
  }
);

// ---------- POST /resend-otp ----------
router.post(
  "/resend-otp",
  resendLimiter,
  async (req: Request, res: Response) => {
    try {
      const parsed: any = safeParseBody(resendSchema, req.body);
      if (!parsed.ok) {
        return respond(res, 400, {
          error: "validation failed",
          details: zodDetails(parsed.error),
        } as ErrorResponse);
      }
      const { email } = parsed.data;

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        return respond(res, 404, { error: "user not found" });
      }

      const otp = generateOtp();
      const otpExpiry = getOtpExpiryDate();

      try {
        await prisma.user.update({
          where: { email },
          data: { OtpCode: otp, otpExpiresAt: otpExpiry },
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
            where: { email },
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
      console.error("Unhandled resend-otp error:", err);
      return respond(res, 500, { error: "unexpected server error" });
    }
  }
);

// ---------- POST /signin ----------
router.post(
  "/signin",
  signinIpLimiter,
  signinEmailLimiter,
  async (req: Request, res: Response) => {
    try {
      const parsed: any = safeParseBody(signinSchema, req.body);
      if (!parsed.ok) {
        return respond(res, 400, {
          error: "validation failed",
          details: zodDetails(parsed.error),
        } as ErrorResponse);
      }
      const { email, password } = parsed.data;

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        return respond(res, 401, { error: "invalid credentials" });
      }

      const ok = await comparePassword(password, user.password).catch(
        (cErr) => {
          console.error("Password compare error:", cErr);
          return false;
        }
      );

      if (!ok) {
        return respond(res, 401, { error: "invalid credentials" });
      }

      const token = signJwt({ sub: user.id, email: user.email });

      return respond(res, 200, {
        token,
        user: { id: user.id, email: user.email, username: user.username },
      });
    } catch (err: any) {
      console.error("Unhandled signin error:", err);
      return respond(res, 500, { error: "unexpected server error" });
    }
  }
);

// ---------- POST /verify-otp ----------
router.post(
  "/verify-otp",
  verifyLimiter,
  async (req: Request, res: Response) => {
    try {
      const parsed: any = safeParseBody(verifyOtpSchema, req.body);
      if (!parsed.ok) {
        return respond(res, 400, {
          error: "validation failed",
          details: zodDetails(parsed.error),
        } as ErrorResponse);
      }
      const { email, otp } = parsed.data;

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        return respond(res, 404, { error: "user not found" });
      }

      if (!user.OtpCode || !user.otpExpiresAt) {
        return respond(res, 400, { error: "no otp pending for this user" });
      }

      const now = new Date();
      if (user.otpExpiresAt < now) {
        try {
          await prisma.user.update({
            where: { email },
            data: { OtpCode: null, otpExpiresAt: null },
          });
        } catch (clearErr) {
          console.error("Failed to clear expired OTP:", clearErr);
        }
        return respond(res, 400, { error: "otp expired" });
      }

      if (user.OtpCode !== otp) {
        return respond(res, 400, { error: "invalid otp" });
      }

      try {
        await prisma.user.update({
          where: { email },
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
      console.error("Unhandled verify-otp error:", err);
      return respond(res, 500, { error: "unexpected server error" });
    }
  }
);

export default router;
