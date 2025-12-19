import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import compression from "compression";
import helmet from "helmet";
import hpp from "hpp";
// @ts-ignore
import xss from "xss-clean";
import v1Router from "./routes/v1";


const app = express();

app.use(helmet());
app.use(xss());
app.use(hpp());
app.use(compression());
app.use(compression({
  level: 6, // Balance speed and size
  threshold: 0, // Compress everything
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  }
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Prettify Logs Middleware
// Prettify Logs Middleware - Hacker/Sreecharan Vibe
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    
    // ANSI Colors & Styles
    const reset = "\x1b[0m";
    const bright = "\x1b[1m";
    const dim = "\x1b[2m";
    const green = "\x1b[32m";
    const red = "\x1b[31m";
    const yellow = "\x1b[33m";
    const cyan = "\x1b[36m";
    const magenta = "\x1b[35m";
    const blue = "\x1b[34m";

    let statusColor = green;
    let icon = "ACCESS_GRANTED";
    
    if (status >= 500) { 
        statusColor = red; 
        icon = "SYSTEM_FAILURE"; 
    } else if (status >= 400) { 
        statusColor = yellow; 
        icon = "ACCESS_DENIED"; 
    } else if (status >= 300) { 
        statusColor = cyan; 
        icon = "REDIRECT"; 
    }

    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    const method = req.method.padEnd(7); // Alignment

    console.log(
      `${dim}[${timestamp}]${reset} ${bright}${cyan}[SREECHARAN_SYS]${reset} ` +
      `${magenta}::${reset} ${blue}${method}${reset} ` +
      `${req.originalUrl} ${dim}>>${reset} ${statusColor}${status} ${icon}${reset} ` +
      `${dim}[${duration}ms]${reset}`
    );
  });
  next();
});

const allowedOrigins = [process.env.FRONTEND_URL || "http://localhost:5173", "https://synapstore.me", "https://www.synapstore.me"];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) === -1) {
        // If strict mode is problematic in dev, allow localhost
        if (process.env.NODE_ENV !== 'production') {
          return callback(null, true);
        }
        const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
        return callback(new Error(msg), false);
      }
      return callback(null, true);
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    exposedHeaders: ["x-sale-id", "content-disposition"],
    credentials: true
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
