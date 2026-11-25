import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';

// The real socket handlers, with the HTTP server, Socket.io transport and database replaced by fakes.
const h = vi.hoisted(() => ({ io: null, saved: [], wordLoads: 0, failWordLoads: 0 }));

vi.mock('dotenv', () => ({ default: { config: () => ({}) } }));
vi.mock('../db.js', () => ({ connectDB: () => new Promise(() => {}) }));
vi.mock('http', () => ({ default: { createServer: () => ({ listen() {}, on() {} }) } }));
vi.mock('./playerIdentity.js', () => ({ resolvePlayerId: () => Promise.resolve(null) }));
vi.mock('socket.io', () => ({
  Server: class {
    constructor(_server, options) {
      h.io = this;
      this.options = options;
      const engineHandlers = [];
      this.engine = { clientsCount: 0, on: (event, fn) => event === 'connection' && engineHandlers.push(fn), handlers: engineHandlers };
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
        if (h.failWordLoads > 0) {
          h.failWordLoads--;
          return Promise.reject(new Error('db down'));
        }
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

// An Engine.io transport: admitted by allowRequest, counted until it closes.
const openTransport = async ({ remoteAddress = '127.0.0.1', realIp = '198.51.100.1' } = {}) => {
  const request = { socket: { remoteAddress }, headers: realIp ? { 'x-real-ip': realIp } : {} };
  const allowed = await new Promise(resolve => h.io.options.allowRequest(request, (_err, ok) => resolve(ok)));
  if (!allowed) return null;
  const closeHandlers = [];
  const transport = { request, once: (event, fn) => event === 'close' && closeHandlers.push(fn), close: () => closeHandlers.forEach(fn => fn()) };
  for (const fn of h.io.engine.handlers) fn(transport);
  return transport;
};

let sockets = 0;
const connect = async options => {
  const transport = await openTransport(options);
  if (!transport) return null;
  const { request } = transport;
  const handlers = new Map();
  const packetMiddleware = [];
  const client = {
    id: `socket${++sockets}`,
    request,
    handshake: { address: request.socket.remoteAddress, headers: {} },
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
      this.close('server namespace disconnect');
    },
    close(reason = 'transport close') {
      if (this.disconnected) return;
      this.disconnected = true;
      this.receive('disconnect', reason);
      transport.close();
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

// Each test plays from its own address, so the per-address budget of one doesn't leak into the next.
let addresses = 0;
const nextAddress = () => `198.51.100.${++addresses}`;
const play = () => connect({ realIp: nextAddress() });

beforeEach(() => {
  h.saved.length = 0;
  h.wordLoads = 0;
  h.failWordLoads = 0;
});

describe('quitting', () => {
  test('before the first Level starts saves no Score and loads no words', async () => {
    const client = await play();
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
    const client = await play();
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
    const client = await play();
    client.send('init', INIT);
    await flush();
    client.send('startLevel', 10);
    client.send('state', 'cReady');

    client.send('state', 'gameover');
    await flush();

    expect(h.saved[0]).toMatchObject({ score: 10, startingLevel: 10 });
  });

  test('is ignored while a Game is in progress', async () => {
    const client = await play();
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
    const first = await play();
    first.send('init', INIT);
    await flush();
    first.send('state', 'cReady');

    const second = await play();
    second.send('init', INIT);
    await flush();
    second.send('state', 'gameover');
    second.close('client namespace disconnect');
    await flush();

    expect(h.saved).toEqual([]);
    first.sent.length = 0;
    first.send('state', 'pause');
    expect(first.sent).toContainEqual(['state', 'pause']);
  });
});

describe('a socket that floods', () => {
  test('is disconnected and its Game is dropped', async () => {
    const client = await play();
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

    opened[0].close();
    expect(await connect({ realIp: '203.0.113.9' })).not.toBeNull();
  });

  test('count transports that never join the namespace', async () => {
    const opened = [];
    for (let i = 0; i < 100; i++) opened.push(await openTransport({ realIp: '203.0.113.20' }));
    expect(opened.every(Boolean)).toBe(true);

    expect(await openTransport({ realIp: '203.0.113.20' })).toBeNull();
    opened[0].close();
    expect(await openTransport({ realIp: '203.0.113.20' })).not.toBeNull();
  });
});

describe('a malformed message', () => {
  test('with an object where a number belongs is ignored instead of throwing', async () => {
    const client = await play();
    const hostile = { toString: 0 };

    expect(() => client.send('startLevel', hostile)).not.toThrow();
    expect(() => client.send('init', { clientId: 'pageload1', width: hostile, charWidth: 10, level: hostile })).not.toThrow();
    expect(client.sent).toContainEqual(['state', 'restart']);
  });
});

describe('one address starting and quitting Games over and over', () => {
  test('is cut off once its budget is spent, even across new sockets', async () => {
    const ip = nextAddress();
    let client = await connect({ realIp: ip });
    client.send('init', INIT);
    await flush();
    let cycles = 0;
    while (cycles < 200) {
      if (client.disconnected) {
        client = await connect({ realIp: ip });
        client.send('init', INIT);
        await flush();
        if (client.disconnected) break;
      }
      client.send('state', 'cReady');
      client.send('state', 'gameover');
      await flush();
      cycles++;
    }

    expect(h.saved.length).toBeLessThanOrEqual(60);
    expect(h.wordLoads).toBeLessThanOrEqual(61);
  });
});

describe('the result sequence', () => {
  test('stays in step with Game overs when a Game is quit before it starts', async () => {
    const client = await play();
    client.send('init', INIT);
    await flush();
    client.send('state', 'gameover'); // quit before starting: the browser counts this Game over
    await flush();
    client.send('state', 'cReady');
    client.send('state', 'gameover');
    await flush();

    const gameOvers = client.sent.filter(([event, data]) => event === 'state' && data === 'gameover').length;
    const results = client.sent.filter(([event]) => event === 'result').map(([, payload]) => payload.sequence);
    expect(results).toEqual([gameOvers]);
  });
});

describe('a failed Word sample', () => {
  test('is tried again when a Level is chosen, and the Game can then start', async () => {
    const log = vi.mocked(console.log);
    h.failWordLoads = 1;
    const client = await play();
    client.send('init', INIT);
    await flush();
    expect(client.sent).toContainEqual(['state', 'restart']);
    expect(log).toHaveBeenCalledWith('failed to load words', expect.any(Error));

    client.send('startLevel', 3);
    await flush();
    expect(client.sent).toContainEqual(['state', 'sReady']);

    client.sent.length = 0;
    client.send('state', 'cReady');
    expect(client.sent).toContainEqual(['state', 'play']);
  });
});
