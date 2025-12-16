// routes/v1/auth.ts
import { Router } from "express";
import { generateOtp, getOtpExpiryDate } from "../../../lib/otp";
import { sendMail } from "../../../lib/mailer";
import { getOtpEmailTemplate, getNotificationEmailTemplate } from "../../../lib/emailTemplates";

import { hashPassword, comparePassword, signJwt } from "../../../lib/auth";
import { z } from "zod";
import prisma from "../../../lib/prisma";
import type { Request, Response } from "express";
import { crypto$ } from "../../../lib/crypto";
import rateLimiter from "../../../middleware/ratelimitter";

import {
  sendSuccess,
  sendError,
  handleZodError,
  sendInternalError,
  handlePrismaError,
} from "../../../lib/api";
import { notificationQueue } from "../../../lib/queue";
import { sendNotification } from "../../../lib/notification";
import axios from "axios";

const router = Router();

// Cloudflare Turnstile Verification Helper
async function verifyTurnstileToken(token: string): Promise<boolean> {
  const SECRET_KEY = process.env.CLOUDFLARE_SECRET_KEY;
  if (!SECRET_KEY) {
      console.warn("CLOUDFLARE_SECRET_KEY not set - skipping captcha verification");
      return true; // fail open if config missing
  }

  try {
    const formData = new URLSearchParams();
    formData.append('secret', SECRET_KEY);
    formData.append('response', token);

    const result = await axios.post(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      formData
    );
    
    return result.data.success === true;
  } catch (err) {
    console.error("Turnstile verification failed:", err);
    return false;
  }
}


// encrypted fields stored with crypto$.encryptCell / encryptCellDeterministic
const ENCRYPTED_FIELDS = ["username", "email", "imageUrl"];

/* Schemas */
const registerSchema = z.object({
  username: z.string().min(3, "username must be at least 3 characters"),
  email: z.string().email("invalid email"),
  password: z.string().min(6, "password must be at least 6 characters"),
  captchaToken: z.string().optional(),
});

const resendSchema = z.object({
  email: z.string().email("invalid email"),
});

const signinSchema = z.object({
  email: z.string().email("invalid email"),
  password: z.string().min(6, "password must be at least 6 characters"),
  captchaToken: z.string().optional(),
});

const verifyOtpSchema = z.object({
  email: z.string().email("invalid email"),
  otp: z.string().min(4, "otp too short"),
});

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
  // Pass plaintext; middleware handles encryption
  // phone uses deterministic (lookup), otpHash uses randomized (secure)
  const otpRow = await prisma.otp.create({
    data: {
      userId: userId ?? undefined,
      storeId: undefined,
      phone: email,     // middleware -> encryptCellDeterministic
      otpHash: otpPlain, // middleware -> encryptCell
      salt: "",
      expiresAt,
      used: false,
      attempts: 0,
    },
  });
  return otpRow;
}

/* Routes */

/* Resend OTP */

/**
 * POST /v1/auth/register
 * Description: Registers a new user and sends an OTP to their email.
 * Headers: None
 * Body:
 *  - username: string (min 3 chars)
 *  - email: string (valid email)
 *  - password: string (min 6 chars)
 * Responses:
 *  - 201: { message: "registered - otp sent", user: { id, username, email } }
 *  - 400: Validation failed
 *  - 409: User already exists
 *  - 502: Database error
 */
router.post(
  "/register",
  registerLimiter,
  async (req: Request, res: Response, next: import("express").NextFunction) => {
    try {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) {
        return handleZodError(res, parsed.error);
      }
      const { username, password, captchaToken } = parsed.data;
      const email = parsed.data.email.toLowerCase();

      // Verify Captcha (optional/bypassable)
      if (process.env.CLOUDFLARE_SECRET_KEY && captchaToken) {
        const isHuman = await verifyTurnstileToken(captchaToken);
        if (!isHuman) {
           return sendError(res, "Captcha verification failed", 400);
        }
      }

      // check duplicates via deterministic encryption lookups
      const existingEmail = await findUserByEmail(email);
      if (existingEmail) {
        return sendError(res, "It looks like this email is already registered with us.", 409, { code: "user_exists" });
      }

      // check username duplicate (deterministic)
      const encUsername = crypto$.encryptCellDeterministic(username);
      const existingUsernameRow = await prisma.user.findUnique({
        where: { username: encUsername },
        select: { id: true },
      });
      if (existingUsernameRow) {
        return sendError(res, "That username is already taken. Please try another one.", 409, { code: "username_taken" });
      }

      // prepare data
      const hashed = await hashPassword(password);
      const encEmail = crypto$.encryptCellDeterministic(email);

      // create user (password stored hashed, not encrypted; email/username auto-encrypted by middleware)
      let userRow;
      try {
        userRow = await prisma.user.create({
          data: {
            username: username, // plaintext, middleware encrypts deterministically
            email: email,       // plaintext, middleware encrypts deterministically
            passwordHash: hashed,
            globalRole: "READ_ONLY"
            // isverified defaults to false per schema
          },
          select: { id: true, username: true, email: true },
        });
      } catch (pErr: any) {
        return handlePrismaError(res, pErr, "User");
      }

      // generate and store OTP (in Otp table)
      const otp = generateOtp();
      const otpExpiry = getOtpExpiryDate();

      try {
        // Pass plaintext args, createOtpForUser adjusted below
        await createOtpForUser(userRow.id, email, otp, otpExpiry);
      } catch (pErr: any) {
        return handlePrismaError(res, pErr, "OTP");
      }

      // send OTP to plaintext email provided by client
      try {
        await sendMail({
          to: email,
          subject: "Your SynapStore verification code",
          html: getOtpEmailTemplate(otp),
        });
      } catch (mailErr: any) {
        console.error("Failed to send OTP email:", mailErr);
        // Clean up OTP to avoid dead state if possible, or just fail
        return sendError(res, "Failed to send verification email. Please try again later.", 502);
      }

      // Prisma extension automatically decrypts fields
      return sendSuccess(res, "Registration successful. OTP sent to your email.", {
        user: {
          id: userRow.id,
          username: userRow.username, // decent chance this is already decrypted by the extension
          email: email, 
        },
      }, 201);

    } catch (err: any) {
      next(err);
    }
  }
);

/* Resend OTP */

/**
 * POST /v1/auth/resend-otp
 * Description: Resends the OTP to the user's email if not already verified.
 * Headers: None
 * Body:
 *  - email: string (valid email)
 * Responses:
 *  - 200: { message: "otp resent" }
 *  - 400: Validation failed or email already verified
 *  - 404: User not found
 *  - 429: Rate limited (wait before retrying)
 *  - 502: Failed to create OTP or send email
 */
// Fix typo
router.post(
  "/resend-otp",
  resendLimiter,
  async (req: Request, res: Response, next: import("express").NextFunction) => {
    try {
      const parsed = resendSchema.safeParse(req.body);
      if (!parsed.success) {
        return handleZodError(res, parsed.error);
      }
      const email = parsed.data.email.toLowerCase();

      const user = await findUserByEmail(email);
      if (!user) return sendError(res, "We couldn't find an account with that email address.", 404);
      if (user.isverified) {
        return sendError(res, "Your email is already all set and verified!", 400, { code: "email_already_verified" });
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
          return sendError(res, `Please wait ${retryAfter} second(s) before requesting another OTP`, 429, { code: "otp_rate_limited", retryAfter });
        }
      }

      const otp = generateOtp();
      const otpExpiry = getOtpExpiryDate();

      try {
        await createOtpForUser(user.id, email, otp, otpExpiry);
      } catch (pErr: any) {
        return handlePrismaError(res, pErr, "OTP");
      }

      try {
        await sendMail({
          to: email,
          subject: "Your SynapStore verification code",
          html: getOtpEmailTemplate(otp),
        });
      } catch (mailErr: any) {
         console.error("Failed to send resend OTP email:", mailErr);
         return sendError(res, "Failed to send verification email. Please try again later.", 502);
      }

      return sendSuccess(res, "OTP resent successfully");
    } catch (err: any) {
      next(err);
    }
  }
);

/* Signin */

/**
 * POST /v1/auth/signin
 * Description: Authenticates a user and returns a JWT token.
 * Headers: None
 * Body:
 *  - email: string (valid email)
 *  - password: string (min 6 chars)
 * Responses:
 *  - 200: { token, user: { ... }, effectiveStore: { ... } | null, stores: [], needsStoreSetup: boolean, needsStoreSelection: boolean }
 *  - 400: Validation failed
 *  - 401: Invalid credentials
 *  - 403: Email not verified or account suspended
 *  - 500: Internal server error
 */
router.post(
  "/signin",
  signinIpLimiter,
  signinEmailLimiter,
  async (req: Request, res: Response, next: import("express").NextFunction) => {
    try {
      const parsed = signinSchema.safeParse(req.body);
      if (!parsed.success) {
        return handleZodError(res, parsed.error);
      }

      const { password, captchaToken } = parsed.data;
      const email = parsed.data.email.toLowerCase();

      // Verify Captcha (optional/bypassable)
      if (process.env.CLOUDFLARE_SECRET_KEY && captchaToken) {
        const isHuman = await verifyTurnstileToken(captchaToken);
        if (!isHuman) {
           return sendError(res, "Captcha verification failed", 400);
        }
      }

      const user = await findUserByEmail(email);
      if (!user) return sendError(res, "It looks like you don't have an account with us yet.", 404, { code: "user_not_found" });

      if (!user.isverified) {
        return sendError(res, "Please check your inbox to verify your email before signing in.", 403, { code: "email_not_verified" });
      }

      if (!user.isActive) {
        return sendError(res, "We've placed a temporary hold on this account. Please contact support.", 403, { code: "user_not_active" });
      }

      if (!user.passwordHash) {
          // User exists but has no password (e.g. Google Auth only)
          return sendError(res, "This account uses social login. Please sign in with Google.", 400, { code: "social_login_required" });
      }

      const ok = await comparePassword(password, user.passwordHash);
      if (!ok) return sendError(res, "The password you entered doesn't match our records.", 401, { code: "invalid_password" });

      // Parallel fetching for speed
      const [supplier, storesEntry] = await Promise.all([
        // Fetch supplier info
        prisma.supplier.findFirst({
          where: { userId: user.id },
          select: { id: true, name: true, storeId: true, isActive: true }
        }),
        // Fetch store roles
        prisma.userStoreRole.findMany({
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
        })
      ]);

      // Determine effective store ID for token if single store
      let tokenStoreId = "";
      if (storesEntry.length === 1) {
          tokenStoreId = storesEntry[0].store.id;
      }

      const tokenPayload: any = {
        sub: user.id,
        email,
        globalRole: user.globalRole ?? null,
        storeId: tokenStoreId,
        supplierId: supplier ? supplier.id : ""
      };

      const token = signJwt(tokenPayload);

      // Response payload construction
      let responseData: any = {
        token,
        user: {
          id: user.id,
          username: user.username,
          email,
          globalRole: user.globalRole,
        },
        effectiveStore: null,
        stores: [], // will fill this
        role_data: {
             role: user.globalRole === 'SUPERADMIN' ? 'SUPER_ADMIN' : (user.globalRole || "READ_ONLY"),
             user_id: user.id,
             store_id: null,
             supplier_id: null
        }
      };

      // if SUPERADMIN, bypass store checks and return global admin context
      if (user.globalRole === "SUPERADMIN") {
        responseData.user.globalRole = "SUPERADMIN";

        // EMAIL NOTIFICATION: Superadmin Sign-in
        sendMail({
          to: email,
          subject: "Security Alert: Superadmin Sign-In",
          html: getNotificationEmailTemplate(
            "New Superadmin Sign-In",
            `A new sign-in to your superadmin account occurred at ${new Date().toLocaleString()}.<br/><br/>
             IP Address: ${req.ip}<br/>
             User Agent: ${req.headers["user-agent"] || "Unknown"}`
          ),
        }).catch(e => console.error("Failed to send superadmin signin alert", e));

        return sendSuccess(res, "Signed in as Superadmin", responseData);
      }
      else if (user.globalRole === "SUPPLIER") {
        // supplier variable already fetched above
        
        responseData.user.globalRole = "SUPPLIER";
        responseData.needsStoreSetup = false;
        responseData.needsStoreSelection = false;
        responseData.supplier = supplier;
        responseData.suppliers = supplier ? [supplier] : [];
        
        if (supplier) {
            responseData.role_data.supplier_id = supplier.id;
        }
        
        // EMAIL NOTIFICATION: Supplier Sign-in
        sendMail({
          to: email,
          subject: "Security Alert: Supplier Sign-In",
          html: getNotificationEmailTemplate(
            "New Supplier Sign-In",
            `A new sign-in to your supplier account occurred at ${new Date().toLocaleString()}.<br/><br/>
             IP Address: ${req.ip}<br/>
             User Agent: ${req.headers["user-agent"] || "Unknown"}`
          ),
        }).catch(e => console.error("Failed to send supplier signin alert", e));

        return sendSuccess(res, "Signed in as Supplier", responseData);
      }
      else {
        // stores already fetched as storesEntry
        const stores = storesEntry;

        // NO STORE → must create one
        if (stores.length === 0) {
          responseData.needsStoreSetup = true;
          return sendSuccess(res, "Signed in. Store setup required.", responseData);
        }

        // ONE STORE → use directly
        if (stores.length === 1) {
          const s = stores[0];
          responseData.effectiveStore = {
            ...s.store,
            roles: [s.role],
          };
          
          if (s.role === 'STORE_OWNER') {
              responseData.role_data.store_id = s.store.id;
          }

          // EMAIL NOTIFICATION: Sign-in
          sendMail({
            to: email,
            subject: "Security Alert: New Sign-In",
            html: getNotificationEmailTemplate(
              "New Sign-In Detected",
              `A new sign-in to your account occurred at ${new Date().toLocaleString()}.<br/><br/>
               IP Address: ${req.ip}<br/>
               User Agent: ${req.headers["user-agent"] || "Unknown"}`
            ),
          }).catch(e => console.error("Failed to send signin alert email", e));

           return sendSuccess(res, "Welcome back! You're successfully signed in.", responseData);
        }

        // (future support) MULTIPLE STORES → frontend must show switcher
        responseData.stores = stores; // maps to store names
        responseData.needsStoreSelection = true;
        
        const ownedStore = stores.find(s => s.role === 'STORE_OWNER');
        if (ownedStore) {
             responseData.role_data.store_id = ownedStore.store.id;
        }
        
        // EMAIL NOTIFICATION: New Sign-in
        sendMail({
          to: email,
          subject: "Security Alert: New Sign-In",
          html: getNotificationEmailTemplate(
            "New Sign-In Detected",
            `A new sign-in to your account occurred at ${new Date().toLocaleString()}.<br/><br/>
             IP Address: ${req.ip}<br/>
             User Agent: ${req.headers["user-agent"] || "Unknown"}`
          ),
        }).catch(e => console.error("Failed to send signin alert email", e));

        return sendSuccess(res, "Signed in. Please select a store.", responseData);
      }

    } catch (err: any) {
      next(err);
    }
  }
);

/* Verify OTP */

/**
 * POST /v1/auth/verify-otp
 * Description: Verifies the OTP sent to the user's email.
 * Headers: None
 * Body:
 *  - email: string (valid email)
 *  - otp: string (min 4 chars)
 * Responses:
 *  - 200: { message: "otp verified" }
 *  - 400: Validation failed, invalid OTP, or no OTP pending
 *  - 404: User not found
 */
router.post(
  "/verify-otp",
  verifyLimiter,
  async (req: Request, res: Response, next) => {
    try {
      const parsed = verifyOtpSchema.safeParse(req.body);
      if (!parsed.success) {
        return handleZodError(res, parsed.error);
      }
      const { otp } = parsed.data;
      const email = parsed.data.email.toLowerCase();

      const user = await findUserByEmail(email);
      if (!user) return sendError(res, "We couldn't find an account with that email address.", 404);

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
        return sendError(res, "We couldn't find a pending OTP, or it may have expired. Please request a new one.", 400);

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
        } catch (_e) { /* ignore */ }
        return sendError(res, "That code doesn't look right. Please try again.", 400);
      }

      // mark OTP as used and set user's isverified = true
      try {
        await prisma.$transaction(async (tx) => {
          await tx.otp.update({
            where: { id: otpRow.id },
            data: { used: true },
          });
          // update user verification - prefer userId from otp row if present
          await tx.user.update({
            where: { id: otpRow.userId ?? user.id },
            data: { isverified: true },
          });
        }, { timeout: 45000 });
      } catch (pErr: any) {
        console.error("Prisma mark OTP used / verify user error:", pErr);
        // if transaction failed, still respond success but warn
         return sendSuccess(res, "OTP verified (state warning: failed to persist used status)", null, 200);
      }

      // Fire notification asynchronously
      // Notification removed to prevent broadcast vulnerability (user not yet authenticated specifically)
      // notificationQueue.add("send-notification", { ... });

      // EMAIL NOTIFICATION: OTP Verified
      if (email) {
          sendMail({
            to: email,
            subject: "Security Alert: Email Verified",
            html: getNotificationEmailTemplate(
              "Email Verified Successfully",
              `Your email address was successfully verified at ${new Date().toLocaleString()}.`
            ),
          }).catch(e => console.error("Failed to send verification success email", e));
      }

      return sendSuccess(res, "OTP verified successfully");
    } catch (err: any) {
      next(err);
    }
  }
);

export default router;
