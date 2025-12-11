
// src/lib/queue.ts
import { Queue, Worker, Job } from "bullmq";
import IORedis from "ioredis";

const url = process.env.REDIS_URL || "redis://127.0.0.1:6379";
console.log(`[Queue] Connecting to Redis at ${url.replace(/:[^:@]+@/, ":***@")}`);

const connection = new IORedis(url, {
  maxRetriesPerRequest: null,
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
