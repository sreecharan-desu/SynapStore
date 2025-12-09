// src/routes/v1/store/store.ts
import { Router, Request, Response } from "express";
import prisma from "../../../lib/prisma";
import { authenticate } from "../../../middleware/authenticate";
import { z } from "zod";

const Storerouter = Router();

// Schema for store creation
const createStoreSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2),
  timezone: z.string().optional(),
  currency: z.string().optional(),
});

Storerouter.post(
  "/create",
  authenticate,
  async (req: Request & { user?: any }, res: Response) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: "unauthenticated" });
      }

      const parsed = createStoreSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "validation failed",
          details: parsed.error.issues,
        });
      }

      const {
        name,
        slug,
        timezone = "Asia/Kolkata",
        currency = "INR",
      } = parsed.data;


      if (await prisma.store.findUnique({ where: { slug } })) {
        return res.status(400).json({ error: "store already exists" ,success: false});
      }

      // 1) Create store
      const store = await prisma.store.create({
        data: {
          name,
          slug,
          timezone,
          currency,
        },
        select: {
          id: true,
          name: true,
          slug: true,
          timezone: true,
          currency: true,
          settings: true,
        },
      });

      // 2) Assign user as STORE_OWNER
      await prisma.userStoreRole.create({
        data: {
          userId: req.user.id,
          storeId: store.id,
          role: "STORE_OWNER",
        },
      });

      // 3) Return effectiveStore for dashboard boot
      return res.status(201).json({
        success: true,
        message: "store created",
        effectiveStore: {
          ...store,
          roles: ["STORE_OWNER"],
        },
      });
    } catch (err) {
      console.error("Create store error:", err);
      return res.status(500).json({ error: "internal_server_error" });
    }
  }
);

export default Storerouter;
