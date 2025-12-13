
// src/lib/queue.ts
import { Queue, Worker, Job } from "bullmq";
import IORedis from "ioredis";

// Lazy connection manager
let _connection: IORedis | null = null;
let _queue: Queue | null = null;

function getRedisConnection() {
  if (!_connection) {
    const url = process.env.REDIS_URL || "redis://127.0.0.1:6379";
    console.log(`[Queue] Connecting to Redis at ${url.replace(/:[^:@]+@/, ":***@")}`);
    _connection = new IORedis(url, {
      maxRetriesPerRequest: null,
      connectTimeout: 20000,
      keepAlive: 10000,
      family: 4,
      retryStrategy(times) {
        return Math.min(times * 50, 2000);
      },
      lazyConnect: true, // Only connect on first command
    });
    
    _connection.on("error", (err) => {
        console.error("[Redis] Connection Error:", err.message);
    });
    _connection.on("connect", () => {
        console.log("[Redis] Connected successfully");
    });
  }
  return _connection;
}

export function getConnection() {
  return getRedisConnection();
}

// Lazy Queue wrapper
export const notificationQueue = {
  add: async (name: string, data: any, opts?: any) => {
    if (!_queue) {
      _queue = new Queue("notifications", { connection: getRedisConnection() });
    }
    return _queue.add(name, data, opts);
  },
  // Proxy other methods if used? Currently mostly 'add' is used.
  // Helper to close if needed
  close: async () => {
    if (_queue) await _queue.close();
    if (_connection) await _connection.quit();
  }
};


// create worker factory
export function createWorker(
  processor: (job: Job) => Promise<void>,
  concurrency = 5
) {
  return new Worker("notifications", async (job) => processor(job), {
    connection: getRedisConnection(),
    concurrency,
  });
}

