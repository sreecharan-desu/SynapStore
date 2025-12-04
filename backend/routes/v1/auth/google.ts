// src/routes/v1/google.ts
import { Router } from "express";
import { OAuth2Client } from "google-auth-library";
import { z } from "zod";
import { signJwt } from "../../../lib/auth";

import type { Request, Response } from "express";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import router from ".././auth/auth";

export const GoogleRouter = Router();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const connectionString = process.env.DATABASE_URL!;
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

// request schema
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
    // verify token with Google
    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload)
      return respond(res, 400, { error: "invalid id token payload" });

    const googleId = payload.sub; // stable Google user id
    const email = payload.email!;
    const name = payload.name ?? "";
    const picture = payload.picture ?? "";

    if (!email)
      return respond(res, 400, { error: "google account missing email" });

    // Upsert user - set emailVerified true because Google verified it
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        username: name || email.split("@")[0],
        imageUrl: picture,
        // optionally keep google id
        // add field googleId String? to schema if you want to store it
      },
      create: {
        username: name || email.split("@")[0],
        email,
        password: "", // no password for google-only users; keep empty or random
        imageUrl: picture,
        // optionally store googleId here
      },
      select: { id: true, email: true, username: true, imageUrl: true },
    });

    // sign app JWT
    const token = signJwt({
      sub: user.id,
      email: user.email,
      provider: "google",
    });

    return respond(res, 200, { token, user });
  } catch (err: any) {
    console.error("Google sign-in error:", err?.message ?? err);
    // If verification failed - bad token
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

export default router;
