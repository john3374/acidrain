import dotenv from 'dotenv';
dotenv.config();
import { connectDB } from '../db.js';
import Game from './Game.js';
import http from 'http';
import { Server } from 'socket.io';

const MIN_LEVEL = 1;
const MAX_LEVEL = 10;
const CLIENT_ID_PATTERN = /^[a-z0-9_-]{6,80}$/i;
const OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/;
const ALLOWED_STATES = new Set(['cReady', 'play', 'gameover']);

const clampLevel = value => {
  const level = Number(value);
  if (!Number.isFinite(level)) return null;
  return Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, Math.trunc(level)));
};

const getFinitePositiveNumber = value => {
  const parsed = Number(value);
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

const isValidObjectId = value => typeof value === 'string' && OBJECT_ID_PATTERN.test(value);

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

const server = http.createServer();
const io = new Server(server, {
  cors: { origin: allowedOrigins, methods: ['GET', 'POST'] },
  allowRequest: (req, callback) => callback(null, isAllowedOrigin(req.headers.origin)),
});
const games = {};

io.on('connection', client => {
  console.log(client.id, client.handshake.address);
  client.on('login', id => {
    if (!isValidObjectId(id)) {
      delete client.playerId;
      return;
    }
    client.playerId = id;
  });
  client.on('init', payload => {
    const parsed = parseInitPayload(payload);
    if (!parsed) {
      client.emit('state', 'restart');
      return;
    }

    const { clientId, width, charWidth, level } = parsed;
    client.width = width;
    client.charWidth = charWidth;
    if (!client.gameId) client.gameId = clientId;
    const game = games[client.gameId];
    if (game) {
      if (!game.ready) game.stop();
      game.resetGame();
      game.level = level;
    } else {
      client.gameId = clientId;
      games[clientId] = new Game(client, level);
    }
  });
  client.on('startLevel', value => {
    const level = clampLevel(value);
    if (!level) return;

    const game = games[client.gameId];
    if (game) {
      game.resetGame();
      game.level = level;
      game.score = 10;
      game.bonus = (level - 1) * 850;
      console.log('set level to', game.level);
    }
  });
  client.on('state', cmd => {
    if (!ALLOWED_STATES.has(cmd)) {
      console.log('unknown cmd', cmd);
      return;
    }

    console.log(client.gameId, 'state', cmd);
    const game = games[client.gameId];
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
      case 'gameover':
        client.emit('state', 'gameover');
        game.stop();
        game.recordScore();
        game.resetGame();
        client.emit('game', game.getState());
        break;
    }
  });
  client.on('error', err => {
    delete games[client.gameId];
    console.log(err);
  });
  client.on('disconnect', reason => {
    console.log('reason', reason);
    delete games[client.gameId];
    console.log(Object.keys(games));
    console.log(io.engine.clientsCount);
  });
});

const port = Number(process.env.WEBSOCKET_PORT || process.env.PORT || 4000);

connectDB()
  .then(() => {
    server.listen(port, () => console.log(`server running at http://localhost:${port}`));
  })
  .catch(err => {
    console.error('failed to connect to database', err);
    process.exit(1);
  });
server.on('error', err => console.error(err));
