# Which test runner fits this stack?

Research for [#5](https://github.com/john3374/acidrain/issues/5). Checked 2026-09-29 against Vitest 5.0.2, Vite 8.3.1, @vitejs/plugin-react 6.1.1, Jest 30.5.2, Next.js 16.2.10, Node 22.22.2 (local) [S1].

## Recommendation

**Use Vitest**, with one config that defines two projects: `node` for `wss/` and `schema/`, and `jsdom` for `app/` and `components/`. Vitest is the only one of the three that handles all of the following without flags or a CJS transpile step:

- the ESM server code;
- the `@/` alias;
- JSX components;
- fake timers;
- hoisted mocking of the `schema/index.js` ES module.

Next.js ships an official Vitest guide [S2]. Jest via `next/jest` works as a runner-up, but only by compiling everything to CommonJS, and Mongoose's own docs discourage Jest [S12]. `node:test` cannot render components: it has no JSX transform and no alias support, and its module mocks are behind a flag.

One catch applies to this repo. Components keep JSX in `.js` files, and Vite 8 does not transform JSX in `.js` by default. The config below adds a small plugin for this, which has not been run yet (see Risks).

## Repo facts that drive the choice

- `package.json` has no `"type"` field, yet `wss/*.js`, `schema/*.js` and `db.js` use `import`/`export`. `node wss/wss` works through Node's syntax detection: an ambiguous `.js` file that contains ESM syntax is treated as ESM. This is on by default since v22.7.0 / v20.19.0 [S9].
- `next.config.js` is CommonJS (`module.exports`), and `eslint.config.mjs` is ESM by extension.
- `jsconfig.json` maps `@/*` to `./*`, with no `baseUrl`. `app/page.js` imports from `@/components/...`.
- JSX lives in `.js` files: `app/page.js`, `app/layout.js` and `components/{ButtonLogin,NextAuthProvider,ScoreBoard,Stopwatch}.js`.
- `wss/Game.js` drives the loop with a recursive `setTimeout`. The delay is `Math.max(184, 2200 - level*200)` ms. The constructor immediately calls `GameDB.updateOne(...)` and `Word.aggregate(...)` from `../schema/index.js`. Any test has to mock that module.
- `components/socket.js` calls `io(...)` at import time. Client tests that import it must mock it.
- `engines.node` is `>=20.9.0`, which matches Next 16's own `engines` [S1].

## Comparison

| Criterion | Vitest 5 | `node:test` (Node 22 LTS) | Jest 30 (+ `next/jest`) |
|---|---|---|---|
| ESM without a build step | Native. Files go through Vite's transform pipeline, so no flags and no CJS output [S3]. | Native. Runs the files exactly as `node wss/wss` does [S9]. | Native ESM is "experimental" and needs `--experimental-vm-modules` [S10]. In practice, `next/jest` compiles to CJS with SWC because `type !== 'module'` [S5]. |
| `@/` alias | `resolve.alias` [S6], and `vi.mock` accepts aliased paths [S4]. `resolve.tsconfigPaths` only reads `tsconfig.json` [S6], so it does not apply to `jsconfig.json`. | Not supported. Node supports only `#`-prefixed subpath `imports` [S9b], so every `@/` import would need rewriting. | `next/jest` passes the jsconfig `paths` into SWC [S5]. The guide still says to mirror them in `moduleNameMapper` [S2b]. |
| React component testing | Official Next guide: `@vitejs/plugin-react` + `jsdom` + RTL [S2]. Needs a fix for JSX in `.js` (Risk 1). | No JSX. Node supports neither `.tsx` nor any JSX transform [S9c]; this would need a third-party loader plus a DOM shim. | Official Next guide: `jest-environment-jsdom` + RTL. SWC handles JSX in `.js` [S2b][S5]. |
| Fake timers (`setTimeout` loop) | `vi.useFakeTimers()` fakes `setTimeout`, `clearTimeout`, `setInterval`, `setImmediate` and `Date` (via `@sinonjs/fake-timers`), with `advanceTimersByTime` and async variants [S4]. | `mock.timers` fakes `setTimeout`, `setInterval` and `Date`. Still "Experimental" on the v22 line; stable only from v23.1.0 [S7]. | `jest.useFakeTimers()`, `advanceTimersByTime` and `runOnlyPendingTimers` [S11]. |
| Mocking Mongoose (`schema/index.js`) | `vi.mock('../schema/index.js', factory)` is hoisted above imports and works on ESM [S4]. | `mock.module()` is "1.0 - Early development" and requires `--experimental-test-module-mocks` [S8]. | Works with hoisted `jest.mock`, but only because the code is compiled to CJS. For real ESM it is `jest.unstable_mockModule` [S10]. Mongoose recommends a runner other than Jest and warns against Jest timer mocks [S12]. |
| Setup cost | 5 dev deps (`vitest vite @vitejs/plugin-react jsdom @testing-library/react @testing-library/dom`) [S2][S3], plus one config file with a small JSX-in-`.js` plugin. | Zero deps for `wss/`. The client half is effectively not covered. | 6-7 dev deps (`jest jest-environment-jsdom @testing-library/*` and so on) plus a `next/jest` config [S2b]. Server tests need a `@jest-environment node` override because the guide's default is jsdom. |

Two limits apply to every option:

- **Async Server Components:** neither Vitest nor Jest can unit-test them; Next recommends E2E tests instead [S2][S2b]. This repo's `RootLayout` and `Home` are synchronous, so this does not bite today.
- **RTL cleanup:** RTL auto-cleans only when the runner exposes a global `afterEach` [S13]. Vitest does not by default (`globals: false`), and its docs name RTL as the case for turning `globals` on [S14].

## Minimal config

Install (pnpm):

```sh
pnpm add -D vitest vite @vitejs/plugin-react jsdom @testing-library/react @testing-library/dom
```

`vite` is a required peer of `vitest` 5 [S1][S3]. Add `"test": "vitest"` to the `package.json` scripts [S2].

`vitest.config.mjs`. Use `.mjs` because the package has no `"type": "module"`.

```js
import { fileURLToPath } from 'node:url';
import { transformWithOxc } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const root = fileURLToPath(new URL('./', import.meta.url));

// Next allows JSX in .js; Vite 8's Oxc step skips .js and parses it without JSX (see Risk 1).
const jsxInJs = {
  name: 'acidrain:jsx-in-js',
  enforce: 'pre',
  async transform(code, id) {
    if (!/[\\/](app|components)[\\/].*\.js$/.test(id)) return null;
    const { code: out, map } = await transformWithOxc(code, id, { lang: 'jsx', jsx: { runtime: 'automatic' } });
    return { code: out, map };
  },
};

export default defineConfig({
  plugins: [jsxInJs, react()],
  resolve: { alias: [{ find: /^@\//, replacement: root }] },
  test: {
    projects: [
      { test: { name: 'server', environment: 'node', include: ['wss/**/*.test.js', 'schema/**/*.test.js', 'lib/**/*.test.js'] } },
      { test: { name: 'client', environment: 'jsdom', globals: true, include: ['app/**/*.test.{js,jsx}', 'components/**/*.test.{js,jsx}'] } },
    ],
  },
});
```

Inline projects inherit the root file's options, including plugins and alias [S15]. Here is a sketch of a game-loop test, `wss/Game.test.js`:

```js
import { vi, test, expect } from 'vitest';
vi.mock('../schema/index.js', () => ({
  Game: { updateOne: vi.fn(() => Promise.resolve()) },
  Word: { aggregate: vi.fn(() => Promise.resolve([{ word: 'acid' }, { word: 'rain' }])) },
  Score: class { save() { return Promise.resolve(); } },
}));
import Game from './Game.js';

test('a tick at level 1 fires after 2000ms', async () => {
  vi.useFakeTimers();
  const client = { gameId: 'g1', width: 800, charWidth: 10, on: vi.fn(), emit: vi.fn() };
  const game = new Game(client, 1);
  await vi.advanceTimersByTimeAsync(0);      // let mocked Word.aggregate resolve
  game.start();
  client.emit.mockClear();
  await vi.advanceTimersByTimeAsync(1999);
  expect(client.emit).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(client.emit).toHaveBeenCalledWith('game', expect.objectContaining({ level: 1 }));
  game.stop();
});
```

Client tests should also call `vi.mock('@/components/socket', ...)`, because that module opens a socket at import.

## Open risks

1. **JSX in `.js` under Vite 8 has not been run.** Vite's Oxc plugin defaults to `include: /\.(m?ts|[jt]sx)$/, exclude: /\.js$/` [S16]. `OxcOptions` omits `lang`, and Vite takes `lang` from the file extension [S16]. Oxc parses `lang: 'js'` without JSX [S17]. So the `oxc.include` option alone will not fix `.js` JSX. That is why the config uses a pre-plugin that calls the exported `transformWithOxc` with `lang: 'jsx'` [S16][S18]. I did not install anything to test this. If it fails, the fallback is to rename the 6 JSX-bearing `.js` files to `.jsx`, which Next supports and which needs no plugin. The Next guide's JS example avoids the problem only because it uses `.jsx` files [S2].
2. **Node version floor.** Vitest 5 requires Node `^22.12.0 || ^24 || >=26`, and jsdom 30.1 requires `^22.22.2 || ^24.15.0 || >=26` [S1][S3]. The repo declares `>=20.9.0`. Tests will not run on Node 20. Either the CI/dev floor must be Node 22.22.2+, or jsdom needs pinning to an older major.
3. **Mongoose and fake timers.** Mongoose warns that fake timers break the driver's own `setTimeout`/`nextTick` use [S12]. The sketch avoids this by mocking `schema/index.js` wholesale. `Game.js` still imports real `mongoose` for `ObjectId`, which is import-only, with no connection. Never call `connectDB()` inside a fake-timer test.
4. **Vitest 5 is a recent major.** The Next.js guide is version-agnostic, and the `projects` inheritance default is quoted from current `main` docs [S15]. Pin exact versions when adopting.
5. **Source access.** nextjs.org and vitest.dev were blocked from this environment. I read the same docs from their GitHub sources ([S2], [S2b], [S3]-[S4], [S14]-[S15]), so wording may differ slightly from the rendered sites.

## Sources

- [S1] npm registry `latest` metadata (versions, engines, peers): https://registry.npmjs.org/vitest/latest, https://registry.npmjs.org/jsdom/latest, https://registry.npmjs.org/jest/latest, https://registry.npmjs.org/vite/latest, https://registry.npmjs.org/@vitejs/plugin-react/latest, https://registry.npmjs.org/@testing-library/react/latest, https://registry.npmjs.org/next/16.2.10
- [S2] Next.js, "How to set up Vitest with Next.js": https://nextjs.org/docs/app/guides/testing/vitest (source: https://github.com/vercel/next.js/blob/canary/docs/01-app/02-guides/testing/vitest.mdx)
- [S2b] Next.js, "How to set up Jest with Next.js": https://nextjs.org/docs/app/guides/testing/jest (source: https://github.com/vercel/next.js/blob/canary/docs/01-app/02-guides/testing/jest.mdx)
- [S3] Vitest, Getting Started (requires Vite >=6.4, Node >=22.12; reads Vite config): https://vitest.dev/guide/ (source: https://github.com/vitest-dev/vitest/blob/main/docs/guide/index.md)
- [S4] Vitest, `vi` API (`vi.mock` hoisting and aliases, `vi.useFakeTimers`): https://vitest.dev/api/vi (source: https://github.com/vitest-dev/vitest/blob/main/docs/api/vi.md)
- [S5] Next.js 16.2.10 `next/jest` source (isEsmProject, jsConfig passed to SWC): https://github.com/vercel/next.js/blob/v16.2.10/packages/next/src/build/jest/jest.ts, https://github.com/vercel/next.js/blob/v16.2.10/packages/next/src/build/swc/options.ts
- [S6] Vite, shared options (`resolve.alias`, `resolve.tsconfigPaths`, `oxc`): https://vite.dev/config/shared-options (source: https://github.com/vitejs/vite/blob/main/docs/config/shared-options.md)
- [S7] Node.js, `node:test` MockTimers (Experimental in v22 docs; "now stable" in v23.1.0): https://nodejs.org/docs/latest-v22.x/api/test.html#class-mocktimers, https://nodejs.org/api/test.html#class-mocktimers
- [S8] Node.js, `mock.module()` (Stability 1.0, `--experimental-test-module-mocks`): https://nodejs.org/api/test.html#mockmodulespecifier-options
- [S9] Node.js, Packages: syntax detection: https://nodejs.org/api/packages.html#syntax-detection. [S9b] Subpath imports: https://nodejs.org/api/packages.html#subpath-imports. [S9c] Node.js TypeScript (`.tsx` unsupported, `paths` not transformed): https://nodejs.org/api/typescript.html
- [S10] Jest, ECMAScript Modules (experimental, `--experimental-vm-modules`, `jest.unstable_mockModule`): https://jestjs.io/docs/ecmascript-modules (source: https://github.com/jestjs/jest/blob/main/website/versioned_docs/version-30.0/ECMAScriptModules.md)
- [S11] Jest, Timer Mocks: https://jestjs.io/docs/timer-mocks
- [S12] Mongoose, "Testing Mongoose with Jest": https://mongoosejs.com/docs/jest.html (source: https://github.com/Automattic/mongoose/blob/master/docs/jest.md)
- [S13] Testing Library, React Testing Library setup (auto cleanup needs global `afterEach`): https://testing-library.com/docs/react-testing-library/setup#skipping-auto-cleanup
- [S14] Vitest, `globals` config: https://vitest.dev/config/globals (source: https://github.com/vitest-dev/vitest/blob/main/docs/config/globals.md)
- [S15] Vitest, Test Projects: https://vitest.dev/guide/projects (source: https://github.com/vitest-dev/vitest/blob/main/docs/guide/projects.md)
- [S16] Vite Oxc plugin source (default include/exclude, `lang` from extension, `OxcOptions` omits `lang`): https://github.com/vitejs/vite/blob/main/packages/vite/src/node/plugins/oxc.ts
- [S17] Oxc NAPI `get_source_type` (`"js"` has no JSX, `"jsx"` does): https://github.com/oxc-project/oxc/blob/main/crates/oxc_napi/src/lib.rs
- [S18] Vite exports `transformWithOxc`: https://github.com/vitejs/vite/blob/main/packages/vite/src/node/index.ts
