import { describe, expect, test } from 'vitest';

import rateLimit from './rateLimit.js';

const request = headers => ({ headers: new Headers(headers) });

describe('rateLimit', () => {
  test('limits by the X-Real-IP that nginx sets', () => {
    const results = Array.from({ length: 12 }, () => rateLimit(request({ 'x-real-ip': '198.51.100.20' })));
    expect(results.filter(r => r.limited)).toHaveLength(2);
  });

  test('ignores client-supplied CF-Connecting-IP and X-Forwarded-For', () => {
    const results = Array.from({ length: 12 }, (_, i) =>
      rateLimit(request({ 'x-real-ip': '198.51.100.21', 'cf-connecting-ip': `spoof-${i}`, 'x-forwarded-for': `spoof-${i}` }))
    );
    expect(results.filter(r => r.limited)).toHaveLength(2);
  });
});
