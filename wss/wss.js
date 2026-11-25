import dotenv from 'dotenv';
dotenv.config();
import { connectDB } from '../db.js';
import Game from './Game.js';
import { resolvePlayerId } from './playerIdentity.js';
import http from 'http';
import { Server } from 'socket.io';

const MIN_LEVEL = 1;
const MAX_LEVEL = 10;
const CLIENT_ID_PATTERN = /^[a-z0-9_-]{6,80}$/i;
const ALLOWED_STATES = new Set(['cReady', 'play', 'pause', 'resume', 'gameover']);
// Each socket may send a burst of EVENT_BURST messages, refilled at EVENT_RATE a second. Play needs a few a second.
const EVENT_BURST = 40;
const EVENT_RATE = 20;
// Per address, every Word sample and every saved Score draw on one budget that survives reconnects, whatever
// started them (a new Game, a Level clear, a Game over, a retry). A classroom starting together fits in the burst.
const WORK_BURST = 120;
const WORK_RATE = 4;
// No message the browser sends is more than a few hundred bytes.
const MAX_MESSAGE_BYTES = 16 * 1024;
const LOOPBACK_ADDRESSES = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

// Only numbers and numeric strings: Number() on an object can throw (`{"toString":0}`), and a throw inside a
// handler ends the process.
const toNumber = value => (typeof value === 'number' || typeof value === 'string' ? Number(value) : NaN);

const clampLevel = value => {
  const level = toNumber(value);
  if (!Number.isFinite(level)) return null;
  return Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, Math.trunc(level)));
};

const getFinitePositiveNumber = value => {
  const parsed = toNumber(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const parseInitPayload = payload => {
  if (!payload || typeof payload !== 'object') return null;

  const clientId = typeof payload.clientId === 'string' && CLIENT_ID_PATTERN.test(payload.clientId) ? payload.clientId : null;
  const width = getFinitePositiveNumber(payload.width);
  const charWidth = getFinitePositiveNumber(payload.charWidth);
  const level = clampLevel(payload.level ?? MIN_LEVEL);

  if (!clientId || !width || !charWidth || !level) return null;

  return { clientId, width, charWidth, level };
};

const getAllowedOrigins = () => {
  const configured = process.env.WEBSOCKET_CORS_ORIGINS || process.env.ALLOWED_ORIGINS || process.env.NEXTAUTH_URL || '';
  const origins = configured
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

  if (process.env.NODE_ENV !== 'production') {
    origins.push('http://localhost:4001', 'http://127.0.0.1:4001');
  }

  return [...new Set(origins)];
};

const allowedOrigins = getAllowedOrigins();

if (process.env.NODE_ENV === 'production' && allowedOrigins.length === 0) {
  throw new Error('WEBSOCKET_CORS_ORIGINS or NEXTAUTH_URL must be configured in production');
}

const isAllowedOrigin = origin => !origin || allowedOrigins.includes(origin);

const getPositiveInteger = (value, fallback) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

// A classroom can share one address, so the cap is generous; it stops one machine opening thousands of Games.
const maxConnectionsPerIp = getPositiveInteger(process.env.WEBSOCKET_MAX_CONNECTIONS_PER_IP, 100);
const connectionsByIp = new Map();

// Behind nginx every socket comes from loopback, and nginx sets X-Real-IP. Anyone else's header is ignored.
const clientIp = req => {
  const remote = req.socket?.remoteAddress ?? '';
  const forwarded = req.headers['x-real-ip'];
  return LOOPBACK_ADDRESSES.has(remote) && typeof forwarded === 'string' && forwarded ? forwarded : remote;
};

const workByIp = new Map();

// Spends one unit of an address's database budget; false once it is used up.
const spendWork = ip => {
  const now = Date.now();
  if (workByIp.size > 10000) {
    for (const [key, bucket] of workByIp) if (now - bucket.last > (WORK_BURST / WORK_RATE) * 1000) workByIp.delete(key);
  }
  const bucket = workByIp.get(ip) ?? { tokens: WORK_BURST, last: now };
  bucket.tokens = Math.min(WORK_BURST, bucket.tokens + ((now - bucket.last) / 1000) * WORK_RATE);
  bucket.last = now;
  workByIp.set(ip, bucket);
  if (bucket.tokens < 1) return false;
  bucket.tokens -= 1;
  return true;
};

// Token bucket over a socket's incoming messages. A socket that floods is disconnected.
const limitEvents = client => {
  let tokens = EVENT_BURST;
  let last = Date.now();
  let flooded = false;
  client.use((_packet, next) => {
    // Messages already buffered when the socket was cut are dropped quietly.
    if (flooded) return;
    const now = Date.now();
    tokens = Math.min(EVENT_BURST, tokens + ((now - last) / 1000) * EVENT_RATE);
    last = now;
    if (tokens < 1) {
      flooded = true;
      console.log(client.id, 'sent too many messages; disconnecting');
      client.disconnect(true);
      return;
    }
    tokens -= 1;
    next();
  });
};

if (!process.env.NEXTAUTH_SECRET) {
  console.warn('NEXTAUTH_SECRET is not set: every socket will play as a Guest');
}

const server = http.createServer();
const io = new Server(server, {
  cors: { origin: allowedOrigins, methods: ['GET', 'POST'], credentials: true },
  maxHttpBufferSize: MAX_MESSAGE_BYTES,
  allowRequest: (req, callback) => {
    if (!isAllowedOrigin(req.headers.origin)) return callback(null, false);
    callback(null, (connectionsByIp.get(clientIp(req)) ?? 0) < maxConnectionsPerIp);
  },
});
// Count transports, not namespace sockets: a transport that never joins the namespace still holds a connection.
io.engine.on('connection', transport => {
  const ip = clientIp(transport.request);
  connectionsByIp.set(ip, (connectionsByIp.get(ip) ?? 0) + 1);
  transport.once('close', () => {
    const left = (connectionsByIp.get(ip) ?? 1) - 1;
    if (left > 0) connectionsByIp.set(ip, left);
    else connectionsByIp.delete(ip);
  });
});

// One Game per socket, keyed by the server's socket id. The browser's clientId is only a label (the page-load ID),
// so another socket that learns it can't reach this Game.
const games = new Map();

// Identity comes only from the NextAuth session cookie (ADR 0002). A socket without a valid one is a Guest.
io.use(async (socket, next) => {
  try {
    const playerId = await resolvePlayerId(socket.handshake.headers.cookie, process.env.NEXTAUTH_SECRET);
    if (playerId) socket.playerId = playerId;
  } catch (err) {
    console.warn('failed to resolve player identity; treating socket as Guest', err);
  }
  next();
});

io.on('connection', client => {
  const ip = clientIp(client.request);
  limitEvents(client);
  let cutOff = false;
  // Handed to the Game: it asks before each Word sample and each Score.
  const spend = () => {
    if (spendWork(ip)) return true;
    if (!cutOff) {
      cutOff = true;
      console.log(client.id, ip, 'used up its address budget; disconnecting');
      client.disconnect(true);
    }
    return false;
  };
  console.log(client.id, ip, client.playerId ? 'player' : 'guest');
  // Old tabs still send `login` with a player id. Identity is resolved from the session cookie, so the payload is ignored.
  client.on('login', () => {});
  client.on('init', payload => {
    const parsed = parseInitPayload(payload);
    if (!parsed) {
      client.emit('state', 'restart');
      return;
    }

    const { clientId, width, charWidth, level } = parsed;
    const game = games.get(client.id);
    // A Game in progress keeps its Level and its board.
    if (game?.inProgress) return;
    client.width = width;
    client.charWidth = charWidth;
    // The page-load ID saved with Guest Scores; set once per socket.
    client.gameId ??= clientId;
    if (game) {
      if (!game.ready) game.stop();
      game.resetGame();
      game.level = level;
    } else {
      const created = new Game(client, level, { spend });
      // Over budget, the Game's first Word sample disconnected the socket.
      if (!client.disconnected) games.set(client.id, created);
    }
  });
  client.on('startLevel', value => {
    const level = clampLevel(value);
    if (!level) return;

    const game = games.get(client.id);
    // Choosing a Level mid-Game would carry the Game's Score into a new Level bonus.
    if (game && !game.inProgress) {
      game.resetGame();
      game.level = level;
      game.score = 10;
      game.bonus = (level - 1) * 850;
      // After a failed Word sample, choosing a Level tries again.
      game.loadWords();
      console.log('set level to', game.level);
    }
  });
  client.on('state', cmd => {
    if (!ALLOWED_STATES.has(cmd)) {
      console.log(client.id, 'unknown cmd of type', typeof cmd);
      return;
    }

    console.log(client.gameId, 'state', cmd);
    const game = games.get(client.id);
    if (game == null) {
      client.emit('state', 'restart');
      return;
    }
    switch (cmd) {
      case 'cReady':
        if (game.ready) {
          client.emit('game', game.getState());
          client.emit('state', 'play');
          game.start();
        }
        break;
      case 'play':
        break;
      // Echoed only when the Game actually paused or resumed, so the browser's stopwatch follows the server.
      case 'pause':
        if (game.pause()) client.emit('state', 'pause');
        break;
      case 'resume':
        if (game.resume()) client.emit('state', 'resume');
        break;
      case 'gameover':
        client.emit('state', 'gameover');
        // Quitting before the first Level starts finishes nothing: no Score, no new Word sample.
        if (game.inProgress) {
          game.stop();
          game.recordScore();
        } else {
          game.finishUnplayed();
        }
        game.resetGame();
        client.emit('game', game.getState());
        break;
    }
  });
  const endGame = () => {
    games.get(client.id)?.abandon();
    games.delete(client.id);
  };
  client.on('error', err => {
    endGame();
    console.log(err);
  });
  client.on('disconnect', reason => {
    endGame();
    console.log(client.id, 'disconnected:', reason, '- games:', games.size, 'sockets:', io.engine.clientsCount);
  });
});

const port = Number(process.env.WEBSOCKET_PORT || process.env.PORT || 4000);
// Only nginx (on this host) should reach the server. Set WEBSOCKET_HOST=0.0.0.0 to test from another device.
const host = process.env.WEBSOCKET_HOST || '127.0.0.1';

connectDB()
  .then(() => {
    server.listen(port, host, () => console.log(`server running at http://${host}:${port}`));
  })
  .catch(err => {
    console.error('failed to connect to database', err);
    process.exit(1);
  });
server.on('error', err => console.error(err));
