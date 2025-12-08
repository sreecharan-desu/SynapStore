// routes/v1/index.ts
import { Router } from "express";

import authRouter from "./auth/auth";
import googleRouter from "./auth/google";
import storeRouter from "./store/store";
import dashboardRouter from "./dashboard/dashboard";
import inventoryRouter from "./inventory/inventory";

const v1Router = Router();

v1Router.get("/", (_req, res) => {
  res.json({ version: "v1", status: "ok" });
});

v1Router.use("/auth", authRouter);
v1Router.use("/oauth/google", googleRouter);

v1Router.use("/dashboard", dashboardRouter);
// newly added
v1Router.use("/store", storeRouter);

v1Router.use("/inventory", inventoryRouter);

export default v1Router;
