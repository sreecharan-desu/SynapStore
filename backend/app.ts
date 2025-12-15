import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import compression from "compression";
import v1Router from "./routes/v1";
import { sendError, sendSuccess, sendInternalError } from "./lib/api";
import { Request, Response } from "express";
import { sendMail } from "./lib/mailer";

const app = express();

app.use(compression());
app.use(express.json({ limit: "10mb" }));

// Prettify Logs Middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const color = status >= 500 ? "\x1b[31m" : status >= 400 ? "\x1b[33m" : status >= 300 ? "\x1b[36m" : "\x1b[32m";
    const reset = "\x1b[0m";
    console.log(`${color}[${req.method}] ${req.originalUrl} ${status}${reset} - ${duration}ms`);
  });
  next();
});

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    exposedHeaders: ["x-sale-id", "content-disposition"],
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
