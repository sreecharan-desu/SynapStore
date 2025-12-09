// src/server.ts
import express from "express";
import http from "http";
import v1Router from "./routes/v1/index";
import { initSocket } from "./realtime/socket";
import { setIo } from "./worker/socketSingleton";
import { notificationQueue } from "./lib/queue";
import { worker } from "./worker/notificationworker";

const app = express();
app.use(express.json());
app.use("/v1", v1Router);

const server = http.createServer(app);
const io = initSocket(server);
setIo(io);

// start queue scheduler and worker
notificationQueue
  .waitUntilReady()
  .catch((err) => console.error("scheduler", err));
worker.waitUntilReady?.().catch(() => {});

// start http
const PORT = Number(process.env.PORT ?? 3000);
server.listen(PORT, () => console.log(`listening on ${PORT}`));
