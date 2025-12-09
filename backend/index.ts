import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import v1Router from "./routes/v1";

dotenv.config();

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

// Graceful shutdown
const shutdown = () => {
  console.log("Shutting down server...");
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// Start server
const PORT = Number(process.env.PORT) || 3000;
import { ensureAdmin } from "./lib/init-admin";

ensureAdmin().then(() => {
  app.listen(PORT, () => {
    console.log(`Listening on port ${PORT}`);
  });
});
