
import { Router } from "express";
import prisma from "../../lib/prisma";
import { verifyJwt } from "../../lib/auth";
import { authenticate } from "../../middleware/authenticate";
import { requireRole } from "../../middleware/requireRole";
import { sendSuccess, sendError, sendInternalError } from "../../lib/api";
import { notificationQueue } from "../../lib/queue";

const router = Router();

// Middleware to extract user if present, but proceed if not (Anonymous subscribe)
const authenticateOptional = async (req: any, res: any, next: any) => {
    try {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith("Bearer ")) {
            const token = authHeader.split(" ")[1];
            try {
                const decoded: any = verifyJwt(token);
                if (decoded && decoded.sub) {
                    req.user = { id: decoded.sub };
                    // We could fetch full user here if needed, but ID is enough for subscription mapping
                }
            } catch (e) {
                // Ignore invalid token for optional auth
            }
        }
        next();
    } catch (e) {
        next();
    }
};

/**
 * GET /v1/notifications/vapid-key
 * Get Public VAPID Key for client subscription
 */
router.get("/vapid-key", (req: any, res: any) => {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    if (!publicKey) return sendError(res, "VAPID key not configured", 500);
    return sendSuccess(res, "VAPID Key", { publicKey });
});

/**
 * POST /v1/notifications/subscribe
 * Subscribe a client (browser) to push notifications
 */
router.post("/subscribe", authenticateOptional, async (req: any, res) => {
    // PushSubscription model is missing in schema. 
    // This functionality is temporarily disabled or moved to notification microservice.
    return sendSuccess(res, "Push subscription placeholder (not active)");
});

/**
 * POST /v1/notifications/unsubscribe
 */
router.post("/unsubscribe", async (req: any, res) => {
    // PushSubscription model is missing in schema.
    return sendSuccess(res, "Unsubscribed successfully (placeholder)");
});

/**
 * POST /v1/notifications/send
 * ADMIN/INTERNAL ONLY
 * Send a targeted notification via the worker
 */
router.post("/send", authenticate, requireRole("SUPERADMIN"), async (req: any, res) => {
    try {
        const { type, title, message, target, url } = req.body;

        if (!title || !message) return sendError(res, "Missing title or message", 400);

        // Enqueue job for worker to handle distribution
        await notificationQueue.add("send-notification", {
            type: type || "custom",
            title,
            message,
            target, // { userId?, storeId?, supplierId?, storeSlug?, supplierSlug? }
            url
        });

        return sendSuccess(res, "Notification enqueued");

    } catch (err) {
        return sendInternalError(res, err, "Failed to enqueue notification");
    }
});

export default router;
