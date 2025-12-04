// src/middleware/rateLimiter.ts
import { Request, Response, NextFunction } from "express";

type RateOptions = {
  keyPrefix: string; // unique name for limiter, e.g., "resend-email"
  windowMs?: number; // time window in ms (default 60s)
  max?: number; // max requests in window (default 5)
  burstWindowMs?: number | null; // optional larger window for burst limiting (e.g., 1 hour)
  burstMax?: number | null; // max in burst window
  keyGenerator?: (req: Request) => string | null; // default uses IP
  skip?: (req: Request) => boolean; // optionally skip limiter
};

const DEFAULT_WINDOW_MS = 60 * 1000; // 1 minute
const DEFAULT_MAX = 5;

// internal memory store
const memoryStore = new Map<
  string,
  { count: number; resetAt: number; burstCount?: number; burstResetAt?: number }
>();

function secondsUntil(timestampMs: number) {
  return Math.max(0, Math.ceil((timestampMs - Date.now()) / 1000));
}

export function rateLimiter(options: RateOptions) {
  const {
    keyPrefix,
    windowMs = DEFAULT_WINDOW_MS,
    max = DEFAULT_MAX,
    burstWindowMs = null,
    burstMax = null,
    keyGenerator,
    skip,
  } = options;

  const prefix = `rl:${keyPrefix}:`;

  function checkMemory(key: string) {
    const memKey = `${prefix}${key}`;
    const now = Date.now();
    let entry = memoryStore.get(memKey);

    if (!entry || entry.resetAt <= now) {
      entry = { count: 1, resetAt: now + windowMs };
      if (burstWindowMs && burstMax) {
        entry.burstCount = 1;
        entry.burstResetAt = now + burstWindowMs;
      }
      memoryStore.set(memKey, entry);
      return {
        count: entry.count,
        ttl: entry.resetAt - now,
        remaining: Math.max(0, max - 1),
        burst: entry.burstCount ?? 0,
        burstTtl: entry.burstResetAt ? entry.burstResetAt - now : 0,
        burstRemaining: burstMax
          ? Math.max(0, (burstMax || 0) - (entry.burstCount || 0))
          : null,
      };
    }

    entry.count += 1;
    if (burstWindowMs && burstMax) {
      if (!entry.burstResetAt || entry.burstResetAt <= now) {
        entry.burstCount = 1;
        entry.burstResetAt = now + burstWindowMs;
      } else {
        entry.burstCount = (entry.burstCount || 0) + 1;
      }
    }
    memoryStore.set(memKey, entry);

    const ttl = entry.resetAt - now;
    return {
      count: entry.count,
      ttl,
      remaining: Math.max(0, max - entry.count),
      burst: entry.burstCount ?? 0,
      burstTtl: entry.burstResetAt ? entry.burstResetAt - now : 0,
      burstRemaining: burstMax
        ? Math.max(0, (burstMax || 0) - (entry.burstCount || 0))
        : null,
    };
  }

  return function limiter(req: Request, res: Response, next: NextFunction) {
    try {
      if (skip && skip(req)) return next();

      const rawKey = keyGenerator
        ? keyGenerator(req)
        : req.ip || req.socket.remoteAddress || "";
      const key = String(rawKey || "")
        .toLowerCase()
        .trim();
      if (!key) {
        // nothing to key on, allow through
        return next();
      }

      const primary = checkMemory(key);

      // primary window check
      if (primary.count > max) {
        const retryAfter = secondsUntil(Date.now() + primary.ttl);
        res.setHeader("Retry-After", String(retryAfter));
        return res.status(429).json({ error: "too many requests", retryAfter });
      }

      // optional burst window check
      if (burstWindowMs && burstMax && typeof primary.burst === "number") {
        if ((primary.burst || 0) > (burstMax || 0)) {
          const retryAfter = secondsUntil(Date.now() + (primary.burstTtl || 0));
          res.setHeader("Retry-After", String(retryAfter));
          return res
            .status(429)
            .json({ error: "rate limit exceeded (burst)", retryAfter });
        }
      }

      return next();
    } catch (err) {
      // if limiter throws, fail open but log server side
      console.error("Rate limiter error:", err);
      return next();
    }
  };
}

export default rateLimiter;
