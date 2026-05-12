import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
})

export const rateLimits = {
  free: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, '1 h'),
    prefix: 'refract:free',
  }),
  pro: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(200, '1 h'),
    prefix: 'refract:pro',
  }),
  team: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(1000, '1 h'),
    prefix: 'refract:team',
  }),
  enterprise: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10000, '1 h'),
    prefix: 'refract:enterprise',
  }),
}

export async function checkRateLimit(userId: string, plan: string) {
  const limiter = rateLimits[plan as keyof typeof rateLimits] ?? rateLimits.free
  return limiter.limit(userId)
}

export function applyRateLimitHeaders(
  res: { setHeader: (name: string, value: number | string) => void },
  limitResult: { limit: number; remaining: number; reset: number }
) {
  res.setHeader('X-RateLimit-Limit', limitResult.limit)
  res.setHeader('X-RateLimit-Remaining', limitResult.remaining)
  res.setHeader('X-RateLimit-Reset', limitResult.reset)
}
