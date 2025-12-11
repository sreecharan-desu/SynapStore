import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import v1Router from "./routes/v1";
import "./worker/notificationworker"; // Start worker in the same process

const app = express();

app.use(express.json({ limit: "10mb" }));

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  })
);

app.use("/api/v1", v1Router);

app.get("/health", async (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.get("/", (_req, res) => {
  res.send("Hello from backend");
});

app.use((err: any, _req: any, res: any, _next: any) => {
  console.error("Global error:", err);

  if (err?.code && typeof err.code === "string") {
    return res.status(502).json({ error: "database error", code: err.code });
  }

  if (err?.name === "ZodError") {
    return res.status(400).json({
      error: "validation failed",
      details: err.errors,
    });
  }

  return res.status(500).json({ error: "unexpected server error" });
});

export default app;
