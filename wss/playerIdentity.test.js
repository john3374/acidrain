import { describe, expect, test, vi } from 'vitest';
import { encode } from 'next-auth/jwt';
import { getSessionToken, resolvePlayerId } from './playerIdentity.js';

const SECRET = 'test-secret-for-player-identity';
const PLAYER_ID = '64f1c2d3e4a5b6c7d8e9f0a1';
const OTHER_PLAYER_ID = 'a1b2c3d4e5f6a7b8c9d0e1f2';

const quietLogger = { warn: vi.fn(), log: vi.fn(), error: vi.fn() };

const makeToken = (claims = { id: PLAYER_ID }, secret = SECRET) => encode({ token: claims, secret });

describe('getSessionToken', () => {
  test('returns null without a cookie header', () => {
    expect(getSessionToken(undefined)).toBeNull();
    expect(getSessionToken('')).toBeNull();
    expect(getSessionToken('other=1; foo=bar')).toBeNull();
  });

  test('reads the plain session cookie', () => {
    expect(getSessionToken('foo=bar; next-auth.session-token=abc; x=y')).toBe('abc');
  });

  test('prefers the __Secure- cookie', () => {
    expect(getSessionToken('next-auth.session-token=plain; __Secure-next-auth.session-token=secure')).toBe('secure');
  });

  test('joins chunked session cookies in order', () => {
    expect(getSessionToken('next-auth.session-token.1=cd; next-auth.session-token.0=ab')).toBe('abcd');
  });

  test('ignores an incomplete chunked cookie', () => {
    expect(getSessionToken('next-auth.session-token.1=cd')).toBeNull();
  });
});

describe('resolvePlayerId', () => {
  test('returns the id from a valid token', async () => {
    const token = await makeToken();
    await expect(resolvePlayerId(`next-auth.session-token=${token}`, SECRET, { logger: quietLogger })).resolves.toBe(PLAYER_ID);
  });

  test('prefers the __Secure- cookie over the plain one', async () => {
    const secure = await makeToken({ id: PLAYER_ID });
    const plain = await makeToken({ id: OTHER_PLAYER_ID });
    const header = `next-auth.session-token=${plain}; __Secure-next-auth.session-token=${secure}`;
    await expect(resolvePlayerId(header, SECRET, { logger: quietLogger })).resolves.toBe(PLAYER_ID);
  });

  test('returns null without a cookie', async () => {
    await expect(resolvePlayerId(undefined, SECRET, { logger: quietLogger })).resolves.toBeNull();
    await expect(resolvePlayerId('unrelated=1', SECRET, { logger: quietLogger })).resolves.toBeNull();
  });

  test('returns null for a tampered token and logs without the token value', async () => {
    const logger = { warn: vi.fn() };
    const token = await makeToken();
    const tampered = token.slice(0, -4) + 'AAAA';
    await expect(resolvePlayerId(`next-auth.session-token=${tampered}`, SECRET, { logger })).resolves.toBeNull();
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(logger.warn.mock.calls)).not.toContain(tampered);
  });

  test('returns null for garbage', async () => {
    await expect(resolvePlayerId('next-auth.session-token=not-a-jwt', SECRET, { logger: quietLogger })).resolves.toBeNull();
  });

  test('returns null when decoded with the wrong secret', async () => {
    const token = await makeToken();
    await expect(resolvePlayerId(`next-auth.session-token=${token}`, 'another-secret', { logger: quietLogger })).resolves.toBeNull();
  });

  test('returns null when no secret is configured', async () => {
    const token = await makeToken();
    await expect(resolvePlayerId(`next-auth.session-token=${token}`, undefined, { logger: quietLogger })).resolves.toBeNull();
  });

  test('returns null for a token without a valid ObjectId id', async () => {
    for (const claims of [{}, { id: 'not-an-object-id' }, { id: 42 }, { id: PLAYER_ID.slice(0, 23) }, { sub: PLAYER_ID }]) {
      const token = await makeToken(claims);
      await expect(resolvePlayerId(`next-auth.session-token=${token}`, SECRET, { logger: quietLogger })).resolves.toBeNull();
    }
  });

  test('returns null for an expired token', async () => {
    const token = await encode({ token: { id: PLAYER_ID }, secret: SECRET, maxAge: -60 });
    await expect(resolvePlayerId(`next-auth.session-token=${token}`, SECRET, { logger: quietLogger })).resolves.toBeNull();
  });
});
