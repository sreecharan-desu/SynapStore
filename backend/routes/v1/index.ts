import { Router } from "express";
import authRouter from "./auth";
const v1Router = Router();

// default v1 root
v1Router.get("/", (_req, res) => {
  res.json({ version: "v1", status: "ok" });
});

v1Router.use("/auth", authRouter);
export default v1Router;
