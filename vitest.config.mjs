import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = fileURLToPath(new URL('./', import.meta.url));

export default defineConfig({
  resolve: { alias: [{ find: /^@\//, replacement: root }] },
  test: {
    projects: [
      {
        extends: true,
        test: { name: 'node', environment: 'node', include: ['**/*.test.js'], exclude: ['**/node_modules/**', '.next/**', 'components/**'] },
      },
      {
        extends: true,
        // Components are JSX in .js files, rendered into a DOM.
        oxc: { include: /\.js$/, exclude: [], lang: 'jsx', jsx: { runtime: 'automatic' } },
        test: { name: 'jsdom', environment: 'jsdom', include: ['components/**/*.test.js'] },
      },
    ],
  },
});
