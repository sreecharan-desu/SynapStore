import { Router } from "express";
import authRouter from "./auth/auth";
import googleRouter from "./auth/google";

const v1Router = Router();

// default v1 root
v1Router.get("/", (_req, res) => {
  res.json({ version: "v1", status: "ok" });
});

// mount auth and google endpoints
v1Router.use("/auth", authRouter);
v1Router.use("/auth/google", googleRouter);

export default v1Router;
