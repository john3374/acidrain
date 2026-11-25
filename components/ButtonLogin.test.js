import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({ update: null, signOut: null, calls: [] }));

vi.mock('next-auth/react', () => ({
  useSession: () => ({ status: 'authenticated', data: { user: { nickname: '산성비', image: '/x.png' } }, update: h.update }),
  signIn: vi.fn(),
  signOut: (...args) => h.signOut(...args),
}));
// The profile popup, rendered open.
vi.mock('next/dynamic', () => ({ default: () => ({ children }) => (typeof children === 'function' ? children(() => {}) : children) }));
vi.mock('next/image', () => ({ default: () => null }));
vi.mock('@tanstack/react-query', () => ({ useMutation: () => ({ mutate: vi.fn() }) }));
vi.mock('@/components/Achievements', () => ({ default: () => null }));

import ButtonLogin from './ButtonLogin.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let container;
let root;

beforeEach(() => {
  h.calls = [];
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('deleting the account', () => {
  test('signs out only after the deletion request has finished', async () => {
    let finishDelete;
    h.update = vi.fn(data => {
      h.calls.push(['update', data]);
      return new Promise(resolve => (finishDelete = resolve));
    });
    h.signOut = vi.fn(() => h.calls.push(['signOut']));
    act(() => root.render(<ButtonLogin />));
    const button = [...container.querySelectorAll('button')].find(b => b.textContent === '탈퇴');

    await act(async () => button.click());
    expect(h.calls).toEqual([['update', { delete: 1 }]]);

    await act(async () => finishDelete({}));
    expect(h.calls).toEqual([['update', { delete: 1 }], ['signOut']]);
  });
});
