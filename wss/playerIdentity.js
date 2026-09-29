import { decode } from 'next-auth/jwt';

// NextAuth v4 cookie names (ADR 0002). The `__Secure-` one is set on HTTPS.
const SESSION_COOKIE_NAMES = ['__Secure-next-auth.session-token', 'next-auth.session-token'];
const OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/;

const parseCookieHeader = header => {
  const cookies = new Map();
  if (typeof header !== 'string' || !header) return cookies;

  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    const name = part.slice(0, index).trim();
    if (!name || cookies.has(name)) continue;
    cookies.set(name, part.slice(index + 1).trim());
  }
  return cookies;
};

// NextAuth splits a session token over `name.0`, `name.1`, ... when it exceeds the cookie size limit.
const readSessionToken = (cookies, name) => {
  if (cookies.has(name)) return cookies.get(name);

  const chunks = [];
  for (const [cookieName, value] of cookies) {
    if (!cookieName.startsWith(`${name}.`)) continue;
    const index = Number(cookieName.slice(name.length + 1));
    if (Number.isInteger(index) && index >= 0) chunks[index] = value;
  }
  if (chunks.length === 0 || chunks.includes(undefined)) return null;
  return chunks.join('');
};

export const getSessionToken = cookieHeader => {
  const cookies = parseCookieHeader(cookieHeader);
  for (const name of SESSION_COOKIE_NAMES) {
    const token = readSessionToken(cookies, name);
    if (token) return token;
  }
  return null;
};

/**
 * Resolve the Player id from a socket handshake's Cookie header.
 * Returns the Player's id (24-hex string) or null for a Guest.
 * Never throws; a token that fails to decode is logged (without its value) and treated as a Guest.
 */
export const resolvePlayerId = async (cookieHeader, secret, { logger = console } = {}) => {
  const token = getSessionToken(cookieHeader);
  if (!token) return null;

  if (!secret) {
    logger.warn('NEXTAUTH_SECRET is not set; treating session as Guest');
    return null;
  }

  let payload;
  try {
    payload = await decode({ token, secret });
  } catch (err) {
    logger.warn('failed to decode session token; treating session as Guest:', err?.code || err?.name || 'error');
    return null;
  }

  const id = payload?.id;
  return typeof id === 'string' && OBJECT_ID_PATTERN.test(id) ? id : null;
};
