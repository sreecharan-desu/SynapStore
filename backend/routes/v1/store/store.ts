// src/routes/v1/store/store.ts
import { Router, Request, Response } from "express";
import prisma from "../../../lib/prisma";
import { authenticate } from "../../../middleware/authenticate";
import { z } from "zod";

import { sendMail } from "../../../lib/mailer";
import { getNotificationEmailTemplate } from "../../../lib/emailTemplates";
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


      await prisma.user.update({
        where: { id: req.user.id },
        data: { globalRole: "STORE_OWNER" },
      });
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

      // Update user's global role to STORE_OWNER if not already set (e.g., if they were just a USER)
      if (req.user.globalRole !== "SUPERADMIN") {
        await prisma.user.update({
          where: { id: req.user.id },
          data: { globalRole: "STORE_OWNER" },
        });
      }

      // usage of rawFrontendUrl (kept for consistency if needed later)
      const rawFrontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
      const frontendUrl = rawFrontendUrl.replace(/\/$/, "");

      // EMAIL NOTIFICATION: Store Created
      if (req.user.email) {
        sendMail({
          to: req.user.email,
          subject: "Your Store is Ready!",
          html: getNotificationEmailTemplate(
            "Store Created Successfully",
            `Congratulations! Your store "<strong>${store.name}</strong>" has been successfully created.<br/><br/>
             You can now access your dashboard to start managing your inventory and sales.<br/><br/>
             <a href="${frontendUrl}/stores/${store.slug}" style="background:#3b82f6;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;">Go to Dashboard</a>`
          ),
        }).catch(e => console.error("Failed to send store creation email", e));
      }

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
