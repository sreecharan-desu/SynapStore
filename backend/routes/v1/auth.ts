import { Router } from "express";
import { generateOtp, getOtpExpiryDate } from "../../lib/otp";
import { sendOtpEmail } from "../../lib/mailer";
import { hashPassword, comparePassword, signJwt } from "../../lib/auth";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaPg({ connectionString });

const prisma = new PrismaClient({ adapter });
const router = Router();

/**
 - POST /api/v1/auth/register
 - POST /api/v1/auth/resend-otp
 - POST /api/v1/auth/signin
 - POST /api/v1/auth/verify-otp
*/

// request schemas
const registerSchema = z.object({
  username: z.string().min(3),
  email: z.string().email(),
  password: z.string().min(6),
});

const resendSchema = z.object({
  email: z.string().email(),
});

const signinSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const verifyOtpSchema = z.object({
  email: z.string().email(),
  otp: z.string().min(4),
});

router.post("/register", async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);

    if (!data.email) {
      return res.status(400).json({ error: "email is required" });
    }

    // Defensive: try findUnique, fall back to findFirst
    let existing;
    try {
      existing = await prisma.user.findFirst({ where: { email: data.email } });
    } catch (findErr: any) {
      // If findUnique fails because the field is not unique, fall back to findFirst
      console.warn(
        "findUnique failed, falling back to findFirst. Prisma error:",
        findErr?.code
      );
      existing = await prisma.user.findFirst({ where: { email: data.email } });
    }

    if (existing) {
      return res.status(409).json({ error: "email already in use" });
    }

    const hashed = await hashPassword(data.password);

    const user = await prisma.user.create({
      data: {
        username: data.username,
        email: data.email,
        password: hashed,
      },
    });

    const otp = generateOtp();
    const otpExpiry = getOtpExpiryDate();

    await prisma.user.update({
      where: { id: user.id },
      data: { OtpCode: otp, otpExpiresAt: otpExpiry },
    });

    await sendOtpEmail(user.email, otp);

    res.status(201).json({
      message: "registered - otp sent to email",
      user: { id: user.id, email: user.email, username: user.username },
    });
  } catch (err: any) {
    console.error("Register handler error:", err);
    // If it's a Zod issue, return 400
    if (err?.name === "ZodError") {
      return res
        .status(400)
        .json({ error: "validation failed", details: err.errors });
    }
    next(err);
  }
});

router.post("/resend-otp", async (req, res, next) => {
  try {
    const { email } = resendSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ error: "user not found" });

    // generate new OTP and overwrite existing
    const otp = generateOtp();
    const otpExpiry = getOtpExpiryDate();

    await prisma.user.update({
      where: { email },
      data: { OtpCode: otp, otpExpiresAt: otpExpiry },
    });

    await sendOtpEmail(email, otp);

    res.json({ message: "otp resent" });
  } catch (err) {
    next(err);
  }
});

router.post("/signin", async (req, res, next) => {
  try {
    const { email, password } = signinSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ error: "invalid credentials" });

    const ok = await comparePassword(password, user.password);
    if (!ok) return res.status(401).json({ error: "invalid credentials" });

    // sign token - include minimal payload
    const token = signJwt({ sub: user.id, email: user.email });

    res.json({
      token,
      user: { id: user.id, email: user.email, username: user.username },
    });
  } catch (err) {
    next(err);
  }
});

router.post("/verify-otp", async (req, res, next) => {
  try {
    const { email, otp } = verifyOtpSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ error: "user not found" });

    if (!user.OtpCode || !user.otpExpiresAt) {
      return res.status(400).json({ error: "no otp pending for this user" });
    }

    const now = new Date();
    if (user.otpExpiresAt < now) {
      return res.status(400).json({ error: "otp expired" });
    }

    if (user.OtpCode !== otp) {
      return res.status(400).json({ error: "invalid otp" });
    }

    // OTP verified - clear otp fields
    await prisma.user.update({
      where: { email },
      data: { OtpCode: null, otpExpiresAt: null },
    });

    // You might want to mark email as verified in the future - add a flag to the schema then set it here

    res.json({ message: "otp verified" });
  } catch (err) {
    next(err);
  }
});

export default router;
