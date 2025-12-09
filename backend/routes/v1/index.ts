// routes/v1/index.ts
import { Router } from "express";

import authRouter from "./auth/auth";
import googleRouter from "./auth/google";
import storeRouter from "./store/store";
import dashboardRouter from "./dashboard/dashboard";
import suppliersGlobalRouter from "./suppliers/suppliers.global";
import supplierRequestsRouter from "./suppliers/supplierrequest";
import adminRouter from "./admin/admin";

import inventoryRouter from "./inventory/inventory";
import salesRouter from "./sales/sales";

const v1Router = Router();

v1Router.get("/", (_req, res) => {
  res.json({ version: "v1", status: "ok" });
});

v1Router.use("/auth", authRouter);
v1Router.use("/oauth/google", googleRouter);
v1Router.use("/admin", adminRouter);

v1Router.use("/dashboard", dashboardRouter);
v1Router.use("/store", storeRouter);

v1Router.use("/suppliers", suppliersGlobalRouter);
v1Router.use("/supplier-requests", supplierRequestsRouter);

import notificationRouter from "./notifications/notification";

v1Router.use("/inventory", inventoryRouter);
v1Router.use("/sales", salesRouter);
v1Router.use("/notifications", notificationRouter);

export default v1Router;
