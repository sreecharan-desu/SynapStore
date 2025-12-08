// routes/v1/index.ts

import { Router } from "express";

import authRouter from "./auth/auth";
import googleRouter from "./auth/google";
import dashboardRouter from "./dashboard/dashboard";

import medicinesRouter from "./medicines/medicines";
import inventoryRouter from "./inventory/inventory";
import stockMovementsRouter from "./stock/stockMovements";
import uploadsRouter from "./uploads/uploads";

import suppliersRouter from "./suppliers/suppliers";
import reordersRouter from "./reorders/reorders";
import notificationsRouter from "./notifications/notifications";
import webhooksRouter from "./webhooks/webhooks";

import adminRouter from "./admin/admin";
import patientsRouter from "./patients/patients";
import prescriptionsRouter from "./prescriptions/prescriptions";
import StoreRouter from "./store/store";
import UserStoreRouter from "./store/stores.user";

const v1Router = Router();

/* Root */
v1Router.get("/", (_req, res) => {
  res.json({ version: "v1", status: "ok" });
});

/* Auth */
v1Router.use("/auth", authRouter);
v1Router.use("/oauth/google", googleRouter);

/* Dashboard */
v1Router.use("/dashboard", dashboardRouter);

/* Core domain modules */
v1Router.use("/medicines", medicinesRouter);
v1Router.use("/stores", inventoryRouter);
v1Router.use("/stock-movements", stockMovementsRouter);
v1Router.use("/uploads", uploadsRouter);

/* Suppliers & reorders */
v1Router.use("/suppliers", suppliersRouter);
v1Router.use("/reorders", reordersRouter);

// Stores
v1Router.use("/stores", StoreRouter);
v1Router.use("/store", UserStoreRouter);

/* Notifications */
v1Router.use("/notifications", notificationsRouter);

/* Webhooks */
v1Router.use("/webhooks", webhooksRouter);

/* Admin */
v1Router.use("/admin", adminRouter);

/* Healthcare domain */
v1Router.use("/patients", patientsRouter);
v1Router.use("/prescriptions", prescriptionsRouter);

export default v1Router;
