// src/routes/v1/google.ts
import { Router } from "express";
import { OAuth2Client } from "google-auth-library";
import { z } from "zod";
import { signJwt } from "../../../lib/auth";
import type { Request, Response } from "express";
import prisma from "../../../lib/prisma";
import { crypto$ } from "../../../lib/crypto";

const GoogleRouter = Router();
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/* request schema */
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

    const email = payload.email;
    const name = payload.name ?? "";
    const picture = payload.picture ?? "";

    if (!email)
      return respond(res, 400, { error: "google account missing email" });

    // encrypt fields for DB usage
    const encEmail = crypto$.encryptCellDeterministic(email);
    const usernamePlain = name || email.split("@")[0];
    const encUsername = crypto$.encryptCellDeterministic(usernamePlain);
    const encImage = picture ? crypto$.encryptCell(picture) : null;

    // upsert user using encrypted email for lookup
    const userRow = await prisma.user.upsert({
      where: { email: encEmail },
      update: {
        username: encUsername,
        imageUrl: encImage ?? undefined,
      },
      create: {
        username: encUsername,
        email: encEmail,
        passwordHash: null,
        imageUrl: encImage ?? undefined,
      },
      select: { id: true, email: true, username: true, imageUrl: true },
    });

    // decrypt encrypted fields before returning
    const decrypted = crypto$.decryptObject(userRow, [
      "username",
      "email",
      "imageUrl",
    ]) as any;

    // sign app JWT with decrypted email
    const token = signJwt({
      sub: decrypted.id,
      email: decrypted.email,
      provider: "google",
    });

    return respond(res, 200, { token, user: decrypted });
  } catch (err: any) {
    console.error("Google sign-in error:", err?.message ?? err);

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

export default GoogleRouter;
