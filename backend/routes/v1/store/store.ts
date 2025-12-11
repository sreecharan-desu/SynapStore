// src/routes/v1/store/store.ts
import { Router, Request, Response } from "express";
import prisma from "../../../lib/prisma";
import { authenticate } from "../../../middleware/authenticate";
import { z } from "zod";

import { sendSuccess, sendError, handleZodError, handlePrismaError, sendInternalError } from "../../../lib/api";
import { notificationQueue } from "../../../lib/queue";
import { sendNotification } from "../../../lib/notification";

const Storerouter = Router();

// Schema for store creation
const createStoreSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2),
  timezone: z.string().optional(),
  currency: z.string().optional(),
});

/**
 * POST /v1/store/create
 * Description: Creates a new store for the authenticated user.
 * Headers: 
 *  - Authorization: Bearer <token>
 * Body:
 *  - name: string (min 2 chars)
 *  - slug: string (min 2 chars)
 *  - timezone: string (optional, default: Asia/Kolkata)
 *  - currency: string (optional, default: INR)
 * Responses:
 *  - 201: { success: true, message: "store created", effectiveStore: { ... } }
 *  - 400: Validation failed or store already exists
 *  - 401: Unauthenticated
 *  - 500: Internal server error
 */
Storerouter.post(
  "/create",
  authenticate,
  async (req: Request & { user?: any }, res: Response) => {
    try {
      if (!req.user?.id) {
        return sendError(res, "Unauthenticated", 401);
      }

      const parsed = createStoreSchema.safeParse(req.body);
      if (!parsed.success) return handleZodError(res, parsed.error);

      const {
        name,
        slug,
        timezone = "Asia/Kolkata",
        currency = "INR",
      } = parsed.data;


      if (await prisma.store.findUnique({ where: { slug } })) {
        return sendError(res, "Store already exists", 409, { code: "store_exists" });
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

      // Fire notification
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
      notificationQueue.add("send-notification", {
        websiteUrl: frontendUrl,
        title: "Store Created",
        message: `Your store "${store.name}" is ready!`,
        buttons: [{ label: "Go to Store", link: `${frontendUrl}/stores/${store.slug}` }]
      });

      // 3) Return effectiveStore for dashboard boot
      return sendSuccess(res, "Store created successfully", {
        effectiveStore: {
          ...store,
          roles: ["STORE_OWNER"],
        },
      }, 201);
    } catch (err: any) {
      if (err.code === "P2002") {
        return sendError(res, "Store with this slug already exists", 409, { code: "store_exists" });
      }
      return sendInternalError(res, err, "Failed to create store");
    }
  }
);

export default Storerouter;
