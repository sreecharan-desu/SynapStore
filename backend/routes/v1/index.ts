// routes/v1/index.ts
import { Router } from "express";

import authRouter from "./auth/email-auth";
import googleRouter from "./auth/google";
import storeRouter from "./store/store";
import dashboardRouter from "./dashboard/dashboard";
import supplierRequestsRouter from "./suppliers/supplier";
import adminRouter from "./admin/admin";


const v1Router = Router();

/**
 * GET /v1
 * Description: Health check and version info.
 * Headers: None
 * Body: None
 * Responses:
 *  - 200: { version: "v1", status: "ok" }
 */
import { sendSuccess } from "../../lib/api";

v1Router.get("/", (_req, res) => {
  return sendSuccess(res, "API V1 Health Check", { version: "v1", status: "ok" });
});


v1Router.use("/auth", authRouter);
v1Router.use("/oauth/google", googleRouter);

v1Router.use("/admin", adminRouter);

v1Router.use("/dashboard", dashboardRouter);
v1Router.use("/store", storeRouter);

v1Router.use("/supplier-requests", supplierRequestsRouter);

export default v1Router;
