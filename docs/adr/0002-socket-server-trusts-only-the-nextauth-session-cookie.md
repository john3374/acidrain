# The socket server trusts only the NextAuth session cookie

The Socket.io server (`wss/`) decides who is playing by reading the NextAuth session cookie from the socket handshake and decoding it with `next-auth/jwt`'s `decode` and `NEXTAUTH_SECRET`; the Player id is the token's `id`. It ignores the player id the browser sends in `login`, which anyone could forge. We chose this because it needs no change to the socket messages, no new route, and nothing readable by page scripts: in production `/socket.io` is proxied on the app host, so the browser already sends the cookie with the handshake.

## Considered Options

- **A short-lived socket token** issued by a Next.js route and sent in `login`. Rejected: it changes the `login` payload and adds a request, while the cookie already carries a signed identity.
- **Asking Next.js for the session on every Game.** Rejected: it adds a network hop inside every Game for the same answer.

## Consequences

- `wss` depends on NextAuth v4's cookie name (`next-auth.session-token`, or `__Secure-next-auth.session-token` on HTTPS) and token format, and needs `NEXTAUTH_SECRET` in its environment. **Upgrading NextAuth (for example to Auth.js v5, which renames the cookie and changes the token) must update `wss` in the same change**, or every Player silently becomes a Guest.
- A missing, expired or invalid cookie makes the Game a Guest Game, with no error shown. A Score is saved as a Guest Score if its Player no longer exists.
- Local development runs the browser and `wss` on different ports, so the socket client needs `withCredentials: true` and `wss` CORS needs `credentials: true`.
