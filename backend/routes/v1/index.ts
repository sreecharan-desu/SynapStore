// routes/v1/index.ts
import { Router } from "express";

import authRouter from "./auth/auth";
import googleRouter from "./auth/google";
import storeRouter from "./store/store";
import dashboardRouter from "./dashboard/dashboard";
import suppliersGlobalRouter from "./suppliers/suppliers.global";
import supplierRequestsRouter from "./suppliers/supplierrequest";

const v1Router = Router();

v1Router.get("/", (_req, res) => {
  res.json({ version: "v1", status: "ok" });
});

v1Router.use("/auth", authRouter);
v1Router.use("/oauth/google", googleRouter);

v1Router.use("/dashboard", dashboardRouter);
v1Router.use("/store", storeRouter);

v1Router.use("/suppliers", suppliersGlobalRouter);
v1Router.use("/supplier-requests", supplierRequestsRouter);

export default v1Router;
