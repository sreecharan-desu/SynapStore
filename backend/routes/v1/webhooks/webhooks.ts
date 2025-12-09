// src/routes/v1/webhooks.ts
import { Router } from "express";
import prisma from "../../../lib/prisma";
import { authenticate } from "../../../middleware/authenticate";
import {
  storeContext,
  requireStore,
  RequestWithUser,
} from "../../../middleware/store";
import { z } from "zod";
import { deliverWebhook } from "../../../adapters/webhookAdapter"; // adjust path

const router = Router();

const registrationSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  secret: z.string().optional(),
  events: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

router.post(
  "/",
  authenticate,
  storeContext,
  requireStore,
  async (req: RequestWithUser, res) => {
    const parsed = registrationSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "invalid" });

    const row = await prisma.webhookRegistration.create({
      data: {
        storeId: req.store!.id,
        name: parsed.data.name,
        url: parsed.data.url,
        secret: parsed.data.secret ?? null,
        events: parsed.data.events ?? [],
        isActive: parsed.data.isActive ?? true,
      },
    });
    res.json({ success: true, webhook: row });
  }
);

router.post(
  "/:id/test",
  authenticate,
  storeContext,
  requireStore,
  async (req: RequestWithUser, res) => {
    const id = req.params.id;
    const wh = await prisma.webhookRegistration.findUnique({
      where: { id, storeId: req.store!.id },
    });
    if (!wh) return res.status(404).json({ error: "not found" });
    const envelope = {
      event: "test",
      id: `test-${Date.now()}`,
      storeId: req.store!.id,
      ts: new Date().toISOString(),
      actor: { id: req.user!.id },
      payload: { test: true },
    };
    try {
      const resp = await deliverWebhook(wh.url, wh.secret ?? null, envelope);
      return res.json({ success: true, response: resp });
    } catch (err: any) {
      return res
        .status(502)
        .json({ success: false, error: String(err?.message ?? err) });
    }
  }
);

export default router;
