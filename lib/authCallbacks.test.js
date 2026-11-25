import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({ updateOne: null, findOneAndUpdate: null }));

vi.mock('../db.js', () => ({ connectDB: () => Promise.resolve() }));
vi.mock('../schema/index.js', () => ({
  Player: {
    updateOne: (...args) => h.updateOne(...args),
    findOneAndUpdate: (...args) => h.findOneAndUpdate(...args),
  },
  Score: { deleteMany: () => Promise.resolve() },
  Achievement: { deleteMany: () => Promise.resolve() },
}));

import { callbacks, hasVerifiedEmail } from './authCallbacks.js';

const user = { email: 'player@example.test' };

describe('signing in', () => {
  beforeEach(() => {
    h.findOneAndUpdate = vi.fn(() => Promise.resolve({ nickname: '산성비', _id: { toString: () => '64f1c2d3e4a5b6c7d8e9f0a1' } }));
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => vi.unstubAllGlobals());

  test.each([
    ['google', { email_verified: true }, true],
    ['google', { email_verified: false }, false],
    ['google', {}, false],
    ['discord', { verified: true }, true],
    ['discord', { verified: false }, false],
    ['discord', {}, false],
    ['twitter', { verified: true }, false],
  ])('%s with profile %j is allowed: %s', async (provider, profile, allowed) => {
    expect(await hasVerifiedEmail(user, { provider }, profile)).toBe(allowed);
  });

  test.each([undefined, null, '', 'not-an-address'])('an email of %j is refused', async email => {
    expect(await hasVerifiedEmail({ email }, { provider: 'google' }, { email_verified: true })).toBe(false);
  });

  test('GitHub is allowed only when /user/emails lists the address as verified', async () => {
    const reply = emails => fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(emails) });
    const github = { provider: 'github', access_token: 'synthetic-token' };

    reply([{ email: 'Player@Example.test', verified: true, primary: true }]);
    expect(await hasVerifiedEmail(user, github, {})).toBe(true);
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer synthetic-token');

    reply([{ email: 'player@example.test', verified: false }]);
    expect(await hasVerifiedEmail(user, github, {})).toBe(false);

    reply([{ email: 'other@example.test', verified: true }]);
    expect(await hasVerifiedEmail(user, github, {})).toBe(false);

    fetch.mockResolvedValueOnce({ ok: false });
    expect(await hasVerifiedEmail(user, github, {})).toBe(false);

    expect(await hasVerifiedEmail(user, { provider: 'github' }, {})).toBe(false);
  });

  test('an unverified email never reaches the database', async () => {
    expect(await callbacks.signIn({ user: { ...user }, account: { provider: 'discord' }, profile: { verified: false } })).toBe(false);
    expect(h.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test('a verified email signs in to its Player', async () => {
    const signedIn = await callbacks.signIn({ user: { ...user }, account: { provider: 'discord' }, profile: { verified: true } });
    expect(signedIn).toMatchObject({ nickname: '산성비', id: '64f1c2d3e4a5b6c7d8e9f0a1' });
  });
});

describe('changing the nickname', () => {
  const update = nickname => callbacks.jwt({ token: { email: user.email, nickname: '옛별명' }, trigger: 'update', session: { nickname } });

  test('shows the new nickname once the database has saved it', async () => {
    h.updateOne = vi.fn(() => Promise.resolve({ acknowledged: true }));
    expect((await update('새별명')).nickname).toBe('새별명');
    expect(h.updateOne).toHaveBeenCalledWith({ email: user.email }, { $set: { nickname: '새별명' } });
  });

  test('keeps the old nickname when the database refuses it (taken)', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    h.updateOne = vi.fn(() => Promise.reject(Object.assign(new Error('E11000 duplicate key'), { code: 11000 })));
    expect((await update('남의별명')).nickname).toBe('옛별명');
    log.mockRestore();
  });

  test('ignores a nickname that fails validation without asking the database', async () => {
    h.updateOne = vi.fn();
    expect((await update('аdmin')).nickname).toBe('옛별명');
    expect(h.updateOne).not.toHaveBeenCalled();
  });
});
