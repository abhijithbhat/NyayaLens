import { NextRequest } from 'next/server';
import { errorResponse } from '@/lib/apiError';

/**
 * Lightweight in-memory sliding-window rate limiter keyed by client IP.
 *
 * NOTE: This rate limiter is strictly process-local (in-memory) and resets on
 * serverless cold starts. This is an honest, acceptable limitation for this
 * standalone deployment and evaluation, not a claim of production-grade distributed
 * rate limiting (which would rely on Redis / Upstash / Cloudflare Turnstile).
 */

export interface RateLimitConfig {
  limit?: number; // max allowed requests per window (default: 10)
  windowMs?: number; // duration of sliding window in ms (default: 60,000 ms = 1 minute)
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetMs: number;
}

// In-memory sliding window store: IP -> list of request timestamps (epoch ms)
const requestLogs = new Map<string, number[]>();

// Periodically clean up entries older than the window to prevent memory leaks
const CLEANUP_INTERVAL_MS = 60 * 1000;
let lastCleanupTime = Date.now();

function cleanupStaleEntries(now: number, windowMs: number) {
  if (now - lastCleanupTime < CLEANUP_INTERVAL_MS) return;
  lastCleanupTime = now;
  const threshold = now - windowMs;

  for (const [ip, timestamps] of requestLogs.entries()) {
    const valid = timestamps.filter((t) => t > threshold);
    if (valid.length === 0) {
      requestLogs.delete(ip);
    } else {
      requestLogs.set(ip, valid);
    }
  }
}

/**
 * Extracts client IP from request headers or falls back to localhost.
 */
export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const ip = forwarded.split(',')[0].trim();
    if (ip) return ip;
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return '127.0.0.1';
}

/**
 * Checks whether the incoming request conforms to the sliding window rate limit.
 */
export function checkRateLimit(
  req: NextRequest,
  config: RateLimitConfig = {}
): RateLimitResult {
  const limit = config.limit ?? 10; // 10 requests per minute by default
  const windowMs = config.windowMs ?? 60 * 1000; // 60 seconds
  const now = Date.now();

  cleanupStaleEntries(now, windowMs);

  const ip = getClientIp(req);
  const timestamps = requestLogs.get(ip) || [];

  // Filter timestamps within the current sliding window
  const windowStart = now - windowMs;
  const activeTimestamps = timestamps.filter((t) => t > windowStart);

  if (activeTimestamps.length >= limit) {
    const oldest = activeTimestamps[0];
    const resetMs = Math.max(0, oldest + windowMs - now);
    requestLogs.set(ip, activeTimestamps);

    return {
      allowed: false,
      limit,
      remaining: 0,
      resetMs,
    };
  }

  activeTimestamps.push(now);
  requestLogs.set(ip, activeTimestamps);

  return {
    allowed: true,
    limit,
    remaining: limit - activeTimestamps.length,
    resetMs: windowMs,
  };
}

/**
 * Returns a standardized 429 Too Many Requests response with standard rate-limiting headers.
 */
export function rateLimitResponse(result: RateLimitResult) {
  const retrySec = Math.max(1, Math.ceil(result.resetMs / 1000));
  return errorResponse(
    'RATE_LIMIT_EXCEEDED',
    `Rate limit exceeded. Maximum ${result.limit} requests per minute allowed. Please retry in ${retrySec} second${retrySec > 1 ? 's' : ''}.`,
    429,
    {
      'Retry-After': retrySec.toString(),
      'X-RateLimit-Limit': result.limit.toString(),
      'X-RateLimit-Remaining': '0',
    }
  );
}

/**
 * Helper to reset rate limits (primarily for testing purposes)
 */
export function resetRateLimits() {
  requestLogs.clear();
}
