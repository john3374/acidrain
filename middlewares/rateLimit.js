const buckets = new Map();

const DEFAULT_LIMIT = 10;
const DEFAULT_WINDOW_MS = 5000;
const DEFAULT_MAX_BUCKETS = 10000;

const getPositiveInteger = (value, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min) return fallback;
  return Math.min(parsed, max);
};

const getLimit = () => getPositiveInteger(process.env.RATE_LIMIT_REQUESTS, DEFAULT_LIMIT, { max: 10000 });
const getWindowMs = () => getPositiveInteger(process.env.RATE_LIMIT_WINDOW_MS, DEFAULT_WINDOW_MS, { max: 60 * 60 * 1000 });
const getMaxBuckets = () => getPositiveInteger(process.env.RATE_LIMIT_MAX_BUCKETS, DEFAULT_MAX_BUCKETS, { max: 100000 });

const getClientIp = req => {
  const forwardedFor = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return req.headers.get('cf-connecting-ip') || req.headers.get('x-real-ip') || forwardedFor || 'unknown';
};

const pruneExpiredBuckets = now => {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
};

const createHeaders = ({ limit, remaining, resetAt }) => ({
  'X-RateLimit-Limit': String(limit),
  'X-RateLimit-Remaining': String(Math.max(0, remaining)),
  'X-RateLimit-Reset': String(Math.ceil(resetAt / 1000)),
});

const rateLimit = req => {
  try {
    const key = getClientIp(req);
    const now = Date.now();
    const limit = getLimit();
    const windowMs = getWindowMs();

    if (buckets.size > getMaxBuckets()) pruneExpiredBuckets(now);

    const current = buckets.get(key);

    if (!current || current.resetAt <= now) {
      const resetAt = now + windowMs;
      buckets.set(key, { count: 1, resetAt });
      return { limited: false, headers: createHeaders({ limit, remaining: limit - 1, resetAt }) };
    }

    current.count += 1;
    buckets.set(key, current);

    const remaining = limit - current.count;
    const headers = createHeaders({ limit, remaining, resetAt: current.resetAt });

    if (current.count > limit) {
      return {
        limited: true,
        headers: {
          ...headers,
          'Retry-After': String(Math.ceil((current.resetAt - now) / 1000)),
        },
      };
    }

    return { limited: false, headers };
  } catch (e) {
    console.log(e);
    return { limited: true, headers: { 'Retry-After': '5' } };
  }
};

export default rateLimit;
