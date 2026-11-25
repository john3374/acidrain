import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';

// The real socket handlers, with the HTTP server, Socket.io transport and database replaced by fakes.
const h = vi.hoisted(() => ({ io: null, saved: [], wordLoads: 0 }));

vi.mock('dotenv', () => ({ default: { config: () => ({}) } }));
vi.mock('../db.js', () => ({ connectDB: () => new Promise(() => {}) }));
vi.mock('http', () => ({ default: { createServer: () => ({ listen() {}, on() {} }) } }));
vi.mock('./playerIdentity.js', () => ({ resolvePlayerId: () => Promise.resolve(null) }));
vi.mock('socket.io', () => ({
  Server: class {
    constructor(_server, options) {
      h.io = this;
      this.options = options;
      this.engine = { clientsCount: 0 };
      this.middleware = [];
    }
    use(fn) {
      this.middleware.push(fn);
    }
    on(event, fn) {
      if (event === 'connection') this.onConnection = fn;
    }
  },
}));
vi.mock('../schema/index.js', () => {
  class Score {
    constructor(fields) {
      Object.assign(this, fields);
    }
    save() {
      h.saved.push({ ...this });
      return Promise.resolve(this);
    }
  }
  return {
    Word: {
      aggregate: () => {
        h.wordLoads++;
        return Promise.resolve(Array.from({ length: 20 }, (_, i) => ({ word: `word${i}` })));
      },
    },
    Player: { exists: () => Promise.resolve(null) },
    Score,
  };
});
vi.mock('../lib/achievements.js', () => ({ awardAchievements: () => Promise.resolve([]) }));

const flush = async () => {
  for (let i = 0; i < 5; i++) await new Promise(resolve => setImmediate(resolve));
};

let sockets = 0;
const connect = async ({ remoteAddress = '127.0.0.1', realIp = '198.51.100.1' } = {}) => {
  const handlers = new Map();
  const packetMiddleware = [];
  const request = { socket: { remoteAddress }, headers: realIp ? { 'x-real-ip': realIp } : {} };
  const client = {
    id: `socket${++sockets}`,
    request,
    handshake: { address: remoteAddress, headers: {} },
    sent: [],
    disconnected: false,
    on(event, fn) {
      if (!handlers.has(event)) handlers.set(event, []);
      handlers.get(event).push(fn);
    },
    use(fn) {
      packetMiddleware.push(fn);
    },
    emit(event, data) {
      this.sent.push([event, data]);
    },
    disconnect() {
      this.disconnected = true;
      this.receive('disconnect', 'server namespace disconnect');
    },
    // Runs the packet middleware first, as Socket.io does.
    send(event, data) {
      let passed = packetMiddleware.length === 0;
      for (const fn of packetMiddleware) fn([event, data], () => (passed = true));
      if (passed && !this.disconnected) this.receive(event, data);
    },
    receive(event, data) {
      for (const fn of handlers.get(event) ?? []) fn(data);
    },
  };
  const allowed = await new Promise(resolve => h.io.options.allowRequest({ ...request, headers: { ...request.headers } }, (_err, ok) => resolve(ok)));
  if (!allowed) return null;
  for (const fn of h.io.middleware) await new Promise(next => fn(client, next));
  h.io.onConnection(client);
  return client;
};

const INIT = { clientId: 'pageload1', width: 800, charWidth: 10 };

beforeAll(async () => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  await import('./wss.js');
});

beforeEach(() => {
  h.saved.length = 0;
  h.wordLoads = 0;
});

describe('quitting', () => {
  test('before the first Level starts saves no Score and loads no words', async () => {
    const client = await connect();
    client.send('init', INIT);
    await flush();
    h.wordLoads = 0;

    for (let i = 0; i < 20; i++) client.send('state', 'gameover');
    await flush();

    expect(h.saved).toEqual([]);
    expect(h.wordLoads).toBe(0);
    expect(client.sent).toContainEqual(['state', 'gameover']);
  });

  test('a started Game saves one Score', async () => {
    const client = await connect();
    client.send('init', INIT);
    await flush();
    client.send('state', 'cReady');

    client.send('state', 'gameover');
    client.send('state', 'gameover');
    await flush();

    expect(h.saved).toHaveLength(1);
    expect(h.saved[0].pageLoadId).toBe('pageload1');
  });
});

describe('choosing a Level', () => {
  test('a Level 10 start that is quit at once scores no bonus', async () => {
    const client = await connect();
    client.send('init', INIT);
    await flush();
    client.send('startLevel', 10);
    client.send('state', 'cReady');

    client.send('state', 'gameover');
    await flush();

    expect(h.saved[0]).toMatchObject({ score: 10, startingLevel: 10 });
  });

  test('is ignored while a Game is in progress', async () => {
    const client = await connect();
    client.send('init', INIT);
    await flush();
    client.send('state', 'cReady');

    client.send('startLevel', 10);
    client.send('init', { ...INIT, level: 10 });
    client.send('state', 'gameover');
    await flush();

    expect(h.saved[0]).toMatchObject({ startingLevel: 1, levelReached: 1 });
  });
});

describe('two sockets with the same page-load ID', () => {
  test('each keep their own Game', async () => {
    const first = await connect();
    first.send('init', INIT);
    await flush();
    first.send('state', 'cReady');

    const second = await connect();
    second.send('init', INIT);
    await flush();
    second.send('state', 'gameover');
    second.receive('disconnect', 'client namespace disconnect');
    await flush();

    expect(h.saved).toEqual([]);
    first.sent.length = 0;
    first.send('state', 'pause');
    expect(first.sent).toContainEqual(['state', 'pause']);
  });
});

describe('a socket that floods', () => {
  test('is disconnected and its Game is dropped', async () => {
    const client = await connect();
    client.send('init', INIT);
    await flush();

    const log = vi.mocked(console.log);
    log.mockClear();
    for (let i = 0; i < 200; i++) client.send('state', 'play');

    expect(client.disconnected).toBe(true);
    expect(log.mock.calls.filter(([, message]) => message === 'sent too many messages; disconnecting')).toHaveLength(1);
  });
});

describe('connections from one address', () => {
  test('are capped, counting X-Real-IP only from the local proxy', async () => {
    const opened = [];
    for (let i = 0; i < 100; i++) opened.push(await connect({ realIp: '203.0.113.9' }));
    expect(opened.every(Boolean)).toBe(true);

    expect(await connect({ realIp: '203.0.113.9' })).toBeNull();
    // A forged header from a non-proxy peer is ignored: that peer is counted by its own address.
    expect(await connect({ remoteAddress: '192.0.2.50', realIp: '203.0.113.10' })).not.toBeNull();

    opened[0].receive('disconnect', 'transport close');
    expect(await connect({ realIp: '203.0.113.9' })).not.toBeNull();
  });
});
