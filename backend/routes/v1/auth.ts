// routes/auth.ts
import { Router } from "express";
import { generateOtp, getOtpExpiryDate } from "../../lib/otp";
import { sendOtpEmail } from "../../lib/mailer";
import { hashPassword, comparePassword, signJwt } from "../../lib/auth";
import { crypto$ } from "../../lib/crypto";
import { z } from "zod";
import prisma from "../../lib/prisma";

const router = Router();
const ENCRYPTED_FIELDS = ["username", "email", "imageUrl", "OtpCode"];

/* Request schemas */
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

/* Helper to find user by plaintext email
   Note: Decrypts all results to find match. */
async function findUserByEmail(email: string) {
  // Use deterministic encryption to perform a direct DB lookup
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
  const dec = crypto$.decryptObject(row, ENCRYPTED_FIELDS);
  return dec as any;
}

/* Helper to find user by username */
async function findUserByUsername(username: string) {
  const enc = crypto$.encryptCellDeterministic(username);
  const row = await prisma.user.findUnique({
    where: { username: enc },
    select: { id: true, username: true, email: true },
  });
  if (!row) return null;
  return crypto$.decryptObject(row, ENCRYPTED_FIELDS) as any;
}

/* Register */
router.post("/register", async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);

    // Check duplicate email
    const existing = await findUserByEmail(data.email);
    if (existing)
      return res.status(409).json({ error: "email already in use" });

    // Check duplicate username
    const existingUsername = await findUserByUsername(data.username);
    if (existingUsername)
      return res.status(409).json({ error: "username already in use" });

    const hashed = await hashPassword(data.password);

    // Encrypt fields before storing (deterministic for lookups)
    const encryptedUsername = crypto$.encryptCellDeterministic(data.username);
    const encryptedEmail = crypto$.encryptCellDeterministic(data.email);

    const user = await prisma.user.create({
      data: {
        username: encryptedUsername,
        email: encryptedEmail,
        password: hashed,
      },
      select: { id: true, username: true, email: true },
    });

    // Decrypt response
    const decrypted = crypto$.decryptObject(user, ENCRYPTED_FIELDS);

    const otp = generateOtp();
    const otpExpiry = getOtpExpiryDate();

    // Encrypt OTP before storing
    const encryptedOtp = crypto$.encryptCell(otp);

    await prisma.user.update({
      where: { id: user.id },
      data: { OtpCode: encryptedOtp, otpExpiresAt: otpExpiry },
    });

    // Send OTP to plaintext email provided by client
    await sendOtpEmail(data.email, otp);

    res.status(201).json({
      message: "registered - otp sent",
      user: { id: decrypted.id, username: decrypted.username, email: decrypted.email },
    });
  } catch (err: any) {
    console.error("Register handler error:", err);
    if (err?.name === "ZodError") {
      return res
        .status(400)
        .json({ error: "validation failed", details: err.errors });
    }
    next(err);
  }
});

/* Resend OTP */
router.post("/resend-otp", async (req, res, next) => {
  try {
    const { email } = resendSchema.parse(req.body);
    const user = await findUserByEmail(email);
    if (!user) return res.status(404).json({ error: "user not found" });

    const otp = generateOtp();
    const otpExpiry = getOtpExpiryDate();

    // Encrypt OTP before storing
    const encryptedOtp = crypto$.encryptCell(otp);

    await prisma.user.update({
      where: { id: user.id },
      data: { OtpCode: encryptedOtp, otpExpiresAt: otpExpiry },
    });

    await sendOtpEmail(email, otp);

    res.json({ message: "otp resent" });
  } catch (err: any) {
    console.error("Resend OTP error:", err);
    if (err?.name === "ZodError")
      return res
        .status(400)
        .json({ error: "validation failed", details: err.errors });
    next(err);
  }
});

/* Signin */
router.post("/signin", async (req, res, next) => {
  try {
    const { email, password } = signinSchema.parse(req.body);

    const user = await findUserByEmail(email);
    if (!user) return res.status(404).json({ error: "invalid credentials" });

    const ok = await comparePassword(password, user.password);
    if (!ok) return res.status(401).json({ error: "invalid credentials" });

    const token = signJwt({ sub: user.id, email });

    res.json({
      token,
      user: { id: user.id, username: user.username, email },
    });
  } catch (err: any) {
    console.error("Signin error:", err);
    if (err?.name === "ZodError")
      return res
        .status(400)
        .json({ error: "validation failed", details: err.errors });
    next(err);
  }
});

/* Verify OTP */
router.post("/verify-otp", async (req, res, next) => {
  try {
    const { email, otp } = verifyOtpSchema.parse(req.body);

    const user = await findUserByEmail(email);
    if (!user) return res.status(404).json({ error: "user not found" });

    if (!user.OtpCode || !user.otpExpiresAt)
      return res.status(400).json({ error: "no otp pending" });

    if (user.otpExpiresAt < new Date())
      return res.status(400).json({ error: "otp expired" });

    if (user.OtpCode !== otp)
      return res.status(400).json({ error: "invalid otp" });

    await prisma.user.update({
      where: { id: user.id },
      data: { OtpCode: null, otpExpiresAt: null },
    });

    res.json({ message: "otp verified" });
  } catch (err: any) {
    console.error("Verify OTP error:", err);
    if (err?.name === "ZodError")
      return res
        .status(400)
        .json({ error: "validation failed", details: err.errors });
    next(err);
  }
});

export default router;
