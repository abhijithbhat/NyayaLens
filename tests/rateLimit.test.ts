import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { checkRateLimit, rateLimitResponse, resetRateLimits } from '@/lib/rateLimit';

describe('In-Memory Sliding-Window Rate Limiter', () => {
  beforeEach(() => {
    resetRateLimits();
  });

  function createMockRequest(ip: string = '192.168.1.100'): NextRequest {
    return new NextRequest('http://localhost:3000/api/parse', {
      method: 'POST',
      headers: {
        'x-forwarded-for': ip,
      },
    });
  }

  it('allows requests within the 10 req/min limit', () => {
    const req = createMockRequest();
    for (let i = 1; i <= 10; i++) {
      const res = checkRateLimit(req, { limit: 10, windowMs: 60000 });
      expect(res.allowed).toBe(true);
      expect(res.remaining).toBe(10 - i);
    }
  });

  it('rejects the 11th request with 429 Too Many Requests', async () => {
    const req = createMockRequest();
    for (let i = 1; i <= 10; i++) {
      checkRateLimit(req, { limit: 10, windowMs: 60000 });
    }

    const limitExceeded = checkRateLimit(req, { limit: 10, windowMs: 60000 });
    expect(limitExceeded.allowed).toBe(false);
    expect(limitExceeded.remaining).toBe(0);

    const response = rateLimitResponse(limitExceeded);
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBeDefined();
    expect(response.headers.get('X-RateLimit-Limit')).toBe('10');
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');

    const json = await response.json();
    console.log('\n[RATE LIMIT TEST] 11th Request Result:');
    console.log('HTTP Status:', response.status);
    console.log('Headers:', {
      'Retry-After': response.headers.get('Retry-After'),
      'X-RateLimit-Limit': response.headers.get('X-RateLimit-Limit'),
      'X-RateLimit-Remaining': response.headers.get('X-RateLimit-Remaining'),
    });
    console.log('Response Body:', json);

    expect(json.status).toBe('error');
    expect(json.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(json.message).toContain('Rate limit exceeded');
  });

  it('tracks distinct client IPs independently', () => {
    const reqA = createMockRequest('10.0.0.1');
    const reqB = createMockRequest('10.0.0.2');

    // Saturate IP A
    for (let i = 1; i <= 10; i++) {
      checkRateLimit(reqA, { limit: 10, windowMs: 60000 });
    }
    expect(checkRateLimit(reqA, { limit: 10, windowMs: 60000 }).allowed).toBe(false);

    // IP B is still allowed
    const resB = checkRateLimit(reqB, { limit: 10, windowMs: 60000 });
    expect(resB.allowed).toBe(true);
    expect(resB.remaining).toBe(9);
  });
});
