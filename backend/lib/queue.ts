
// src/lib/queue.ts
import { Queue, Worker, Job } from "bullmq";
import IORedis from "ioredis";

const url = process.env.REDIS_URL || "redis://127.0.0.1:6379";
console.log(`[Queue] Connecting to Redis at ${url.replace(/:[^:@]+@/, ":***@")}`);

const connection = new IORedis(url, {
  maxRetriesPerRequest: null,
  connectTimeout: 20000, // 20s - increased to fail less aggressively
  keepAlive: 10000, 
  family: 4, // Force IPv4 to avoid IPv6 timeouts
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  reconnectOnError(err) {
    const targetError = "READONLY";
    if (err.message.includes(targetError)) {
      // Only reconnect when the error starts with "READONLY"
      return true;
    }
    return false;
  },
});

connection.on("error", (err) => {
  console.error("[Redis] Connection Error:", err.message);
});

connection.on("connect", () => {
  console.log("[Redis] Connected successfully");
});

export function getConnection() {
  return connection;
}

// create queue
export const notificationQueue = new Queue("notifications", {
  connection,
});

// create worker factory
export function createWorker(
  processor: (job: Job) => Promise<void>,
  concurrency = 5
) {
  return new Worker("notifications", async (job) => processor(job), {
    connection,
    concurrency,
  });
}
